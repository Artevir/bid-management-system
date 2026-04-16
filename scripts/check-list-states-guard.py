#!/usr/bin/env python3
"""
Guardrail: block new inline list tri-state JSX in src/app/**/page.tsx.

Allowed:
- <ListStateBlock ... />
- <TableListStateRow ... />

Blocked examples:
- Inline "加载失败：{error}" blocks
- Inline loading branch in list tri-state chains
- Inline empty branch with "暂无..." text
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
import sys


ROOT = Path("src/app")
PAGE_PATTERN = "page.tsx"
BASELINE_PATH = Path("scripts/list-states-guard-baseline.txt")


@dataclass
class Violation:
    file_path: Path
    line_no: int
    rule: str
    snippet: str

    def baseline_key(self) -> str:
        return f"{self.file_path.as_posix()}|{self.rule}|{self.snippet}"


def is_empty_condition_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped.endswith("? ("):
        return False
    if "length === 0" in stripped or "=== 0" in stripped:
        return True
    return stripped.startswith("!")


def collect_branch(lines: list[str], start_idx: int) -> tuple[str, int]:
    branch_lines: list[str] = []
    idx = start_idx
    while idx < len(lines):
        current = lines[idx]
        if re.search(r"^\s*\)\s*:\s*", current):
            break
        branch_lines.append(current)
        idx += 1
    return "\n".join(branch_lines), idx


def has_empty_candidate_soon(lines: list[str], from_idx: int, lookahead: int = 24) -> bool:
    end = min(len(lines), from_idx + lookahead)
    for idx in range(from_idx, end):
        line = lines[idx]
        if is_empty_condition_line(line):
            return True
        # support one-line pattern: ") : xxx.length === 0 ? ("
        if " ? (" in line and ("length === 0" in line or "=== 0" in line):
            return True
    return False


def check_file(path: Path) -> list[Violation]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    violations: list[Violation] = []

    for idx, line in enumerate(lines):
        if "加载失败：{error}" in line:
            violations.append(
                Violation(
                    file_path=path,
                    line_no=idx + 1,
                    rule="inline-error-state",
                    snippet=line.strip(),
                )
            )

        if "loading ? (" in line:
            branch_text, branch_end_idx = collect_branch(lines, idx + 1)
            if has_empty_candidate_soon(lines, branch_end_idx):
                uses_shared_component = (
                    "ListStateBlock" in branch_text or "TableListStateRow" in branch_text
                )
                looks_like_loading_ui = any(
                    token in branch_text for token in ["加载中", "Loader2", "animate-spin", "Skeleton"]
                )
                if looks_like_loading_ui and not uses_shared_component:
                    violations.append(
                        Violation(
                            file_path=path,
                            line_no=idx + 1,
                            rule="inline-loading-state",
                            snippet=line.strip(),
                        )
                    )

        if is_empty_condition_line(line):
            branch_text, _ = collect_branch(lines, idx + 1)
            has_empty_copy = "暂无" in branch_text
            uses_shared_component = (
                "ListStateBlock" in branch_text or "TableListStateRow" in branch_text
            )
            if has_empty_copy and not uses_shared_component:
                violations.append(
                    Violation(
                        file_path=path,
                        line_no=idx + 1,
                        rule="inline-empty-state",
                        snippet=line.strip(),
                    )
                )

    return violations


def main() -> int:
    write_baseline = "--write-baseline" in sys.argv

    if not ROOT.exists():
        print(f"[list-states-guard] skip: {ROOT} does not exist")
        return 0

    all_violations: list[Violation] = []
    for file_path in ROOT.rglob(PAGE_PATTERN):
        all_violations.extend(check_file(file_path))

    current_keys = sorted({v.baseline_key() for v in all_violations})

    if write_baseline:
        BASELINE_PATH.write_text("\n".join(current_keys) + ("\n" if current_keys else ""), encoding="utf-8")
        print(
            f"[list-states-guard] baseline updated: {BASELINE_PATH.as_posix()} "
            f"({len(current_keys)} records)"
        )
        return 0

    if not BASELINE_PATH.exists():
        print(
            f"[list-states-guard] missing baseline: {BASELINE_PATH.as_posix()}\n"
            "Run with --write-baseline first."
        )
        return 1

    baseline_keys = {
        line.strip()
        for line in BASELINE_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    }

    new_keys = sorted(set(current_keys) - baseline_keys)
    resolved_keys = sorted(baseline_keys - set(current_keys))

    if not new_keys:
        print(
            "[list-states-guard] pass: no new inline list tri-state JSX.\n"
            f"- baseline records: {len(baseline_keys)}\n"
            f"- current records: {len(current_keys)}\n"
            f"- resolved since baseline: {len(resolved_keys)}"
        )
        return 0

    print("[list-states-guard] failed: found NEW inline list tri-state JSX.\n")
    print(f"- baseline records: {len(baseline_keys)}")
    print(f"- current records: {len(current_keys)}")
    print(f"- new records: {len(new_keys)}\n")
    for key in new_keys:
        file_path, rule, snippet = key.split("|", 2)
        print(f"- {file_path} [{rule}] {snippet}")

    print(
        "\nUse shared components instead:\n"
        "- <ListStateBlock state=\"loading|error|empty\" ... />\n"
        "- <TableListStateRow state=\"loading|error|empty\" ... />"
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
