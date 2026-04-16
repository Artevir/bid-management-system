#!/usr/bin/env python3
"""
将 docs 下「招标文件智能审阅中枢」目录中的 .docx 转为 Markdown。

- 按 w:body 子元素顺序输出 w:p（段落）与 w:tbl（表格）。
- 表格转为 GitHub 风格 Markdown（| 列 |）；支持 w:gridSpan 横向合并展开为多空格列。
- 纵向合并（w:vMerge）仅保留 Word 中出现的单元格文本，不模拟 rowspan（Markdown 限制）。

用法: python scripts/docx-hub-to-markdown.py [源目录] [输出目录]

默认**优先 Pandoc**（第二轮 docx→GFM）；未找到或失败时回退内置 OOXML。
强制只用内置解析：设置 **`USE_PANDOC_FOR_DOCX=0`**（或 `false` / `no` / `off`）。

未传参时在 docs 下自动查找包含 000.*.docx 的子目录。
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


def use_pandoc_preferred() -> bool:
    """默认 True（第二轮）；显式 0/false/no/off 时仅用内置 OOXML。"""
    v = os.environ.get("USE_PANDOC_FOR_DOCX", "").strip().lower()
    if v in ("0", "false", "no", "off"):
        return False
    return True


def resolve_pandoc_executable() -> str | None:
    """优先环境变量 PANDOC_EXE，其次仓库 tools/pandoc/pandoc.exe，最后 PATH 中的 pandoc。"""
    env = os.environ.get("PANDOC_EXE", "").strip()
    if env and Path(env).is_file():
        return env
    repo = Path(__file__).resolve().parents[1]
    local = repo / "tools" / "pandoc" / "pandoc.exe"
    if local.is_file():
        return str(local)
    return shutil.which("pandoc")

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def q(name: str) -> str:
    return f"{{{W_NS}}}{name}"


def _attrib_val(elem: ET.Element, local: str) -> str | None:
    """读取可能带命名空间的属性值。"""
    if elem is None:
        return None
    full = f"{{{W_NS}}}{local}"
    return elem.get(full) or elem.get(local)


def paragraph_plain_text(p: ET.Element) -> str:
    chunks: list[str] = []
    for node in p.iter():
        if node.tag == q("t") and node.text:
            chunks.append(node.text)
        if node.tag == q("t") and node.tail:
            chunks.append(node.tail)
    return "".join(chunks).strip()


def grid_span(tc: ET.Element) -> int:
    tc_pr = tc.find(q("tcPr"))
    if tc_pr is None:
        return 1
    gs = tc_pr.find(q("gridSpan"))
    if gs is None:
        return 1
    raw = _attrib_val(gs, "val")
    if raw is None:
        return 1
    try:
        return max(1, int(raw))
    except ValueError:
        return 1


def md_escape_cell(s: str) -> str:
    s = s.replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    s = s.replace("|", "\\|")
    return s.strip()


def cell_text(tc: ET.Element) -> str:
    """提取单元格内全部 w:t 文本（含嵌套段落）。"""
    chunks: list[str] = []
    for node in tc.iter():
        if node.tag == q("t") and node.text:
            chunks.append(node.text)
        if node.tag == q("t") and node.tail:
            chunks.append(node.tail)
    return md_escape_cell("".join(chunks))


def table_to_markdown(tbl: ET.Element) -> str:
    rows_out: list[list[str]] = []
    for tr in tbl.findall(q("tr")):
        row: list[str] = []
        for tc in tr.findall(q("tc")):
            txt = cell_text(tc)
            span = grid_span(tc)
            row.append(txt)
            row.extend([""] * (span - 1))
        if row:
            rows_out.append(row)

    if not rows_out:
        return ""

    max_cols = max(len(r) for r in rows_out)
    norm: list[list[str]] = []
    for r in rows_out:
        padded = r + [""] * (max_cols - len(r))
        norm.append(padded[:max_cols])

    lines: list[str] = []
    lines.append("")  # 表前空行
    header = norm[0]
    lines.append("| " + " | ".join(header) + " |")
    lines.append("| " + " | ".join(["---"] * max_cols) + " |")
    for r in norm[1:]:
        lines.append("| " + " | ".join(r) + " |")
    lines.append("")  # 表后空行
    return "\n".join(lines)


def body_to_blocks(body: ET.Element) -> list[str]:
    """按文档顺序生成块：每块为一段连续文本（单行）或整张 Markdown 表。"""
    blocks: list[str] = []
    for child in list(body):
        tag = child.tag
        if tag == q("p"):
            line = paragraph_plain_text(child)
            if line:
                blocks.append(line)
        elif tag == q("tbl"):
            md = table_to_markdown(child)
            if md.strip():
                blocks.append(md)
        # w:sectPr 等忽略
    return blocks


def docx_to_markdown_native(docx_path: Path) -> str:
    with zipfile.ZipFile(docx_path, "r") as zf:
        try:
            xml = zf.read("word/document.xml")
        except KeyError as e:
            raise RuntimeError(f"invalid docx: {docx_path}") from e

    root = ET.fromstring(xml)
    body = root.find(f".//{q('body')}")
    if body is None:
        blocks: list[str] = []
    else:
        blocks = body_to_blocks(body)

    title = docx_path.stem.replace("_", " ")
    out: list[str] = [
        f"# {title}",
        "",
        f"> 由 `{docx_path.name}` 自动转换：段落与 **表格（Markdown）** 按 Word 顺序输出；"
        f"合并单元格仅 `gridSpan` 展开列，纵向合并以原文为准；复杂版式/图示仍以 Word 为准。",
        "",
    ]

    for block in blocks:
        if block.lstrip().startswith("|"):
            out.append(block.rstrip("\n"))
            out.append("")
            continue
        line = block
        if len(line) < 80 and re.match(r"^[\d一二三四五六七八九十]+[、.．]", line):
            out.append(f"## {line}")
        else:
            out.append(line)
        out.append("")

    return "\n".join(out).rstrip() + "\n"


def docx_to_markdown_pandoc(docx_path: Path) -> str | None:
    """使用 pandoc 转为 gfm；失败返回 None。"""
    pandoc = resolve_pandoc_executable()
    if not pandoc:
        return None
    try:
        proc = subprocess.run(
            [
                pandoc,
                str(docx_path),
                "-f",
                "docx",
                "-t",
                "gfm",
                "--wrap=none",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
            check=False,
        )
    except FileNotFoundError:
        return None
    except OSError:
        return None
    except subprocess.TimeoutExpired:
        return None
    if proc.returncode != 0:
        return None
    title = docx_path.stem.replace("_", " ")
    header = (
        f"# {title}\n\n"
        f"> 由 `{docx_path.name}` 经 **pandoc** 转为 GFM；若表格异常可设 `USE_PANDOC_FOR_DOCX=0` 仅用内置解析，或对照 Word。\n\n"
    )
    return header + proc.stdout.lstrip("\ufeff")


def docx_to_markdown(docx_path: Path) -> str:
    if use_pandoc_preferred():
        pandoc_md = docx_to_markdown_pandoc(docx_path)
        if pandoc_md is not None:
            return pandoc_md
    return docx_to_markdown_native(docx_path)


def list_docx_files(folder: Path) -> list[Path]:
    return sorted(
        (p for p in folder.glob("*.docx") if not p.name.startswith("~$")),
        key=lambda p: p.name,
    )


def find_source_dir(docs: Path) -> Path | None:
    """查找含 000 号总装稿的目录（兼容目录名编码差异）。"""
    for d in sorted(docs.iterdir()):
        if not d.is_dir():
            continue
        hits = [p for p in list_docx_files(d) if p.name.startswith("000")]
        if hits:
            return d
    return None


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    docs = repo / "docs"

    if len(sys.argv) >= 2:
        src = Path(sys.argv[1]).resolve()
    else:
        found = find_source_dir(docs)
        if not found:
            print("ERROR: 未在 docs 下找到含 000*.docx 的子目录。", file=sys.stderr)
            return 1
        src = found

    if len(sys.argv) >= 3:
        out_dir = Path(sys.argv[2]).resolve()
    else:
        out_dir = (docs / "招标文件智能审阅中枢").resolve()

    out_dir.mkdir(parents=True, exist_ok=True)

    docx_files = list_docx_files(src)
    if not docx_files:
        print(f"ERROR: {src} 下无 .docx", file=sys.stderr)
        return 1

    print(f"源目录: {src}")
    print(f"输出目录: {out_dir}")
    pandoc_path = resolve_pandoc_executable()
    if not use_pandoc_preferred():
        mode = "ooxml+tables (强制内置)"
    elif pandoc_path:
        mode = "pandoc 首选（失败回退 ooxml+tables）"
    else:
        mode = "ooxml+tables (未找到 pandoc)"
    print(f"转换模式: {mode} (pandoc: {pandoc_path or '未找到'})")
    for f in docx_files:
        md_name = f.stem + ".md"
        md_path = out_dir / md_name
        try:
            text = docx_to_markdown(f)
            md_path.write_text(text, encoding="utf-8")
            print(f"OK {f.name} -> {md_path.name}")
        except Exception as e:  # noqa: BLE001
            print(f"FAIL {f.name}: {e}", file=sys.stderr)
            return 1

    index = out_dir / "INDEX.md"
    lines = [
        "# 招标文件智能审阅中枢 · 文档索引",
        "",
        "> 下列 Markdown 由同目录 `.docx` 经 `scripts/docx-hub-to-markdown.py` 转换生成（默认优先 **pandoc** GFM，失败回退内置 OOXML，**含表格**）。",
        "",
        "## 文件列表",
        "",
    ]
    for f in docx_files:
        lines.append(f"- [{f.stem}.md](./{f.stem}.md)（来源：`{f.name}`）")
    lines.append("")
    index.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {index.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
