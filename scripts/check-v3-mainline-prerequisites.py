#!/usr/bin/env python3
"""
按 160 主链路（项目 -> 上传 -> 解析 -> 对象 -> 风险 -> 复核 -> 快照）检查
040 规划接口在当前代码中的 method+path 可用性，生成附录 D。
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path


def normalize_path(path: str) -> str:
    p = path.strip().rstrip(".,;)")
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


def parse_actual_routes(app_api_dir: Path, repo: Path) -> set[tuple[str, str]]:
    actual: set[tuple[str, str]] = set()
    func_pattern = re.compile(
        r"export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(",
        re.MULTILINE,
    )
    for route_file in sorted(app_api_dir.rglob("route.ts"), key=lambda p: str(p).lower()):
        text = route_file.read_text(encoding="utf-8", errors="replace")
        methods = {m.group(1).upper() for m in func_pattern.finditer(text)}
        api_path = normalize_path(route_path_to_api(route_file.relative_to(repo / "src" / "app")))
        if not api_path:
            continue
        for method in methods:
            actual.add((method, api_path))
    return actual


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    actual = parse_actual_routes(repo / "src" / "app" / "api", repo)
    out = (
        repo
        / "docs"
        / "招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0-附录D-160主链路前置接口可用性核对.md"
    )

    chain: list[tuple[str, str, str]] = [
        ("项目建立", "POST", "/api/tender-center/projects"),
        ("文件接入", "POST", "/api/tender-center/projects/[projectId]/upload"),
        ("批次解析", "POST", "/api/tender-center/projects/[projectId]/versions/[versionId]/parse"),
        ("对象查询-要求", "GET", "/api/tender-center/projects/[projectId]/versions/[versionId]/requirements"),
        ("对象查询-风险", "GET", "/api/tender-center/projects/[projectId]/versions/[versionId]/risks"),
        ("人工复核提交", "POST", "/api/tender-center/reviews"),
        ("复核完成提交", "POST", "/api/tender-center/reviews/[reviewTaskId]/submit"),
        ("快照生成", "POST", "/api/tender-center/projects/[projectId]/versions/[versionId]/snapshots"),
        ("快照查询", "GET", "/api/tender-center/projects/[projectId]/versions/[versionId]/snapshots"),
        ("快照发布后读取", "GET", "/api/tender-center/snapshots/[snapshotId]"),
    ]

    rows: list[tuple[str, str, str, bool]] = []
    for stage, method, path in chain:
        rows.append((stage, method, path, (method, path) in actual))

    available = sum(1 for _, _, _, ok in rows if ok)
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")

    lines: list[str] = [
        "# 附录 D：160 主链路前置接口可用性核对（自动生成）",
        "",
        f"> 生成时间（UTC）：{ts}  ",
        "> 规则：检查 040 主链路关键接口（method+path）是否在 `src/app/api/**/route.ts` 中有同名实现。",
        "",
        "主计划见：[招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0.md](./招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0.md)。",
        "",
        "## D.1 汇总",
        "",
        f"- 关键链路节点：`{len(rows)}`",
        f"- 当前可用节点：`{available}`",
        f"- 当前缺失节点：`{len(rows) - available}`",
        "",
        "## D.2 逐环节结果",
        "",
        "| # | 主链路环节 | Method | Path | 可用性 |",
        "|---|------------|--------|------|--------|",
    ]
    for i, (stage, method, path, ok) in enumerate(rows, 1):
        lines.append(f"| {i} | {stage} | `{method}` | `{path}` | {'☑' if ok else '□'} |")

    lines.extend(
        [
            "",
            "## D.3 说明",
            "",
            "- 本附录仅核对接口名义可用性，不替代 160 的场景化联调与业务验收。",
            "- 重新生成：`python scripts/check-v3-mainline-prerequisites.py`。",
            "",
        ]
    )

    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out.relative_to(repo)}")
    print(f"mainline_total={len(rows)} available={available}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
