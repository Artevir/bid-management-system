#!/usr/bin/env python3
"""
TC3-W9-001: 四层联调检查表自动化（结构/服务/页面/业务），可用于 CI 阻断。

功能：
1) 自动执行四层联调硬断言（每层 >= 5 条）。
2) --write: 更新快照 contracts/tender-center-w9-integration-checklist.json 并生成附录 K。
3) --check: 若断言失败或与快照不一致返回非 0（CI 阻断）。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class AssertionResult:
    layer: str
    assertion_id: str
    title: str
    passed: bool
    evidence: str


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


def run_structure_assertions(repo: Path) -> list[AssertionResult]:
    schema_text = (repo / "src" / "db" / "schema.ts").read_text(encoding="utf-8", errors="replace")
    required_schema_symbols = [
        "export const bidDocumentInterpretations",
        "export const bidRequirementChecklist",
        "export const bidTechnicalSpecs",
        "export const bidScoringItems",
        "export const bidInterpretationLogs",
    ]
    required_files = [
        "src/db/seed.ts",
        "contracts/tender-center-w8-sample-projects.json",
        "scripts/check-v3-w8-sample-projects.py",
        "scripts/check-v3-mainline-prerequisites.py",
        "tests/unit/tender-center-contract.test.ts",
    ]
    results: list[AssertionResult] = []
    for i, symbol in enumerate(required_schema_symbols, 1):
        ok = symbol in schema_text
        results.append(
            AssertionResult(
                layer="结构层",
                assertion_id=f"S{i:03d}",
                title=f"Schema 包含核心对象定义：{symbol.split()[-1]}",
                passed=ok,
                evidence="src/db/schema.ts",
            )
        )
    for i, rel_file in enumerate(required_files, len(results) + 1):
        f = repo / rel_file
        ok = f.is_file()
        results.append(
            AssertionResult(
                layer="结构层",
                assertion_id=f"S{i:03d}",
                title=f"核心落地文件存在：{rel_file}",
                passed=ok,
                evidence=rel_file,
            )
        )
    return results


def run_service_assertions(repo: Path) -> list[AssertionResult]:
    actual = parse_actual_routes(repo / "src" / "app" / "api", repo)
    required_routes: list[tuple[str, str, str]] = [
        ("V001", "POST", "/api/tender-center/projects"),
        ("V002", "POST", "/api/tender-center/projects/[projectId]/upload"),
        ("V003", "POST", "/api/tender-center/projects/[projectId]/versions/[versionId]/parse"),
        ("V004", "GET", "/api/tender-center/projects/[projectId]/versions/[versionId]/requirements"),
        ("V005", "GET", "/api/tender-center/projects/[projectId]/versions/[versionId]/risks"),
        ("V006", "POST", "/api/tender-center/reviews"),
        ("V007", "POST", "/api/tender-center/reviews/[reviewTaskId]/submit"),
        ("V008", "POST", "/api/tender-center/projects/[projectId]/versions/[versionId]/snapshots"),
        ("V009", "GET", "/api/tender-center/snapshots/[snapshotId]"),
        ("V010", "POST", "/api/tender-center/risks/[riskId]/close"),
    ]
    results: list[AssertionResult] = []
    for code, method, path in required_routes:
        ok = (method, path) in actual
        results.append(
            AssertionResult(
                layer="服务层",
                assertion_id=code,
                title=f"服务接口可用：{method} {path}",
                passed=ok,
                evidence="src/app/api/tender-center/**/route.ts",
            )
        )
    return results


def run_page_assertions(repo: Path) -> list[AssertionResult]:
    required_pages: list[tuple[str, str]] = [
        ("P001", "src/app/smart-review/page.tsx"),
        ("P002", "src/app/smart-review/[id]/page.tsx"),
        ("P003", "src/app/interpretations/page.tsx"),
        ("P004", "src/app/interpretations/[id]/page.tsx"),
        ("P005", "src/app/smart-review/reviews/page.tsx"),
        ("P006", "src/app/smart-review/matrix/page.tsx"),
        ("P007", "src/app/projects/page.tsx"),
        ("P008", "src/app/projects/[id]/page.tsx"),
    ]
    results: list[AssertionResult] = []
    for code, rel in required_pages:
        ok = (repo / rel).is_file()
        results.append(
            AssertionResult(
                layer="页面层",
                assertion_id=code,
                title=f"页面入口可用：{rel}",
                passed=ok,
                evidence=rel,
            )
        )
    return results


def run_business_assertions(repo: Path) -> list[AssertionResult]:
    snapshot_file = repo / "contracts" / "tender-center-w8-sample-projects.json"
    seed_file = repo / "src" / "db" / "seed.ts"
    results: list[AssertionResult] = []

    snapshot_exists = snapshot_file.is_file()
    results.append(
        AssertionResult(
            layer="业务链路层",
            assertion_id="B001",
            title="W8 三类示例场景快照存在",
            passed=snapshot_exists,
            evidence="contracts/tender-center-w8-sample-projects.json",
        )
    )

    scenarios: list[dict[str, Any]] = []
    if snapshot_exists:
        raw = json.loads(snapshot_file.read_text(encoding="utf-8"))
        scenarios = list(raw.get("scenarios", []))

    required_codes = {
        "TC3-W8-002-COMPLETE-20260415",
        "TC3-W8-002-CONFLICT-20260415",
        "TC3-W8-002-REPLAY-20260415",
    }
    seen_codes = {str(s.get("code")) for s in scenarios}
    results.append(
        AssertionResult(
            layer="业务链路层",
            assertion_id="B002",
            title="示例场景 projectCode 完整（完整/冲突/补跑）",
            passed=required_codes.issubset(seen_codes),
            evidence="contracts/tender-center-w8-sample-projects.json.scenarios[].code",
        )
    )

    results.append(
        AssertionResult(
            layer="业务链路层",
            assertion_id="B003",
            title="示例场景数量 >= 3",
            passed=len(scenarios) >= 3,
            evidence=f"scenario_count={len(scenarios)}",
        )
    )

    has_replay_error = any(bool(s.get("hasParseError")) for s in scenarios if s.get("scenario") == "replay")
    results.append(
        AssertionResult(
            layer="业务链路层",
            assertion_id="B004",
            title="补跑场景具备 parseError 标识（用于恢复链路）",
            passed=has_replay_error,
            evidence="scenario=replay.hasParseError",
        )
    )

    seed_text = seed_file.read_text(encoding="utf-8", errors="replace")
    for code, marker in [
        ("B005", "params.scenario === 'replay' ? 'batch_replay_triggered' : 'batch_seed_initialized'"),
        ("B006", "parseError: '上轮批次部分任务超时，已触发补跑'"),
        ("B007", "code: 'TC3-W8-002-CONFLICT-20260415'"),
        ("B008", "code: 'TC3-W8-002-COMPLETE-20260415'"),
    ]:
        ok = marker in seed_text
        results.append(
            AssertionResult(
                layer="业务链路层",
                assertion_id=code,
                title=f"seed 业务链路关键标识存在：{marker[:40]}...",
                passed=ok,
                evidence="src/db/seed.ts",
            )
        )

    return results


def build_current(repo: Path) -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    layers = {
        "结构层": run_structure_assertions(repo),
        "服务层": run_service_assertions(repo),
        "页面层": run_page_assertions(repo),
        "业务链路层": run_business_assertions(repo),
    }

    serialized_layers: dict[str, list[dict[str, Any]]] = {}
    summary: dict[str, dict[str, int | bool]] = {}
    all_pass = True
    for layer, items in layers.items():
        serialized = [
            {
                "assertionId": x.assertion_id,
                "title": x.title,
                "passed": x.passed,
                "evidence": x.evidence,
            }
            for x in items
        ]
        serialized_layers[layer] = serialized
        total = len(serialized)
        passed = sum(1 for x in serialized if x["passed"])
        threshold_ok = total >= 5
        layer_ok = passed == total and threshold_ok
        summary[layer] = {
            "total": total,
            "passed": passed,
            "failed": total - passed,
            "thresholdOk": threshold_ok,
            "layerOk": layer_ok,
        }
        if not layer_ok:
            all_pass = False

    return {
        "version": 1,
        "generatedAt": generated_at,
        "source": "160 四层联调自动检查",
        "summary": summary,
        "allPassed": all_pass,
        "layers": serialized_layers,
    }


def strip_runtime_fields(data: dict[str, Any]) -> dict[str, Any]:
    clone = json.loads(json.dumps(data))
    clone.pop("generatedAt", None)
    return clone


def diff_payload(current: dict[str, Any], saved: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    c = strip_runtime_fields(current)
    s = strip_runtime_fields(saved)
    if c == s:
        return issues

    for layer in ("结构层", "服务层", "页面层", "业务链路层"):
        c_layer = c.get("layers", {}).get(layer, [])
        s_layer = s.get("layers", {}).get(layer, [])
        c_map = {x.get("assertionId"): x for x in c_layer}
        s_map = {x.get("assertionId"): x for x in s_layer}
        c_ids = set(c_map.keys())
        s_ids = set(s_map.keys())
        for missing in sorted(c_ids - s_ids):
            issues.append(f"{layer} 缺少断言：{missing}")
        for extra in sorted(s_ids - c_ids):
            issues.append(f"{layer} 多余断言：{extra}")
        for aid in sorted(c_ids & s_ids):
            c_item = c_map[aid]
            s_item = s_map[aid]
            if c_item.get("passed") != s_item.get("passed"):
                issues.append(
                    f"{layer} 断言 {aid} 结果漂移：current={c_item.get('passed')} saved={s_item.get('passed')}"
                )
    return issues


def write_report(repo: Path, current: dict[str, Any], drift_issues: list[str], check_ok: bool | None) -> None:
    out = (
        repo
        / "docs"
        / "招标文件智能审阅中枢开发计划-交付级别-20260415-V3.0-附录K-W9-001-四层联调检查表自动化.md"
    )

    lines: list[str] = [
        "# 附录 K：W9-001 四层联调检查表自动化（自动）",
        "",
        f"> 生成时间（UTC）：{current['generatedAt']}  ",
        "> 规则来源：160 分层联调原则（结构层 / 服务层 / 页面层 / 业务链路层）。",
        "",
        "## K.1 汇总",
        "",
        "| 层级 | 断言总数 | 通过数 | 失败数 | >=5条硬断言 | 层级通过 |",
        "|------|----------|--------|--------|-------------|----------|",
    ]
    for layer in ("结构层", "服务层", "页面层", "业务链路层"):
        stat = current["summary"][layer]
        lines.append(
            "| {layer} | {total} | {passed} | {failed} | {threshold} | {ok} |".format(
                layer=layer,
                total=stat["total"],
                passed=stat["passed"],
                failed=stat["failed"],
                threshold="☑" if stat["thresholdOk"] else "□",
                ok="☑" if stat["layerOk"] else "□",
            )
        )
    lines.append("")
    if check_ok is True:
        lines.extend(["- 校验状态：`PASS`（四层联调门禁通过）", ""])
    elif check_ok is False:
        lines.extend(["- 校验状态：`FAIL`（四层联调门禁阻断）", ""])

    for layer in ("结构层", "服务层", "页面层", "业务链路层"):
        lines.extend(
            [
                f"## K.{2 + ['结构层', '服务层', '页面层', '业务链路层'].index(layer)} {layer}断言",
                "",
                "| 断言ID | 断言项 | 结果 | 证据 |",
                "|--------|--------|------|------|",
            ]
        )
        for item in current["layers"][layer]:
            lines.append(
                f"| `{item['assertionId']}` | {item['title']} | {'☑' if item['passed'] else '□'} | `{item['evidence']}` |"
            )
        lines.append("")

    lines.extend(["## K.6 差异与风险", ""])
    if not drift_issues:
        lines.extend(["- 无快照漂移。", ""])
    else:
        for issue in drift_issues:
            lines.append(f"- {issue}")
        lines.append("")

    lines.extend(
        [
            "## K.7 命令",
            "",
            "- 更新快照与附录：`pnpm run docs:v3-w9-integration-checklist:update`",
            "- 校验门禁（CI）：`pnpm run docs:v3-w9-integration-checklist:check`",
            "",
        ]
    )
    out.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if not args.write and not args.check:
        parser.error("must specify --write or --check")

    repo = Path(__file__).resolve().parents[1]
    snapshot_file = repo / "contracts" / "tender-center-w9-integration-checklist.json"
    snapshot_file.parent.mkdir(parents=True, exist_ok=True)

    current = build_current(repo)
    if args.write:
        snapshot_file.write_text(
            json.dumps(current, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        write_report(repo, current, [], current["allPassed"])
        print(f"Wrote {snapshot_file.relative_to(repo)}")
        if current["allPassed"]:
            return 0
        print("W9-001 assertions failed during write.", file=sys.stderr)
        return 1

    if not snapshot_file.is_file():
        write_report(repo, current, ["快照文件不存在，请先执行 --write"], False)
        print("Snapshot not found. Run with --write first.", file=sys.stderr)
        return 2

    saved = json.loads(snapshot_file.read_text(encoding="utf-8"))
    drift_issues = diff_payload(current, saved)
    ok = current["allPassed"] and len(drift_issues) == 0
    write_report(repo, current, drift_issues, ok)
    if ok:
        print("W9-001 integration checklist gate passed.")
        return 0

    print("W9-001 integration checklist gate failed.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
