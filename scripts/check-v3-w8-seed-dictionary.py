#!/usr/bin/env python3
"""
TC3-W8-001: seed 字典与 030 键值对自动 diff（可用于 CI 阻断）

功能：
1) 从 030 文档自动提取字典键与枚举值。
2) 与仓库快照 contracts/tender-center-w8-seed-dictionary.json 比较。
3) --write: 更新快照并生成附录 I 报告。
4) --check: 若与快照不一致返回非 0，生成附录 I 报告。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


HEADING_RE = re.compile(r"^\*\*(\d+\.\d+)\s+[^*\n]*\s([a-z_]+)\*\*$", re.MULTILINE)
NEXT_HEADING_RE = re.compile(r"^\*\*(\d+\.\d+)\s+", re.MULTILINE)
VALUE_RE = re.compile(r"^-\s+([a-z][a-z0-9_]*)", re.MULTILINE)


def parse_030_dictionaries(text: str) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    all_matches = list(HEADING_RE.finditer(text))
    matches = [
        m
        for m in all_matches
        if 5 <= int(m.group(1).split(".")[0]) <= 12
    ]
    for index, match in enumerate(matches):
        dict_code = match.group(2)
        block_start = match.end()
        block_end = len(text)
        if index + 1 < len(matches):
            block_end = matches[index + 1].start()
        else:
            next_heading = NEXT_HEADING_RE.search(text, block_start)
            if next_heading:
                block_end = next_heading.start()
        block = text[block_start:block_end]
        values = sorted(set(v.group(1) for v in VALUE_RE.finditer(block)))
        if values:
            result[dict_code] = values
    return dict(sorted(result.items(), key=lambda x: x[0]))


def strip_runtime_fields(data: dict[str, Any]) -> dict[str, Any]:
    clone = json.loads(json.dumps(data))
    clone.pop("generatedAt", None)
    return clone


def diff_dicts(current: dict[str, list[str]], saved: dict[str, list[str]]) -> dict[str, Any]:
    cur_keys = set(current.keys())
    saved_keys = set(saved.keys())
    missing_keys = sorted(cur_keys - saved_keys)
    extra_keys = sorted(saved_keys - cur_keys)
    drift: list[dict[str, Any]] = []
    for key in sorted(cur_keys & saved_keys):
        cur_vals = current[key]
        saved_vals = saved[key]
        cur_set = set(cur_vals)
        saved_set = set(saved_vals)
        missing_values = sorted(cur_set - saved_set)
        extra_values = sorted(saved_set - cur_set)
        order_changed = cur_vals != saved_vals and not missing_values and not extra_values
        if missing_values or extra_values or order_changed:
            drift.append(
                {
                    "dictionary": key,
                    "missingValues": missing_values,
                    "extraValues": extra_values,
                    "orderChanged": order_changed,
                    "currentSize": len(cur_vals),
                    "savedSize": len(saved_vals),
                }
            )
    return {
        "missingKeys": missing_keys,
        "extraKeys": extra_keys,
        "valueDrift": drift,
    }


def write_markdown_report(
    repo: Path,
    current: dict[str, Any],
    saved: dict[str, Any] | None,
    diff: dict[str, Any] | None,
    check_ok: bool | None,
) -> None:
    out = (
        repo
        / "docs"
        / "招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0-附录I-W8-001-seed字典与030键值对核对.md"
    )

    current_dicts = current["dictionaries"]
    total_dicts = len(current_dicts)
    total_values = sum(len(v) for v in current_dicts.values())

    lines = [
        "# 附录 I：W8-001 seed 字典与 030 键值对核对（自动）",
        "",
        f"> 生成时间（UTC）：{current['generatedAt']}  ",
        "> 规则来源：`docs/招标文件智能审阅中枢/030...md` 与 `contracts/tender-center-w8-seed-dictionary.json`。",
        "",
        "| 指标 | 数值 |",
        "|------|------|",
        f"| 030 字典项总数 | {total_dicts} |",
        f"| 030 枚举值总数 | {total_values} |",
    ]

    if saved is not None:
        saved_dicts = saved.get("dictionaries", {})
        saved_total_values = sum(len(v) for v in saved_dicts.values())
        lines.extend(
            [
                f"| 快照字典项总数 | {len(saved_dicts)} |",
                f"| 快照枚举值总数 | {saved_total_values} |",
            ]
        )

    lines.append("")
    if check_ok is True:
        lines.append("- 校验状态：`PASS`（seed 快照与 030 一致）")
        lines.append("")
    elif check_ok is False:
        lines.append("- 校验状态：`FAIL`（seed 快照与 030 不一致，CI 应阻断）")
        lines.append("")

    if diff:
        lines.extend(["## I.1 差异摘要", "", "| 类型 | 数量 |", "|------|------|"])
        lines.append(f"| 缺失字典键（030 有 / seed 无） | {len(diff['missingKeys'])} |")
        lines.append(f"| 多余字典键（seed 有 / 030 无） | {len(diff['extraKeys'])} |")
        lines.append(f"| 字典值漂移 | {len(diff['valueDrift'])} |")
        lines.append("")

        if diff["missingKeys"]:
            lines.extend(["### I.1.1 缺失字典键", ""])
            for key in diff["missingKeys"]:
                lines.append(f"- `{key}`")
            lines.append("")

        if diff["extraKeys"]:
            lines.extend(["### I.1.2 多余字典键", ""])
            for key in diff["extraKeys"]:
                lines.append(f"- `{key}`")
            lines.append("")

        if diff["valueDrift"]:
            lines.extend(
                [
                    "### I.1.3 字典值漂移",
                    "",
                    "| 字典键 | 缺失值 | 多余值 | 顺序变化 |",
                    "|--------|--------|--------|----------|",
                ]
            )
            for item in diff["valueDrift"]:
                lines.append(
                    "| `{k}` | `{m}` | `{e}` | {o} |".format(
                        k=item["dictionary"],
                        m=", ".join(item["missingValues"]) if item["missingValues"] else "—",
                        e=", ".join(item["extraValues"]) if item["extraValues"] else "—",
                        o="☑" if item["orderChanged"] else "□",
                    )
                )
            lines.append("")

    lines.extend(
        [
            "## I.2 命令",
            "",
            "- 更新 seed 快照：`pnpm run docs:v3-w8-seed-dictionary:update`",
            "- 校验 seed 快照：`pnpm run docs:v3-w8-seed-dictionary:check`",
            "",
        ]
    )

    out.write_text("\n".join(lines), encoding="utf-8")


def build_current(repo: Path) -> dict[str, Any]:
    doc_030 = (
        repo
        / "docs"
        / "招标文件智能审阅中枢"
        / "030.招标文件智能审阅中枢状态体系、枚举字典与字段口径统一说明-20260403-V1.0.md"
    )
    text = doc_030.read_text(encoding="utf-8", errors="replace")
    dictionaries = parse_030_dictionaries(text)
    return {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "source": "030 状态体系与字典文档",
        "dictionaries": dictionaries,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="更新快照文件")
    parser.add_argument("--check", action="store_true", help="校验快照是否与 030 一致")
    args = parser.parse_args()

    if not args.write and not args.check:
        parser.error("must specify --write or --check")

    repo = Path(__file__).resolve().parents[1]
    snapshot_file = repo / "contracts" / "tender-center-w8-seed-dictionary.json"
    snapshot_file.parent.mkdir(parents=True, exist_ok=True)

    current = build_current(repo)

    if args.write:
        snapshot_file.write_text(
            json.dumps(current, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        write_markdown_report(repo, current, current, None, True)
        print(f"Wrote {snapshot_file.relative_to(repo)}")
        return 0

    if not snapshot_file.is_file():
        write_markdown_report(repo, current, None, None, False)
        print("Snapshot not found. Run with --write first.", file=sys.stderr)
        return 2

    saved = json.loads(snapshot_file.read_text(encoding="utf-8"))
    cur_n = strip_runtime_fields(current)
    saved_n = strip_runtime_fields(saved)
    diff = diff_dicts(cur_n["dictionaries"], saved_n["dictionaries"])
    ok = (
        len(diff["missingKeys"]) == 0
        and len(diff["extraKeys"]) == 0
        and len(diff["valueDrift"]) == 0
    )
    write_markdown_report(repo, current, saved, diff, ok)
    if ok:
        print("W8-001 seed dictionary check passed.")
        return 0

    print("W8-001 seed dictionary drift detected.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
