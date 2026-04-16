#!/usr/bin/env python3
"""
TC3-W2-007: 导出字段与 080 口径核对（自动草稿）

输出：
docs/招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0-附录G-W2-007-导出视图与080口径核对.md
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path


def extract_080_export_view_codes(text: str) -> list[str]:
    # 表格中第二列是导出代码
    pattern = re.compile(r"\|\s*[^|]+\s*\|\s*([a-z_]+_export_view)\s*\|")
    return sorted(set(m.group(1) for m in pattern.finditer(text)))


def extract_080_snapshot_codes(text: str) -> list[str]:
    # 10.x 标题中的 snapshot 名称
    pattern = re.compile(r"\*\*10\.\d+\s+([a-z_]+_snapshot)\s+字段建议\*\*")
    return sorted(set(m.group(1) for m in pattern.finditer(text)))


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    doc_080 = (
        repo
        / "docs"
        / "招标文件智能审阅中枢"
        / "080.招标文件智能审阅中枢核心页面字段口径、对象摘要结构与导出视图总表-20260403-V1.0.md"
    )
    export_route = (
        repo
        / "src"
        / "app"
        / "api"
        / "tender-center"
        / "projects"
        / "[projectId]"
        / "versions"
        / "[versionId]"
        / "export"
        / "route.ts"
    )
    out = (
        repo
        / "docs"
        / "招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0-附录G-W2-007-导出视图与080口径核对.md"
    )

    text_080 = doc_080.read_text(encoding="utf-8", errors="replace")
    route_text = export_route.read_text(encoding="utf-8", errors="replace")

    view_codes = extract_080_export_view_codes(text_080)
    snapshot_codes = extract_080_snapshot_codes(text_080)
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")

    view_rows: list[str] = []
    snapshot_rows: list[str] = []
    view_hit = 0
    snap_hit = 0

    for i, code in enumerate(view_codes, 1):
        ok = code in route_text
        if ok:
            view_hit += 1
        view_rows.append(f"| {i} | `{code}` | {'☑' if ok else '□'} |")

    for i, code in enumerate(snapshot_codes, 1):
        ok = code in route_text
        if ok:
            snap_hit += 1
        snapshot_rows.append(f"| {i} | `{code}` | {'☑' if ok else '□'} |")

    lines = [
        "# 附录 G：W2-007 导出视图与 080 口径核对（自动草稿）",
        "",
        f"> 生成时间（UTC）：{ts}  ",
        "> 目标：核对 080 中定义的专题导出代码与 snapshot 代码是否在 `export` 接口中落地。",
        "",
        "| 指标 | 数值 |",
        "|------|------|",
        f"| 080 专题导出代码总数 | {len(view_codes)} |",
        f"| `export` 接口命中导出代码 | {view_hit} |",
        f"| 080 snapshot 代码总数 | {len(snapshot_codes)} |",
        f"| `export` 接口命中 snapshot 代码 | {snap_hit} |",
        "",
        "## G.1 专题导出代码核对",
        "",
        "| # | 导出代码 | 是否命中 `export` 接口 |",
        "|---|----------|------------------------|",
    ]
    lines.extend(view_rows)
    lines.extend(
        [
            "",
            "## G.2 标准资产 snapshot 代码核对",
            "",
            "| # | snapshot代码 | 是否命中 `export` 接口 |",
            "|---|--------------|------------------------|",
        ]
    )
    lines.extend(snapshot_rows)
    lines.extend(
        [
            "",
            "## G.3 说明",
            "",
            "- 本附录核对“代码命名覆盖”；字段级逐列一致性仍需结合 080 表项人工审阅。",
            "- 重新生成：`python scripts/check-v3-w2-export-alignment.py`。",
            "",
        ]
    )

    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out.relative_to(repo)}")
    print(f"view_codes={len(view_codes)} view_hit={view_hit} snapshot_codes={len(snapshot_codes)} snapshot_hit={snap_hit}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
