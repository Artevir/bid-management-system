#!/usr/bin/env python3
"""
TC3-W8-003: 三类示例项目可用性校验与联调引用门禁（可用于 CI 阻断）

功能：
1) 从 src/db/seed.ts 提取 W8-002 三类示例项目定义。
2) 校验 README 里是否存在一键初始化片段（含示例 projectCode 引用）。
3) --write: 更新快照 contracts/tender-center-w8-sample-projects.json 并生成附录 J。
4) --check: 若与快照不一致或 README 片段缺失，返回非 0（CI 阻断）。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


README_SNIPPET_START = "<!-- TC3-W8-003:START -->"
README_SNIPPET_END = "<!-- TC3-W8-003:END -->"

SCENARIO_RE = re.compile(
    r"""
    \{
    \s*scenario:\s*'(?P<scenario>complete|conflict|replay)',
    \s*code:\s*'(?P<code>TC3-W8-002-[A-Z]+-20260415)',
    \s*projectName:\s*'[^']+',
    \s*projectStatus:\s*'(?P<projectStatus>[^']+)',
    \s*interpretationStatus:\s*'(?P<interpretationStatus>[^']+)',
    \s*reviewStatus:\s*'(?P<reviewStatus>[^']+)',
    \s*parseProgress:\s*(?P<parseProgress>\d+),
    \s*parseError:\s*(?P<parseError>null|'[^']*'),
    \s*extractAccuracy:\s*(?P<extractAccuracy>\d+),
    \s*checklistCount:\s*(?P<checklistCount>\d+),
    """,
    re.VERBOSE | re.DOTALL,
)


@dataclass(frozen=True)
class ScenarioDef:
    scenario: str
    code: str
    projectStatus: str
    interpretationStatus: str
    reviewStatus: str
    parseProgress: int
    hasParseError: bool
    extractAccuracy: int
    checklistCount: int


def extract_scenarios(seed_text: str) -> list[ScenarioDef]:
    matches = list(SCENARIO_RE.finditer(seed_text))
    scenarios: list[ScenarioDef] = []
    for m in matches:
        raw_parse_error = m.group("parseError")
        scenarios.append(
            ScenarioDef(
                scenario=m.group("scenario"),
                code=m.group("code"),
                projectStatus=m.group("projectStatus"),
                interpretationStatus=m.group("interpretationStatus"),
                reviewStatus=m.group("reviewStatus"),
                parseProgress=int(m.group("parseProgress")),
                hasParseError=raw_parse_error != "null",
                extractAccuracy=int(m.group("extractAccuracy")),
                checklistCount=int(m.group("checklistCount")),
            )
        )
    scenarios.sort(key=lambda x: x.scenario)
    return scenarios


def get_readme_snippet(readme_text: str) -> str | None:
    start = readme_text.find(README_SNIPPET_START)
    end = readme_text.find(README_SNIPPET_END)
    if start < 0 or end < 0 or end <= start:
        return None
    return readme_text[start + len(README_SNIPPET_START) : end].strip()


def validate_readme_snippet(snippet: str | None, codes: list[str]) -> list[str]:
    issues: list[str] = []
    if snippet is None:
        return ["README 缺少 TC3-W8-003 一键初始化片段标记（START/END）"]

    required_tokens = [
        "pnpm db:init",
        "pnpm run docs:v3-w8-sample-projects:check",
        "/api/tender-center/projects?keyword=TC3-W8-002",
    ]
    for token in required_tokens:
        if token not in snippet:
            issues.append(f"README 片段缺少关键命令/引用：{token}")

    for code in codes:
        if code not in snippet:
            issues.append(f"README 片段未包含示例 projectCode：{code}")

    return issues


def write_report(
    repo: Path,
    *,
    generated_at: str,
    scenarios: list[ScenarioDef],
    check_ok: bool | None,
    drift_issues: list[str],
    readme_issues: list[str],
) -> None:
    out = (
        repo
        / "docs"
        / "招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0-附录J-W8-003-三类示例项目可用性与联调引用门禁.md"
    )

    lines: list[str] = [
        "# 附录 J：W8-003 三类示例项目可用性与联调引用门禁（自动）",
        "",
        f"> 生成时间（UTC）：{generated_at}  ",
        "> 规则来源：`src/db/seed.ts`（W8-002 场景定义）与 `README.md`（W8-003 一键初始化片段）。",
        "",
        "| 指标 | 数值 |",
        "|------|------|",
        f"| W8 场景数量 | {len(scenarios)} |",
        f"| 含 parseError 场景数 | {sum(1 for s in scenarios if s.hasParseError)} |",
        "",
    ]

    if check_ok is True:
        lines.extend(["- 校验状态：`PASS`（可用于联调引用）", ""])
    elif check_ok is False:
        lines.extend(["- 校验状态：`FAIL`（门禁阻断）", ""])

    lines.extend(
        [
            "## J.1 场景清单",
            "",
            "| 场景 | projectCode | projectStatus | interpretationStatus | reviewStatus | parseProgress | hasParseError |",
            "|------|-------------|---------------|----------------------|--------------|---------------|---------------|",
        ]
    )
    for item in scenarios:
        lines.append(
            f"| `{item.scenario}` | `{item.code}` | `{item.projectStatus}` | `{item.interpretationStatus}` | "
            f"`{item.reviewStatus}` | {item.parseProgress} | {'☑' if item.hasParseError else '□'} |"
        )
    lines.append("")

    lines.extend(["## J.2 差异与风险", ""])
    if not drift_issues and not readme_issues:
        lines.append("- 无差异，快照与 README 片段均满足门禁要求。")
        lines.append("")
    else:
        if drift_issues:
            lines.append("### J.2.1 快照漂移")
            lines.append("")
            for issue in drift_issues:
                lines.append(f"- {issue}")
            lines.append("")
        if readme_issues:
            lines.append("### J.2.2 README 片段缺陷")
            lines.append("")
            for issue in readme_issues:
                lines.append(f"- {issue}")
            lines.append("")

    lines.extend(
        [
            "## J.3 命令",
            "",
            "- 更新快照与附录：`pnpm run docs:v3-w8-sample-projects:update`",
            "- 校验门禁（CI）：`pnpm run docs:v3-w8-sample-projects:check`",
            "",
        ]
    )
    out.write_text("\n".join(lines), encoding="utf-8")


def diff_scenarios(current: list[dict[str, Any]], saved: list[dict[str, Any]]) -> list[str]:
    cur_by_scenario = {str(x.get("scenario")): x for x in current}
    saved_by_scenario = {str(x.get("scenario")): x for x in saved}

    issues: list[str] = []
    cur_keys = set(cur_by_scenario.keys())
    saved_keys = set(saved_by_scenario.keys())
    for missing in sorted(cur_keys - saved_keys):
        issues.append(f"快照缺少场景：{missing}")
    for extra in sorted(saved_keys - cur_keys):
        issues.append(f"快照包含多余场景：{extra}")

    for key in sorted(cur_keys & saved_keys):
        cur = cur_by_scenario[key]
        old = saved_by_scenario[key]
        for field in (
            "code",
            "projectStatus",
            "interpretationStatus",
            "reviewStatus",
            "parseProgress",
            "hasParseError",
            "extractAccuracy",
            "checklistCount",
        ):
            if cur[field] != old.get(field):
                issues.append(f"场景 {key} 字段 {field} 漂移：current={cur[field]!r}, saved={old.get(field)!r}")
    return issues


def build_current(repo: Path) -> tuple[dict[str, Any], list[str]]:
    seed_file = repo / "src" / "db" / "seed.ts"
    readme_file = repo / "README.md"

    seed_text = seed_file.read_text(encoding="utf-8", errors="replace")
    readme_text = readme_file.read_text(encoding="utf-8", errors="replace")

    scenarios = extract_scenarios(seed_text)
    if len(scenarios) == 0:
        raise RuntimeError("未在 seed.ts 中提取到 W8-002 场景定义")

    codes = [x.code for x in scenarios]
    readme_issues = validate_readme_snippet(get_readme_snippet(readme_text), codes)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    payload = {
        "version": 1,
        "generatedAt": generated_at,
        "source": "W8-002 seed scenarios + README snippet",
        "scenarios": [asdict(x) for x in scenarios],
    }
    return payload, readme_issues


def strip_runtime_fields(data: dict[str, Any]) -> dict[str, Any]:
    clone = json.loads(json.dumps(data))
    clone.pop("generatedAt", None)
    return clone


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="更新快照与附录")
    parser.add_argument("--check", action="store_true", help="校验快照/README 是否满足门禁")
    args = parser.parse_args()
    if not args.write and not args.check:
        parser.error("must specify --write or --check")

    repo = Path(__file__).resolve().parents[1]
    snapshot_file = repo / "contracts" / "tender-center-w8-sample-projects.json"
    snapshot_file.parent.mkdir(parents=True, exist_ok=True)

    current, readme_issues = build_current(repo)
    scenarios = [ScenarioDef(**x) for x in current["scenarios"]]

    if args.write:
        snapshot_file.write_text(
            json.dumps(current, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        write_report(
            repo,
            generated_at=current["generatedAt"],
            scenarios=scenarios,
            check_ok=len(readme_issues) == 0,
            drift_issues=[],
            readme_issues=readme_issues,
        )
        print(f"Wrote {snapshot_file.relative_to(repo)}")
        if readme_issues:
            print("W8-003 snapshot updated, but README snippet has issues:", file=sys.stderr)
            for issue in readme_issues:
                print(f"- {issue}", file=sys.stderr)
            return 1
        return 0

    if not snapshot_file.is_file():
        write_report(
            repo,
            generated_at=current["generatedAt"],
            scenarios=scenarios,
            check_ok=False,
            drift_issues=["快照文件不存在，请先执行 --write"],
            readme_issues=readme_issues,
        )
        print("Snapshot not found. Run with --write first.", file=sys.stderr)
        return 2

    saved = json.loads(snapshot_file.read_text(encoding="utf-8"))
    cur_n = strip_runtime_fields(current)
    saved_n = strip_runtime_fields(saved)
    drift_issues = diff_scenarios(cur_n["scenarios"], saved_n.get("scenarios", []))
    ok = len(drift_issues) == 0 and len(readme_issues) == 0
    write_report(
        repo,
        generated_at=current["generatedAt"],
        scenarios=scenarios,
        check_ok=ok,
        drift_issues=drift_issues,
        readme_issues=readme_issues,
    )
    if ok:
        print("W8-003 sample projects gate passed.")
        return 0

    print("W8-003 sample projects gate failed.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
