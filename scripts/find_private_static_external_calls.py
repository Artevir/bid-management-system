import pathlib
import re


def iter_ts_files(root: pathlib.Path) -> list[pathlib.Path]:
    return [p for p in root.rglob("*.ts") if "node_modules" not in str(p)]


def find_private_static_methods(text: str) -> list[tuple[int, str]]:
    return [(m.start(), m.group(1)) for m in re.finditer(r"\bprivate\s+static\s+(\w+)\s*\(", text)]


def find_enclosing_class_name(text: str, pos: int) -> str | None:
    before = text[:pos]
    matches = list(re.finditer(r"\bclass\s+(\w+)\b", before))
    return matches[-1].group(1) if matches else None


def main() -> None:
    src_root = pathlib.Path("src")
    files = iter_ts_files(src_root)
    texts: dict[pathlib.Path, str] = {
        p: p.read_text(encoding="utf-8", errors="ignore") for p in files
    }

    rows: list[tuple[str, str, str, str]] = []

    for p, text in texts.items():
        for pos, method in find_private_static_methods(text):
            cls = find_enclosing_class_name(text, pos)
            if not cls:
                continue
            pat = re.compile(rf"\b{re.escape(cls)}\s*\.\s*{re.escape(method)}\s*\(")
            for op, otxt in texts.items():
                if op == p:
                    continue
                if pat.search(otxt):
                    rows.append((str(p), cls, method, str(op)))
                    break

    out_dir = pathlib.Path("docs") / "_analysis"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "private-static-external-calls.tsv"
    out_path.write_text(
        "decl_file\tclass\tmethod\tused_in\n"
        + "\n".join("\t".join(r) for r in rows)
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()

