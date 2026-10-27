---
closed_iso: 2026-10-27T16:03:38Z
id: nid_un2phbuf1oisujs5jrngzfnni_e
title: "Default map background is dark green rgb(46, 66, 58)"
status: closed
deps: []
links: []
created_iso: 2026-10-27T15:58:34Z
status_updated_iso: 2026-10-27T16:03:38Z
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_organic-mindmap/.worktree/t-un2phbuf
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [map-polish]
---


## Goal
The human wants the default map background to be RGB 46, 66, 58 (`#2e423a`, a dark green) instead of today's near-black navy `#0b1020`. Every host that does not override `theme.color.background` (the demo, the Obsidian plugin with no stored background) gets it.

## Done criteria
- `DEFAULT_THEME.theme.color.background` in `core/src/core/config/theme.ts` is `#2e423a`.
- The reference screenshot baseline (`core/e2e/reference-view.spec.ts-snapshots/`) is re-baselined for this intended visual change (from `core/`: `npx playwright test e2e/reference-view.spec.ts --update-snapshots`), and the spec passes.
- Colors derived from the old navy are checked: `theme.color.textOutline` is `rgba(11, 16, 32, 0.55)` (navy-tinted glyph outline for branch labels). Retint it to the new background only if it looks off; report what you chose.
- Legibility check against the new background (contrast ratios reported, not a gate): every default palette fill, the root fill, the link color `theme.color.link`, and white label text on the background. Flag any palette entry (e.g. sage green `#8fae7e`, teal `#3f9f9a`) that blends into the green background.
- Plugin: the settings "Restore look defaults" restores the new color (it reads `DEFAULT_CONFIG`, so it should be free); a stored background a person picked earlier stays as stored.
- Docs that name the old color are updated: `spec.md` R1 and §8 "Colors" ("near-black navy"), the comment on `DEFAULT_THEME`, `core/CHANGELOG.md` (Unreleased > Changed).
- `npm run typecheck`, `npm test`, full demo E2E and Obsidian E2E pass.

## Non-goals
- No palette redesign; only flag problems.
