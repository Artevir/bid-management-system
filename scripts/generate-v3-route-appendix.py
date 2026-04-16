#!/usr/bin/env python3
"""
从 src/app 扫描 page.tsx 与 api/**/route.ts，生成
docs/招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0-附录A-路由与页面清单.md

用法: python scripts/generate-v3-route-appendix.py
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path


def page_path_to_url(rel: Path) -> str:
    parts: list[str] = []
    for seg in rel.parts:
        if seg.startswith("(") and seg.endswith(")"):
            continue
        if seg == "page.tsx":
            continue
        parts.append(seg)
    if not parts:
        return "/"
    return "/" + "/".join(parts)


def route_path_to_api(rel: Path) -> str:
    parts: list[str] = []
    for seg in rel.parts:
        if seg == "route.ts":
            continue
        parts.append(seg)
    if not parts or parts[0] != "api":
        return ""
    return "/api/" + "/".join(parts[1:])


def hub_wave_for_page(url: str) -> str:
    if url.startswith("/interpretations"):
        return "W2/W5/W9"
    if url.startswith("/smart-review"):
        return "W2/W5/W9"
    if url.startswith("/projects"):
        return "W1/W5/W8/W9"
    if re.match(r"^/bid(?:/|$)", url):
        return "W2/W5/W9"
    if url.startswith("/dashboard"):
        return "W6/W9"
    if url.startswith("/tasks"):
        return "W3/W7/W9"
    if url.startswith("/workflows"):
        return "W3/W7/W9"
    if url.startswith("/exports"):
        return "W12"
    if url.startswith("/review"):
        return "W2/W9"
    if url.startswith("/tender-crawl") or url.startswith("/tender-"):
        return "W2/W6"
    if url.startswith("/approval") or url.startswith("/approvals"):
        return "W2/W5/W9"
    if url.startswith("/settings/approval"):
        return "W2/W5"
    if url.startswith("/prompts") or url.startswith("/llm"):
        return "W3/W11"
    if url.startswith("/files"):
        return "W2/W8"
    return "—（扩展域，见 000 边界）"


def hub_wave_for_api(path: str) -> str:
    if path.startswith("/api/interpretations"):
        return "W2/W4/W9"
    if path.startswith("/api/bid"):
        return "W2/W4/W11/W12"
    if path.startswith("/api/smart-review") or path.startswith("/api/matrix"):
        return "W2/W4/W9"
    if path.startswith("/api/parse"):
        return "W3/W4/W9"
    if path.startswith("/api/projects"):
        return "W1/W4/W8/W9"
    if path.startswith("/api/workflow"):
        return "W3/W7/W9"
    if path.startswith("/api/tasks"):
        return "W3/W7/W9"
    if path.startswith("/api/review"):
        return "W2/W4/W9"
    if path.startswith("/api/export") or path == "/api/export":
        return "W12"
    if path.startswith("/api/tender"):
        return "W2/W6"
    if path.startswith("/api/dashboard"):
        return "W6/W9"
    if path.startswith("/api/files"):
        return "W2/W8"
    if path.startswith("/api/batch"):
        return "W3/W9"
    if path.startswith("/api/approval"):
        return "W2/W4/W9"
    if path.startswith("/api/ai/"):  # 不含 /api/ai-governance 等连字符命名空间
        return "W3/W11"
    if path.startswith("/api/llm"):
        return "W3/W11"
    if path.startswith("/api/prompts"):
        return "W11"
    return "—"


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    app = repo / "src" / "app"
    out = (
        repo
        / "docs"
        / "招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0-附录A-路由与页面清单.md"
    )

    pages = sorted(app.rglob("page.tsx"), key=lambda p: str(p).lower())
    routes = sorted((app / "api").rglob("route.ts"), key=lambda p: str(p).lower())

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")

    lines: list[str] = [
        "# 附录 A：仓库真实路由与页面清单（自动生成草稿）",
        "",
        f"> 由 `scripts/generate-v3-route-appendix.py` 根据 `src/app` 扫描生成。**UTC 时间**: {ts}  ",
        "> **用户路径**为 Next.js App Router 推断（`(group)` 不出现在 URL；动态段保持 `[id]` 字面以便与文件路径对照）。",
        "",
        "主计划见：[招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0.md](./招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0.md)。",
        "",
        "## A.1 使用说明",
        "",
        "- **TC3 父任务**：与主计划 §五 波次对应之「建议归属」，用于 §六扩展行挂载；非裁决。",
        "- **040/050 映射**：需人工按 `docs/招标文件智能审阅中枢/040…`、`050…` 逐条填写；本附录不臆造表号。",
        "- 重新生成：在仓库根目录执行 `python scripts/generate-v3-route-appendix.py`。",
        "",
        "## A.2 页面（`page.tsx` → 推断 URL）",
        "",
        "| # | 推断用户路径 | 仓库路径 | 建议 TC3 波次 | 040/050 表项（人工填） |",
        "|---|----------------|----------|----------------|-------------------------|",
    ]

    for i, p in enumerate(pages, 1):
        rel = p.relative_to(repo).as_posix()
        url = page_path_to_url(p.relative_to(app))
        wave = hub_wave_for_page(url)
        lines.append(f"| {i} | `{url}` | `{rel}` | {wave} |  |")

    lines.extend(
        [
            "",
            "## A.3 API Route Handlers（`route.ts` → `/api/...`）",
            "",
            "### A.3.1 中枢强相关前缀（子集，便于逐项核对）",
            "",
            "下列前缀与 `招标文件智能审阅中枢开发计划.md` 第四节「中枢能力域」常见落点一致，**其余 API 仍见 A.3.2 全量**。",
            "",
            "| # | 推断 API 路径 | 仓库路径 | 建议 TC3 波次 | 040 条目（人工填） |",
            "|---|-----------------|----------|----------------|-------------------|",
        ]
    )

    hub_prefixes = (
        "/api/interpretations",
        "/api/bid",
        "/api/smart-review",
        "/api/matrix",
        "/api/parse",
        "/api/projects",
        "/api/workflow",
        "/api/workflow-instances",
        "/api/workflow-tasks",
        "/api/tasks",
        "/api/review",
        "/api/export",
        "/api/tender",
        "/api/dashboard",
        "/api/files",
        "/api/batch",
        "/api/approval",
        "/api/ai/",
        "/api/llm",
        "/api/prompts",
    )

    subset: list[tuple[str, str, str]] = []
    for p in routes:
        rel = p.relative_to(repo).as_posix()
        api = route_path_to_api(p.relative_to(app))
        if not api:
            continue
        if any(api == px or api.startswith(px + "/") for px in hub_prefixes):
            subset.append((api, rel, hub_wave_for_api(api)))

    for i, (api, rel, wave) in enumerate(sorted(subset, key=lambda x: x[0]), 1):
        lines.append(f"| {i} | `{api}` | `{rel}` | {wave} |  |")

    lines.extend(
        [
            "",
            "### A.3.2 全量 API（按路径排序）",
            "",
            "| # | 推断 API 路径 | 仓库路径 | 建议 TC3 波次 |",
            "|---|-----------------|----------|----------------|",
        ]
    )

    all_api: list[tuple[str, str, str]] = []
    for p in routes:
        rel = p.relative_to(repo).as_posix()
        api = route_path_to_api(p.relative_to(app))
        if api:
            all_api.append((api, rel, hub_wave_for_api(api)))

    for i, (api, rel, wave) in enumerate(sorted(all_api, key=lambda x: x[0]), 1):
        lines.append(f"| {i} | `{api}` | `{rel}` | {wave} |")

    lines.append("")
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out.relative_to(repo)}")
    print(f"pages={len(pages)} api_subset={len(subset)} api_all={len(all_api)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
