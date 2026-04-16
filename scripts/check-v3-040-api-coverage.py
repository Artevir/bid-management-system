#!/usr/bin/env python3
"""
核对 040 文档中的规划接口（method + path）与 src/app/api 真实 Route Handler 覆盖情况，
生成 docs/招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0-附录C-040接口覆盖核对.md

用法:
  python scripts/check-v3-040-api-coverage.py
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path


HTTP_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")


def normalize_path(path: str) -> str:
    p = path.strip().rstrip(".,;)")
    # 040 用 {id}，仓库路径用 [id]；统一到 [id]
    p = re.sub(r"\{([^{}]+)\}", r"[\1]", p)
    p = re.sub(r"/{2,}", "/", p)
    return p


def route_path_to_api(rel: Path) -> str:
    parts: list[str] = []
    for seg in rel.parts:
        if seg == "route.ts":
            continue
        parts.append(seg)
    if not parts or parts[0] != "api":
        return ""
    return "/api/" + "/".join(parts[1:])


def parse_planned_040(md_text: str) -> set[tuple[str, str]]:
    planned: set[tuple[str, str]] = set()
    # 例如: **POST** /api/tender-center/projects
    pattern = re.compile(r"\*\*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\*\*\s+(/api/[^\s`]+)")
    for m in pattern.finditer(md_text):
        method = m.group(1).upper()
        path = normalize_path(m.group(2))
        planned.add((method, path))
    return planned


def parse_actual_routes(app_api_dir: Path, repo: Path) -> set[tuple[str, str]]:
    actual: set[tuple[str, str]] = set()
    func_pattern = re.compile(
        r"export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(",
        re.MULTILINE,
    )
    for route_file in sorted(app_api_dir.rglob("route.ts"), key=lambda p: str(p).lower()):
        text = route_file.read_text(encoding="utf-8", errors="replace")
        methods = {m.group(1).upper() for m in func_pattern.finditer(text)}
        if not methods:
            continue
        api_path = normalize_path(route_path_to_api(route_file.relative_to(repo / "src" / "app")))
        if not api_path:
            continue
        for method in methods:
            actual.add((method, api_path))
    return actual


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    doc_040 = (
        repo
        / "docs"
        / "招标文件智能审阅中枢"
        / "040.招标文件智能审阅中枢标准接口清单、输入输出结构与对象视图映射总表-20260403-V1.0.md"
    )
    app_api = repo / "src" / "app" / "api"
    out = (
        repo
        / "docs"
        / "招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0-附录C-040接口覆盖核对.md"
    )

    planned = parse_planned_040(doc_040.read_text(encoding="utf-8", errors="replace"))
    actual = parse_actual_routes(app_api, repo)

    covered = sorted(planned & actual)
    missing = sorted(planned - actual)

    planned_paths = {p for _, p in planned}
    actual_paths = {p for _, p in actual}
    # 仅看路径层面的“候选映射”，用于人工分析 method 不同或 method 未实现场景
    path_only_hit = sorted(planned_paths & actual_paths)

    extra_tender_center = sorted(
        (m, p) for m, p in actual if p.startswith("/api/tender-center") and (m, p) not in planned
    )

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    lines: list[str] = [
        "# 附录 C：040 接口覆盖核对（自动生成）",
        "",
        f"> 生成时间（UTC）：{ts}  ",
        "> 来源：`040...总表` 中 `**METHOD** /api/...` 条目 vs `src/app/api/**/route.ts` 实际导出方法。",
        "",
        "主计划见：[招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0.md](./招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0.md)。",
        "",
        "## C.1 汇总",
        "",
        "| 指标 | 数值 |",
        "|------|------|",
        f"| 040 规划接口（method+path） | {len(planned)} |",
        f"| 仓库实际接口（method+path） | {len(actual)} |",
        f"| 已覆盖（精确 method+path） | {len(covered)} |",
        f"| 缺失（规划有、代码无） | {len(missing)} |",
        f"| 路径命中（忽略 method） | {len(path_only_hit)} |",
        f"| `tender-center` 额外实现（未在 040） | {len(extra_tender_center)} |",
        "",
        "## C.2 缺失接口（规划有、代码无）",
        "",
        "| # | Method | Path |",
        "|---|--------|------|",
    ]

    for i, (method, path) in enumerate(missing, 1):
        lines.append(f"| {i} | `{method}` | `{path}` |")

    lines.extend(
        [
            "",
            "## C.3 已覆盖接口（精确命中）",
            "",
            "| # | Method | Path |",
            "|---|--------|------|",
        ]
    )
    for i, (method, path) in enumerate(covered, 1):
        lines.append(f"| {i} | `{method}` | `{path}` |")

    lines.extend(
        [
            "",
            "## C.4 路径命中（忽略 method，仅供人工判读）",
            "",
            "| # | Path |",
            "|---|------|",
        ]
    )
    for i, path in enumerate(path_only_hit, 1):
        lines.append(f"| {i} | `{path}` |")

    if extra_tender_center:
        lines.extend(
            [
                "",
                "## C.5 额外 tender-center 接口（代码有、040 未列）",
                "",
                "| # | Method | Path |",
                "|---|--------|------|",
            ]
        )
        for i, (method, path) in enumerate(extra_tender_center, 1):
            lines.append(f"| {i} | `{method}` | `{path}` |")

    lines.extend(
        [
            "",
            "## C.6 说明",
            "",
            "- 本报告仅核对 **method+path 覆盖**，不核对 040 的字段级 DTO、错误码语义与 080 列级口径。",
            "- 路径标准化规则：`{id}` 与 `[id]` 视为同一路径；不处理 query 参数。",
            "- 重新生成：`python scripts/check-v3-040-api-coverage.py`。",
            "",
        ]
    )

    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out.relative_to(repo)}")
    print(
        f"planned={len(planned)} actual={len(actual)} covered={len(covered)} missing={len(missing)} "
        f"path_only_hit={len(path_only_hit)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
