---
id: nid_rhmr8yvxkhmhldrrqt7m5rnf4_e
title: "Run Obsidian's review lint (eslint-plugin-obsidianmd) locally"
status: open
deps: []
links: []
created_iso: 2026-10-27T17:14:26Z
status_updated_iso: 2026-10-27T17:14:26Z
type: chore
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [tooling]
---

Obsidian's plugin review rejected 0.2.0 with `obsidianmd/no-static-styles-assignment` (fixed in commit eb3af3d). We only found out at publish time because the repo has no ESLint.

Add `npm run lint` at the repo root using `eslint-plugin-obsidianmd` (the same rules the review bot runs, recommended config) over `core/src`, `core/demo` and `obsidian-plugin/src`, and run it in CI before release (`.github/workflows/release.yml`).

Known setup snags (seen 2026-10-27 in an ad-hoc run): typescript-eslint does not support TS 7, so pin TS 6 for lint (the repo uses `typescript@^6`). The plugin peer-pins `obsidian@1.8.7` while we use 1.12.3, so expect `--legacy-peer-deps` or overrides. It reads `manifest.json` from cwd, so run it from the repo root.

## Acceptance Criteria

- `npm run lint` exists and passes on main.
- Re-adding `el.style.color = 'red'` in core/src fails lint.
- The release workflow fails on lint errors.

