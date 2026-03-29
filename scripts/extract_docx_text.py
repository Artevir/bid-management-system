import argparse
import pathlib
import zipfile
from xml.etree import ElementTree as ET


def extract_docx_text(path: pathlib.Path) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml")

    root = ET.fromstring(xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

    paras: list[str] = []
    for p in root.findall(".//w:p", ns):
        texts = [t.text for t in p.findall(".//w:t", ns) if t.text]
        if texts:
            paras.append("".join(texts))

    return "\n".join(paras)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", nargs="+")
    parser.add_argument("--out-dir", default=None)
    args = parser.parse_args()

    out_dir = pathlib.Path(args.out_dir) if args.out_dir else None

    expanded: list[pathlib.Path] = []
    for raw in args.inputs:
        p = pathlib.Path(raw)
        if p.exists() and p.is_dir():
            expanded.extend(sorted(p.glob("*.docx")))
            continue
        expanded.append(p)

    for path in expanded:
        if not path.exists():
            raise SystemExit(f"NOT FOUND: {path}")

        text = extract_docx_text(path)

        if out_dir:
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / (path.stem + ".txt")
            out_path.write_text(text, encoding="utf-8")
        else:
            print("=" * 80)
            print(str(path))
            print(text)


if __name__ == "__main__":
    main()
