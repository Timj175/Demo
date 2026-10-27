# Tim Jones: Portfolio

A single scrolling page that shows the apps and tools I have built. My contact details sit at the top. Five featured builds get full-screen chapters with a real screen recording running beside each card, and the other seven sit side by side under "More builds". Each build is tagged **AI-backed**, **AI-ready, not dependent** or **Non-AI**, and **Tool**, **App** or **Flagship app**. The page has a filter for each AI tag. When a featured demo reaches an AI step it pauses, zooms in on the part of the screen involved, and shows what the AI is doing and how in a panel to the right of the demo, with Previous, Next, Continue and Skip buttons and a numbered chip for each step. On phones and tablets the demo at the top is a preview that never interrupts reading: tap it (or press Open the demo on the card) and the demo comes to the front and runs the same walk-through, and Back to reading returns to the page.

**Live site:** https://timj175.github.io/Demo/

Built to support an application for a GenAI Engineer role. It is about what I can build and ship, with AI and without it.

## What is in here

| Path | What it is |
|---|---|
| `index.html` | The portfolio page. Opens in any browser, no build step. |
| `site.js` | Scene switching as you scroll, the All / AI-backed / AI-ready / Non-AI filter, video sync, the AI-step pauses with step buttons, and demo mode on phones and tablets (tap a preview to bring the demo to the front). |
| `cues.js` | The AI steps: for each demo, the second it pauses at, the area it highlights and the text it shows. Generated from the design file. |
| `CNAME` | The custom domain for GitHub Pages. |
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
- Chapter tags: SympliLyfe, Atlas and the AI Admin Dashboard are AI-backed, Lucy is AI-ready but not AI-dependent, and everything else is Non-AI. The tag list and the featured order are the first lines of `site.js`.
- Featured, in page order: SympliLyfe, AI Admin Dashboard, Atlas, Trackd and Folder Reader + Diff. The rest (Lucy, Markdown Viewer Enhanced, Trackd Mini, Forger, Document Editor, MS Assist, FileSearchPro) are cards under "More builds".
- AI-step pauses: SympliLyfe 3, AI Admin Dashboard 3, Atlas 4. The panel docks to the right of the demo on wide screens, sits under it on mid-width screens and slides up from the bottom on phones. On phones and tablets the preview does not pause at all; the pauses run in demo mode, after a tap on the preview. The zoom is per step, not tied to scrolling. Atlas steps describe how the finished app works and say so on the panel. The clips are recordings on invented data, and each panel says whether a live model call is involved.
- The portrait in the contact card at the top is `assets/tim-jones.jpg` (720 by 900, no embedded metadata).
- Atlas is the v3.3.0 prototype. Language learning lives only in Atlas, not in SympliLyfe.
- Trackd is shown as its own featured item. Five of its tools appear as cards under "More builds": Mini, Forger, Document Editor, MS Assist and FileSearchPro.

## Updating the page

Edit text and links directly in `index.html` (search for the chapter title). Commit and push to `main`, and GitHub Pages redeploys within a minute or two.

## License

All rights reserved. You may view the site and run the demos to evaluate my work. You may not copy, modify, redistribute or reuse the code, recordings, deck or artwork without written permission. Full terms are in [LICENSE](LICENSE). Third-party libraries the demos load keep their own licenses, listed in [THIRD_PARTY.md](THIRD_PARTY.md).

## Contact

tim_jones175@icloud.com
