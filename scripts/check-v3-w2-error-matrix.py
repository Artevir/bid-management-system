#!/usr/bin/env python3
"""
TC3-W2-003: tender-center 错误码与状态矩阵（自动草稿）

输出：
docs/招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0-附录F-W2-003-错误码与契约测试矩阵.md
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path


HTTP_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")


def route_path_to_api(rel: Path) -> str:
    parts: list[str] = []
    for seg in rel.parts:
        if seg == "route.ts":
            continue
        parts.append(seg)
    if not parts or parts[0] != "api":
        return ""
    return "/api/" + "/".join(parts[1:])


def extract_methods(text: str) -> list[str]:
    pattern = re.compile(
        r"export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(",
        re.MULTILINE,
    )
    return sorted(set(m.group(1) for m in pattern.finditer(text)))


def extract_statuses(text: str) -> list[int]:
    statuses = [int(x) for x in re.findall(r"\{\s*status:\s*(\d+)\s*\}", text)]
    return sorted(set(statuses))


def has_error_code(text: str) -> bool:
    return bool(re.search(r"\berrorCode\s*:", text))


def has_error_key(text: str) -> bool:
    return bool(re.search(r"\berror\s*:", text))


def uses_auth_wrapper(text: str) -> bool:
    return bool(re.search(r"\bwith(Auth|Permission|Admin|ResourcePermission)\s*\(", text))


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    routes = sorted(
        (repo / "src" / "app" / "api" / "tender-center").rglob("route.ts"),
        key=lambda p: str(p).lower(),
    )
    out = (
        repo
        / "docs"
        / "招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0-附录F-W2-003-错误码与契约测试矩阵.md"
    )

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    rows: list[str] = []
    with_error_key = 0
    with_error_code_literal = 0
    with_error_code_effective = 0

    for i, route_file in enumerate(routes, 1):
        text = route_file.read_text(encoding="utf-8", errors="replace")
        api = route_path_to_api(route_file.relative_to(repo / "src" / "app"))
        methods = extract_methods(text)
        statuses = extract_statuses(text)
        has_err = has_error_key(text)
        has_code = has_error_code(text)
        has_wrapper = uses_auth_wrapper(text)
        if has_err:
            with_error_key += 1
        if has_code:
            with_error_code_literal += 1
        # 统一改造后：若路由经过 auth 中间件，错误响应会被 middleware 归一化注入 errorCode
        if has_code or has_wrapper:
            with_error_code_effective += 1
        rows.append(
            "| {i} | `{api}` | `{methods}` | `{statuses}` | {err} | {code} | {effective} |".format(
                i=i,
                api=api,
                methods=", ".join(methods) if methods else "—",
                statuses=", ".join(str(s) for s in statuses) if statuses else "—",
                err="☑" if has_err else "□",
                code="☑" if has_code else "□",
                effective="☑" if (has_code or has_wrapper) else "□",
            )
        )

    lines = [
        "# 附录 F：W2-003 错误码与契约测试矩阵（自动草稿）",
        "",
        f"> 生成时间（UTC）：{ts}  ",
        "> 目标：统计 tender-center 路由的错误响应结构一致性（`error` / `errorCode` / HTTP status）。",
        "",
        "| 指标 | 数值 |",
        "|------|------|",
        f"| tender-center 路由文件 | {len(routes)} |",
        f"| 含 `error` 键的路由 | {with_error_key} |",
        f"| 含 `errorCode` 字面键的路由 | {with_error_code_literal} |",
        f"| 含 `errorCode`（字面或中间件归一化） | {with_error_code_effective} |",
        "",
        "## F.1 错误响应矩阵",
        "",
        "| # | API 路径 | Methods | 覆盖状态码 | 含`error`键 | 含`errorCode`字面键 | 含`errorCode`有效覆盖 |",
        "|---|----------|---------|------------|-------------|---------------------|------------------------|",
    ]
    lines.extend(rows)
    lines.extend(
        [
            "",
            "## F.2 建议（用于 TC3-W2-003 收口）",
            "",
            "- 已启用 auth 中间件统一注入 `errorCode`；建议后续逐步将业务路由也改为显式字面 `errorCode`，便于静态审计。",
            "- 按核心接口补契约测试：成功路径 + 典型 4xx（参数无效/权限不足/资源不存在）。",
            "- 重新生成：`python scripts/check-v3-w2-error-matrix.py`。",
            "",
        ]
    )

    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out.relative_to(repo)}")
    print(
        f"routes={len(routes)} with_error={with_error_key} with_errorCode_literal={with_error_code_literal} "
        f"with_errorCode_effective={with_error_code_effective}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
