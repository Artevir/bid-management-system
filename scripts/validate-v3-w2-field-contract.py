#!/usr/bin/env python3
"""
TC3-W2-002 字段级“必填/类型/枚举”自动校验器（CI 阻断）

功能：
1) 从 040 文档抽取 /api/tender-center 接口清单（method+path）。
2) 读取 src/app/api/tender-center/**/route.ts，推断请求字段契约：
   - path 参数（必填，string）
   - query 字段（类型推断）
   - body 字段（必填 + 类型 + 枚举推断）
3) 与仓库快照 contracts/tender-center-w2-field-contract.json 对比：
   - --check：若不一致返回非 0（可用于 CI 阻断）
   - --write：更新快照并产出附录 H 报告
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


TYPE_STRING = "string"
TYPE_NUMBER = "number"
TYPE_BOOLEAN = "boolean"
TYPE_DATE = "date"
TYPE_ARRAY_STRING = "array<string>"
TYPE_UNKNOWN = "unknown"


def normalize_path(path: str) -> str:
    p = path.strip().rstrip(".,;)")
    p = re.sub(r"\{([^{}]+)\}", r"[\1]", p)
    p = re.sub(r"/{2,}", "/", p)
    return p


def parse_040_endpoints(text: str) -> list[tuple[str, str]]:
    pattern = re.compile(r"\*\*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\*\*\s+(/api/tender-center/[^\s`]+)")
    seen: set[tuple[str, str]] = set()
    out: list[tuple[str, str]] = []
    for m in pattern.finditer(text):
        item = (m.group(1).upper(), normalize_path(m.group(2)))
        if item not in seen:
            seen.add(item)
            out.append(item)
    return sorted(out, key=lambda x: (x[1], x[0]))


def route_file_from_api(repo: Path, api_path: str) -> Path:
    rel = api_path.removeprefix("/api/")
    return repo / "src" / "app" / "api" / rel / "route.ts"


def extract_path_params(api_path: str) -> dict[str, dict[str, Any]]:
    params = re.findall(r"\[([^\]]+)\]", api_path)
    return {p: {"type": TYPE_STRING, "required": True} for p in sorted(set(params))}


def infer_query_type(text: str, key: str) -> str:
    patterns_number = [
        rf"parseInt\(\s*searchParams\.get\('{re.escape(key)}'\)",
        rf"Number\(\s*searchParams\.get\('{re.escape(key)}'\)",
    ]
    for pat in patterns_number:
        if re.search(pat, text):
            return TYPE_NUMBER

    if re.search(rf"searchParams\.get\('{re.escape(key)}'\)\?\.\s*split\(", text):
        return TYPE_ARRAY_STRING

    return TYPE_STRING


def infer_body_type(text: str, key: str) -> str:
    if re.search(rf"new Date\(\s*body\.{re.escape(key)}\s*\)", text):
        return TYPE_DATE
    if re.search(rf"(?:parseInt|Number)\(\s*body\.{re.escape(key)}\s*", text):
        return TYPE_NUMBER
    if re.search(rf"Boolean\(\s*body\.{re.escape(key)}\s*\)", text):
        return TYPE_BOOLEAN
    if re.search(rf"body\.{re.escape(key)}\?\.\s*split\(", text):
        return TYPE_ARRAY_STRING
    return TYPE_STRING


def infer_body_required(text: str, key: str) -> bool:
    checks = [
        rf"if\s*\(\s*!body\.{re.escape(key)}\s*\)",
        rf"if\s*\(\s*!body\.{re.escape(key)}\s*\|\|",
        rf"if\s*\(\s*body\.{re.escape(key)}\s*===\s*null\s*\)",
        rf"if\s*\(\s*body\.{re.escape(key)}\s*===\s*''\s*\)",
    ]
    return any(re.search(p, text) for p in checks)


def infer_field_enums(text: str) -> dict[str, list[str]]:
    enum_map: dict[str, set[str]] = {}

    # 1) const xxx = ['a','b']; xxx.includes(body.field)
    const_arrays: dict[str, list[str]] = {}
    for m in re.finditer(r"const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\[([^\]]+)\]", text):
        name = m.group(1)
        raw_values = re.findall(r"'([^']+)'|\"([^\"]+)\"", m.group(2))
        values = [a or b for a, b in raw_values if (a or b)]
        if values:
            const_arrays[name] = values

    for arr_name, values in const_arrays.items():
        for m in re.finditer(rf"{re.escape(arr_name)}\.includes\(\s*body\.([A-Za-z_][A-Za-z0-9_]*)\s*\)", text):
            field = m.group(1)
            enum_map.setdefault(field, set()).update(values)

    # 2) decision === 'approved' 这类字面比较
    for m in re.finditer(r"body\.([A-Za-z_][A-Za-z0-9_]*)\s*===\s*'([^']+)'", text):
        field, lit = m.group(1), m.group(2)
        enum_map.setdefault(field, set()).add(lit)
    for m in re.finditer(r"body\.([A-Za-z_][A-Za-z0-9_]*)\s*!==\s*'([^']+)'", text):
        field, lit = m.group(1), m.group(2)
        enum_map.setdefault(field, set()).add(lit)

    return {k: sorted(v) for k, v in enum_map.items() if v}


def extract_query_fields(text: str) -> dict[str, dict[str, Any]]:
    keys = sorted(set(re.findall(r"searchParams\.get\('([^']+)'\)", text)))
    out: dict[str, dict[str, Any]] = {}
    for k in keys:
        out[k] = {"type": infer_query_type(text, k), "required": False}
    return out


def extract_body_fields(text: str) -> dict[str, dict[str, Any]]:
    body_fields: set[str] = set()

    # 解构写法
    for m in re.finditer(r"const\s+\{([^}]+)\}\s*=\s*body", text):
        parts = [p.strip() for p in m.group(1).split(",")]
        for p in parts:
            if not p or p == "...":
                continue
            name = p.split(":")[0].strip()
            if name and re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", name):
                body_fields.add(name)

    # 直接 body.xxx
    for m in re.finditer(r"body\.([A-Za-z_][A-Za-z0-9_]*)", text):
        body_fields.add(m.group(1))

    enums = infer_field_enums(text)
    out: dict[str, dict[str, Any]] = {}
    for f in sorted(body_fields):
        node: dict[str, Any] = {
            "type": infer_body_type(text, f),
            "required": infer_body_required(text, f),
        }
        if f in enums:
            node["enum"] = enums[f]
        out[f] = node
    return out


def build_contract(repo: Path) -> dict[str, Any]:
    doc_040 = (
        repo
        / "docs"
        / "招标文件智能审阅中枢"
        / "040.招标文件智能审阅中枢标准接口清单、输入输出结构与对象视图映射总表-20260403-V1.0.md"
    )
    endpoints = parse_040_endpoints(doc_040.read_text(encoding="utf-8", errors="replace"))

    contracts: list[dict[str, Any]] = []
    for method, api_path in endpoints:
        route = route_file_from_api(repo, api_path)
        if not route.is_file():
            contracts.append(
                {
                    "method": method,
                    "path": api_path,
                    "routeFile": None,
                    "exists": False,
                    "request": {"path": extract_path_params(api_path), "query": {}, "body": {}},
                }
            )
            continue

        text = route.read_text(encoding="utf-8", errors="replace")
        exported_methods = set(
            re.findall(
                r"export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(",
                text,
            )
        )
        contracts.append(
            {
                "method": method,
                "path": api_path,
                "routeFile": route.relative_to(repo).as_posix(),
                "exists": True,
                "methodImplemented": method in exported_methods,
                "request": {
                    "path": extract_path_params(api_path),
                    "query": extract_query_fields(text),
                    "body": extract_body_fields(text),
                },
            }
        )

    return {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "source": "040 + src/app/api/tender-center/**/route.ts",
        "contracts": contracts,
    }


def strip_runtime_fields(data: dict[str, Any]) -> dict[str, Any]:
    clone = json.loads(json.dumps(data))
    clone.pop("generatedAt", None)
    return clone


def write_markdown_report(repo: Path, contract: dict[str, Any], check_ok: bool | None) -> None:
    out = (
        repo
        / "docs"
        / "招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0-附录H-W2-002-字段级必填类型枚举自动校验.md"
    )
    contracts = contract["contracts"]
    total = len(contracts)
    exist = sum(1 for c in contracts if c["exists"])
    method_impl = sum(1 for c in contracts if c.get("methodImplemented"))

    type_count = 0
    enum_count = 0
    required_count = 0
    for c in contracts:
        req = c["request"]
        for group in ("path", "query", "body"):
            for field in req[group].values():
                if field.get("type"):
                    type_count += 1
                if field.get("required"):
                    required_count += 1
                if field.get("enum"):
                    enum_count += 1

    lines = [
        "# 附录 H：W2-002 字段级必填/类型/枚举自动校验（CI 阻断）",
        "",
        f"> 生成时间（UTC）：{contract['generatedAt']}  ",
        "> 规则来源：`040` 接口清单 + `src/app/api/tender-center/**/route.ts` 自动推断。",
        "",
        "| 指标 | 数值 |",
        "|------|------|",
        f"| 040 规划接口 | {total} |",
        f"| 路由文件存在 | {exist} |",
        f"| method 已实现 | {method_impl} |",
        f"| 字段类型标注数 | {type_count} |",
        f"| 字段必填标注数 | {required_count} |",
        f"| 字段枚举标注数 | {enum_count} |",
        "",
    ]
    if check_ok is True:
        lines.append("- 校验状态：`PASS`（快照与当前代码一致）")
        lines.append("")
    elif check_ok is False:
        lines.append("- 校验状态：`FAIL`（快照与当前代码不一致，CI 应阻断）")
        lines.append("")

    lines.extend(
        [
            "## H.1 接口契约覆盖（摘要）",
            "",
            "| # | Method | Path | route存在 | method实现 | path字段 | query字段 | body字段 |",
            "|---|--------|------|-----------|------------|----------|-----------|----------|",
        ]
    )
    for i, c in enumerate(contracts, 1):
        req = c["request"]
        lines.append(
            "| {i} | `{m}` | `{p}` | {e} | {mi} | {pc} | {qc} | {bc} |".format(
                i=i,
                m=c["method"],
                p=c["path"],
                e="☑" if c["exists"] else "□",
                mi="☑" if c.get("methodImplemented") else "□",
                pc=len(req["path"]),
                qc=len(req["query"]),
                bc=len(req["body"]),
            )
        )
    lines.extend(
        [
            "",
            "## H.2 CI 命令",
            "",
            "- 更新快照（本地维护）：`pnpm docs:v3-w2-field-contract:update`",
            "- 校验快照（CI 阻断）：`pnpm docs:v3-w2-field-contract:check`",
            "",
        ]
    )
    out.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="更新快照文件")
    parser.add_argument("--check", action="store_true", help="校验快照是否与当前代码一致")
    args = parser.parse_args()

    if not args.write and not args.check:
        parser.error("must specify --write or --check")

    repo = Path(__file__).resolve().parents[1]
    snapshot_file = repo / "contracts" / "tender-center-w2-field-contract.json"
    snapshot_file.parent.mkdir(parents=True, exist_ok=True)

    current = build_contract(repo)

    if args.write:
        snapshot_file.write_text(
            json.dumps(current, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        write_markdown_report(repo, current, True)
        print(f"Wrote {snapshot_file.relative_to(repo)}")
        return 0

    if not snapshot_file.is_file():
        write_markdown_report(repo, current, False)
        print("Snapshot not found. Run with --write first.", file=sys.stderr)
        return 2

    saved = json.loads(snapshot_file.read_text(encoding="utf-8"))
    cur_n = strip_runtime_fields(current)
    saved_n = strip_runtime_fields(saved)
    ok = cur_n == saved_n
    write_markdown_report(repo, current, ok)
    if ok:
        print("W2-002 field contract check passed.")
        return 0

    print("W2-002 field contract drift detected.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
