# Changelog

All notable changes to this repository are listed here. Format follows Keep a Changelog; versions follow Semantic Versioning.

## [1.3.2] - 2026-10-20

### Changed
- Atlas is now tagged AI-backed, so three items are AI-backed (SympliLyfe, Atlas, AI Admin Dashboard). Its card has a "How the AI works" write-up: guides, voice, practice, events, guardrails and fallbacks, with a status line saying the app is still being built.
- Filter counts: All 12, AI-backed 3, AI-ready 1, Non-AI 8.

## [1.3.1] - 2026-10-20

### Added
- "Why I built it" paragraph on SympliLyfe, Atlas, AI Admin Dashboard, Folder Reader + Diff, Markdown Viewer Enhanced, Forger, Document Editor, MS Assist and FileSearchPro, in my own words.
- Lucy footage now covers everything: all four quadrants (pin slots, Insights, Social) with drag between them and expand, the movable orb, the fan-out tool rail, Quick Search, the approval check, WorkSphere, Book of Work, every Add New item type, Settings, Notifications, the admin queue and full-screen chat. Lucy's card lists each of these.

### Changed
- Atlas is described as still being built. The "no server" and "seeded" wording is removed everywhere, including the Atlas demo page and the Atlas clip, which was re-recorded.
- Folder Reader + Diff and Forger no longer say "no server".
- Placeholder links and "next" rows removed. Chapters with no live demo no longer show a link.
- The dead "Download resume" buttons are removed. The header link and hero button now say Contact.
- Contact order: email buttons first, GitHub last.

## [1.3.0] - 2026-10-20

### Added
- AI Admin Dashboard chapter (AI-backed, Platform tool): one console across all apps, with a cross-provider AI Lab (OpenAI, Claude, Gemini), endpoint tester, data editor, diagnostics and health checks. New clip and poster, captioned as sample data.
- AI-backed count is now two (SympliLyfe and the AI Admin Dashboard).

### Changed
- SympliLyfe "How the AI works" expanded: model allowlist, the shared route pipeline, spending caps, emergency and moderation safety paths, privacy-safe telemetry and deterministic fallbacks.
- Hero sentence, filter counts, chapter numbering and navigation dots updated for twelve items.

## [1.2.1] - 2026-10-16

### Changed
- Responsive layout. On wide screens the card sits at the left edge and the demo fills the space beside it, so there is no empty gutter on the left. The demo scales to the window height and width.
- On narrow windows (under 1000 px wide) and on phones, the demo is pinned above the card and the card scrolls up over it. Sizes follow the window, so quarter-screen, maximised, tablet and phone all fit without horizontal scrolling.
- Training-deck slide stack scales with the window instead of using fixed pixel sizes.

## [1.2.0] - 2026-10-16

### Changed
- Atlas replaced with the v3.3.0 prototype (language journeys, light and motion layer). New demo clip and poster. The Atlas link still opens the runnable prototype in `demos/atlas/`.
- Language learning removed from SympliLyfe, because it now lives only in Atlas. The SympliLyfe clip is trimmed to drop the language and Atlas-doorway screens.
- Trackd rewritten: no server, recording or transcription wording. It now describes meeting notes and minutes linked to projects and tagged. New clip with those areas hidden. Mini, MS Assist and FileSearchPro descriptions updated to match.
- Lucy is tagged AI-ready, not dependent. A third filter, AI-ready, is added beside AI-backed and Non-AI.
- Items are grouped: productivity builds first, then enterprise and product builds, with SympliLyfe and Atlas last as the two larger builds.
- Depth card: the reading list now comes first, then a divider, then the training deck.

## [1.1.0] - 2026-10-16

### Changed
- Trackd is now a standalone item, and its tools (Mini, Forger, Document Editor, MS Assist, FileSearchPro) are separate items with their own clips. The combined toolbox reel is removed.
- Trackd is tagged Non-AI. All references to recording are removed from the page and the footage.
- Contact section shows "Personal Email" and "Professional Email" buttons instead of the addresses. LinkedIn is removed. GitHub links to this repository.
- Reading list added: Attention Is All You Need, Agentic Large Language Models, Introduction to AI Safety, Ethics and Society.

## [1.0.0] - 2026-10-16

### Added
- Standalone static portfolio page (`index.html`, `site.js`) with scroll-driven demo scenes and the All / AI-backed / Non-AI filter.
- Seven demo recordings with posters, the training deck PDF and slide stills in `assets/`.
- Runnable demos: Folder Reader + Diff, Markdown Viewer Enhanced and the Atlas prototype.
- Repository files: README, LICENSE (all rights reserved), THIRD_PARTY, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT, CHANGELOG, `.gitignore`, `.gitattributes`, `.editorconfig`, `.nojekyll`.
- `.github/`: issue templates, pull request template, code owners and a link-check workflow.
- Contact section with personal and work email and a link to this repository.
