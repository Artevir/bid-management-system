import argparse
import pathlib
import re


ISSUE_RE = re.compile(
    r"^(?P<line>\d+):(?P<col>\d+)\s+(?P<severity>Error|Warning):\s+'(?P<name>[^']+)'\s+(?P<message>.+?)\s{2,}(?P<rule>@?[\w-]+/[\w-]+|prefer-const)\s*$"
)


def safe_replace_token(line: str, name: str, replacement: str) -> tuple[str, bool]:
    pat = re.compile(rf"\b{re.escape(name)}\b")
    new_line, n = pat.subn(replacement, line, count=1)
    return new_line, n > 0


def fix_prefer_const(line: str, name: str) -> tuple[str, bool]:
    pat = re.compile(rf"\blet\s+{re.escape(name)}\b")
    new_line, n = pat.subn(f"const {name}", line, count=1)
    return new_line, n > 0


def fix_unused_import_line(line: str, name: str) -> tuple[str, bool]:
    if re.search(rf"\b{re.escape(name)}\b", line) is None:
        return line, False

    if re.search(rf"\b{re.escape(name)}\s+as\s+_", line):
        return line, False

    if re.match(rf"^\s*{re.escape(name)}\s*,?\s*$", line):
        new_line, changed = safe_replace_token(line, name, f"{name} as _{name}")
        return new_line, changed

    if "import" in line and "{" in line and "}" in line:
        pat = re.compile(rf"(\{{[^}}]*?)\b{re.escape(name)}\b(?!\s+as\s+)([^}}]*\}})")
        new_line, n = pat.subn(rf"\1{name} as _{name}\2", line, count=1)
        if n > 0:
            return new_line, True

    return line, False


def fix_unused_declaration_line(line: str, name: str) -> tuple[str, bool]:
    for kw in ["const", "let", "var", "function", "class"]:
        pat = re.compile(rf"\b{kw}\s+{re.escape(name)}\b")
        new_line, n = pat.subn(f"{kw} _{name}", line, count=1)
        if n > 0:
            return new_line, True

    pat = re.compile(rf"\bcatch\s*\(\s*{re.escape(name)}\b")
    new_line, n = pat.subn(f"catch (_{name}", line, count=1)
    if n > 0:
        return new_line, True

    return line, False


def fix_unused_arg_line(line: str, name: str) -> tuple[str, bool]:
    return safe_replace_token(line, name, f"_{name}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("log_path")
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    repo_root = pathlib.Path(args.repo_root).resolve()
    log_path = (repo_root / args.log_path).resolve()
    text = log_path.read_text(encoding="utf-8", errors="ignore").splitlines()

    current_file: pathlib.Path | None = None
    changes: dict[pathlib.Path, list[tuple[int, str, str]]] = {}

    for raw in text:
        if raw.startswith("./"):
            rel = raw[2:].strip()
            current_file = (repo_root / rel).resolve()
            continue

        if current_file is None:
            continue

        m = ISSUE_RE.match(raw.strip())
        if not m:
            continue

        severity = m.group("severity")
        rule = m.group("rule")
        name = m.group("name")
        msg = m.group("message")
        line_no = int(m.group("line"))

        if severity != "Error":
            continue

        if not current_file.exists():
            continue

        lines = current_file.read_text(encoding="utf-8", errors="ignore").splitlines(keepends=True)
        if line_no < 1 or line_no > len(lines):
            continue

        original_line = lines[line_no - 1].rstrip("\n")
        new_line = original_line
        changed = False

        if rule == "prefer-const":
            new_line, changed = fix_prefer_const(original_line, name)
        elif "Allowed unused args must match" in msg:
            new_line, changed = fix_unused_arg_line(original_line, name)
        else:
            new_line, changed = fix_unused_import_line(original_line, name)
            if not changed:
                new_line, changed = fix_unused_declaration_line(original_line, name)
            if not changed:
                new_line, changed = safe_replace_token(original_line, name, f"_{name}")

        if changed and new_line != original_line:
            lines[line_no - 1] = new_line + ("\n" if lines[line_no - 1].endswith("\n") else "")
            changes.setdefault(current_file, []).append((line_no, original_line, new_line))
            if args.apply:
                current_file.write_text("".join(lines), encoding="utf-8")

    out_dir = repo_root / "docs" / "_analysis"
    out_dir.mkdir(parents=True, exist_ok=True)
    report_path = out_dir / "lint-autofix-report.tsv"
    report_lines = ["file\tline\tbefore\tafter"]
    for f, entries in sorted(changes.items(), key=lambda x: str(x[0])):
        for line_no, before, after in entries:
            report_lines.append(f"{f.relative_to(repo_root)}\t{line_no}\t{before}\t{after}")
    report_path.write_text("\n".join(report_lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
