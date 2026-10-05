"""Build the GitHub Pages copy of the site into _pages/.

GitHub Pages serves this repo at https://adriantulabut5747.github.io/parcore.com/,
i.e. one folder deeper than Netlify. The site's paths are written for the top of a
domain ("/sidebar.json", "/coc/"), so this copies site/ and puts "/parcore.com" in
front of every such path. site/ itself is never changed -- Netlify keeps using it as is.

It also turns each rule in site/_redirects (old address -> new address) into a tiny
forwarding page, because GitHub Pages has no redirect rules of its own.

Run by .github/workflows/pages.yml on every push. Locally:  python scripts/build-pages.py
"""

import re
import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SITE = REPO / "site"
OUT = REPO / "_pages"
PREFIX = "/parcore.com"
TEXT = {".html", ".js", ".css", ".json", ".xml", ".txt"}

root_names = sorted((p.name for p in SITE.iterdir()), key=len, reverse=True)
dirs = "|".join(re.escape(n) for n in root_names if (SITE / n).is_dir())
files = "|".join(re.escape(n) for n in root_names if (SITE / n).is_file())

# "/" + a real root folder followed by "/", or "/" + a real root file followed by an
# end character -- only after a quote, "(", "=" or whitespace, so it is the start of
# a path and never the middle of one.
PATH_RE = re.compile(r"""(?<=["'`(=\s])/(?=(?:""" + dirs + r""")/|(?:""" + files + r""")(?=["'`?#)\s]))""")
# links to the home page itself: href="/" and JSON "link": "/" / "href": "/"
HOME_RE = re.compile(r"""((?:\bhref=|"(?:link|href)"\s*:\s*)(["']))/(\2)""")


def rewrite(text):
    text = PATH_RE.sub(PREFIX + "/", text)
    text = HOME_RE.sub(lambda m: m.group(1) + PREFIX + "/" + m.group(3), text)
    return text


def stub(target):
    t = PREFIX + target
    return (
        "<!doctype html><meta charset=\"utf-8\"><title>Moved</title>"
        f"<meta http-equiv=\"refresh\" content=\"0; url={t}\">"
        f"<link rel=\"canonical\" href=\"{t}\">"
        f"<script>location.replace({t!r} + ({'' if '?' in t else 'location.search + '}location.hash))</script>"
        f"<p>This page moved to <a href=\"{t}\">{t}</a>.</p>\n"
    )


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SITE, OUT, ignore=shutil.ignore_patterns("_redirects"))

    changed = 0
    for p in OUT.rglob("*"):
        if p.is_file() and p.suffix.lower() in TEXT:
            s = p.read_text(encoding="utf-8", errors="surrogateescape")
            s2 = rewrite(s)
            if s2 != s:
                p.write_text(s2, encoding="utf-8", errors="surrogateescape")
                changed += 1

    stubs = 0
    for line in (SITE / "_redirects").read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) < 2 or line.lstrip().startswith("#"):
            continue
        src, target = parts[0], parts[1]
        rel = src.lstrip("/")
        if not rel:
            continue
        # "/old" and "/old.html" both land on old.html; "/folder/" on folder/index.html
        dest = OUT / (rel + "index.html" if rel.endswith("/") else rel if rel.endswith(".html") else rel + ".html")
        if dest.exists():
            continue  # a real page wins
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(stub(target), encoding="utf-8")
        stubs += 1

    (OUT / ".nojekyll").write_text("", encoding="utf-8")  # serve files as they are
    print(f"_pages built: {changed} files re-pathed, {stubs} forwarding pages")


if __name__ == "__main__":
    main()
