"""Fail if index.html or a demo points at a local file that does not exist."""
import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parent.parent
bad = []
for page in [root / "index.html", *root.glob("demos/*/index.html")]:
    html = page.read_text(encoding="utf-8", errors="ignore")
    for ref in re.findall(r'(?:href|src|poster)="([^"]+)"', html):
        if "${" in ref or re.match(r"(https?:|mailto:|#|data:|//|/_)", ref):
            continue
        target = (page.parent / ref.split("#")[0].split("?")[0]).resolve()
        if not target.exists():
            bad.append(f"{page.relative_to(root)} -> {ref}")
if bad:
    print("Missing local files:")
    print("\n".join(bad))
    sys.exit(1)
print("All local links resolve.")
