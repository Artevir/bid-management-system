#!/usr/bin/env python3
"""
TC3-W2-002: 040 接口 DTO 映射核对（自动草稿）

输出：
docs/招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0-附录E-W2-002-040接口DTO字段映射核对.md
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path


def normalize_doc_path(path: str) -> str:
    p = path.strip().rstrip(".,;)")
    p = re.sub(r"\{([^{}]+)\}", r"[\1]", p)
    return p


def extract_040_endpoints(text: str) -> list[tuple[str, str]]:
    pattern = re.compile(r"\*\*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\*\*\s+(/api/tender-center/[^\s`]+)")
    results: list[tuple[str, str]] = []
    for m in pattern.finditer(text):
      results.append((m.group(1), normalize_doc_path(m.group(2))))
    return results


def route_file_from_api(repo: Path, api_path: str) -> Path:
    rel = api_path.removeprefix("/api/")
    return repo / "src" / "app" / "api" / rel / "route.ts"


def extract_exported_methods(route_text: str) -> set[str]:
    pattern = re.compile(
        r"export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(",
        re.MULTILINE,
    )
    return {m.group(1) for m in pattern.finditer(route_text)}


def extract_request_hints(route_text: str) -> tuple[list[str], list[str]]:
    query_keys = sorted(set(re.findall(r"searchParams\.get\('([^']+)'\)", route_text)))

    body_fields: list[str] = []
    for m in re.finditer(r"const\s+\{([^}]+)\}\s*=\s*body", route_text):
        fields = [x.strip().split(":")[0].strip() for x in m.group(1).split(",")]
        body_fields.extend([f for f in fields if f and f != "..."])
    body_fields = sorted(set(body_fields))
    return query_keys, body_fields


def extract_response_hints(route_text: str) -> list[str]:
    keys: set[str] = set()
    for k in ("success", "data", "meta", "message", "error", "errorCode"):
        if re.search(rf"\b{k}\s*:", route_text):
            keys.add(k)
    return sorted(keys)


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    doc_040 = (
        repo
        / "docs"
        / "招标文件智能审阅中枢"
        / "040.招标文件智能审阅中枢标准接口清单、输入输出结构与对象视图映射总表-20260403-V1.0.md"
    )
    out = (
        repo
        / "docs"
        / "招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0-附录E-W2-002-040接口DTO字段映射核对.md"
    )

    endpoints = extract_040_endpoints(doc_040.read_text(encoding="utf-8", errors="replace"))
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")

    rows: list[str] = []
    implemented_count = 0
    for i, (method, api_path) in enumerate(endpoints, 1):
        route_file = route_file_from_api(repo, api_path)
        exists = route_file.is_file()
        if not exists:
            rows.append(f"| {i} | `{method}` | `{api_path}` | `—` | □ |  |  |  |")
            continue

        text = route_file.read_text(encoding="utf-8", errors="replace")
        methods = extract_exported_methods(text)
        implemented = method in methods
        if implemented:
            implemented_count += 1
        query_keys, body_fields = extract_request_hints(text)
        response_keys = extract_response_hints(text)
        rows.append(
            "| {i} | `{m}` | `{p}` | `{f}` | {ok} | `{q}` | `{b}` | `{r}` |".format(
                i=i,
                m=method,
                p=api_path,
                f=route_file.relative_to(repo).as_posix(),
                ok="☑" if implemented else "□",
                q=", ".join(query_keys) if query_keys else "—",
                b=", ".join(body_fields) if body_fields else "—",
                r=", ".join(response_keys) if response_keys else "—",
            )
        )

    lines = [
        "# 附录 E：W2-002 040 接口 DTO 字段映射核对（自动草稿）",
        "",
        f"> 生成时间（UTC）：{ts}  ",
        "> 目标：为 TC3-W2-002 提供接口级字段映射骨架（请求提示 / 响应字段提示）。",
        "",
        "| 指标 | 数值 |",
        "|------|------|",
        f"| 040 规划接口 | {len(endpoints)} |",
        f"| method 已实现接口 | {implemented_count} |",
        "",
        "## E.1 接口映射表",
        "",
        "| # | Method | Path | 路由文件 | Method实现 | Query字段提示 | Body字段提示 | 响应字段提示 |",
        "|---|--------|------|----------|------------|---------------|--------------|--------------|",
    ]
    lines.extend(rows)
    lines.extend(
        [
            "",
            "## E.2 说明",
            "",
            "- 本附录用于形成字段对照底稿，仍需人工补齐 040 的字段级必填/选填/类型/枚举约束。",
            "- 重新生成：`python scripts/check-v3-w2-dto-mapping.py`。",
            "",
        ]
    )

    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out.relative_to(repo)}")
    print(f"planned={len(endpoints)} implemented={implemented_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
