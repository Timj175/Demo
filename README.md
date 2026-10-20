# Tim Jones: Portfolio

A single scrolling page that shows the apps and tools I have built, with real screen recordings of each one running behind the chapter cards. Each chapter is tagged **AI-backed**, **AI-ready, not dependent** or **Non-AI**, and **Tool**, **App** or **Flagship app**. The page has a filter for each AI tag, and the chapters are grouped as productivity builds first, then enterprise and product builds.

**Live site:** https://timj175.github.io/Demo/

Built to support an application for a GenAI Engineer role. It is about what I can build and ship, with AI and without it.

## What is in here

| Path | What it is |
|---|---|
| `index.html` | The portfolio page. Opens in any browser, no build step. |
| `site.js` | Scene switching as you scroll, the All / AI-backed / AI-ready / Non-AI filter, video sync. |
| `assets/` | Demo recordings (MP4) with poster images, the training deck PDF and slide stills. |
| `demos/folder-diff/` | Folder Reader + Diff. Compares two folders entirely in the browser. |
| `demos/markdown-viewer/` | Markdown Viewer Enhanced. Loads its libraries from public CDNs. |
| `demos/atlas/` | The Atlas prototype, a single HTML file. Prototype status, not a finished product. |
| `.github/` | Issue and pull request templates, code owners and a link-check workflow. |
| `scripts/check_links.py` | The link check. Run it with `py scripts/check_links.py`. |

## Run it locally

Double-click `index.html`, or serve the folder so the videos and demos behave exactly as they do online. On Windows:

```
cd /d C:\Dev\portfolio-clean
py -m http.server 8000
```

Then open http://localhost:8000.

## Notes on the demos

- All footage uses invented sample data.
- Some videos show applications that are not published here. Only the three demos under `demos/` are runnable from this repository.
- Chapter tags: SympliLyfe, Atlas and the AI Admin Dashboard are AI-backed, Lucy is AI-ready but not AI-dependent, and everything else is Non-AI. The tag list and the display order are the first lines of `site.js`.
- Order: Trackd and its tools (productivity builds) come first, then Lucy, SympliLyfe and Atlas (enterprise and product builds), with SympliLyfe and Atlas as the two larger builds.
- Atlas is the v3.3.0 prototype. Language learning lives only in Atlas, not in SympliLyfe.
- Trackd is shown as its own item, followed by five of its tools as separate items: Mini, Forger, Document Editor, MS Assist and FileSearchPro.

## Updating the page

Edit text and links directly in `index.html` (search for the chapter title). Commit and push to `main`, and GitHub Pages redeploys within a minute or two. See [CHANGELOG.md](CHANGELOG.md) for what changed in each version.

## License

All rights reserved. You may view the site and run the demos to evaluate my work. You may not copy, modify, redistribute or reuse the code, recordings, deck or artwork without written permission. Full terms are in [LICENSE](LICENSE). Third-party libraries the demos load keep their own licenses, listed in [THIRD_PARTY.md](THIRD_PARTY.md).

## Contact

tim_jones175@icloud.com
