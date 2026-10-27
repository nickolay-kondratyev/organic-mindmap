#!/usr/bin/env bash
# Seeds `obsidian-plugin/.dev-vault/` (git-ignored): a small vault with the BUILT plugin installed under
# `.obsidian/plugins/<id>/`. Used by the e2e harness (which copies it per run) and for manual QA
# (open the folder as a vault in Obsidian).
#
# Idempotent: fixtures and config are written only when missing (never clobber locally enriched
# notes); the plugin build files are always refreshed.
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${PLUGIN_ROOT}/.." && pwd)"
cd "${PLUGIN_ROOT}"

PLUGIN_ID="$(node -p "require('${REPO_ROOT}/manifest.json').id")"
VAULT_DIR="${PLUGIN_ROOT}/.dev-vault"
PLUGIN_DIR="${VAULT_DIR}/.obsidian/plugins/${PLUGIN_ID}"

write_if_missing() {
	local file="$1"
	if [[ -e "${file}" ]]; then
		return 0
	fi
	mkdir -p "$(dirname "${file}")"
	cat > "${file}"
}

write_if_missing "${VAULT_DIR}/Welcome.md" <<'NOTE'
# Welcome

A small vault for developing the Organic Mindmap plugin. See [[Ideas]].
NOTE

write_if_missing "${VAULT_DIR}/Ideas.md" <<'NOTE'
# Ideas

- Linked from [[Welcome]].
NOTE

write_if_missing "${VAULT_DIR}/.obsidian/app.json" <<'JSON'
{}
JSON
write_if_missing "${VAULT_DIR}/.obsidian/appearance.json" <<'JSON'
{}
JSON
write_if_missing "${VAULT_DIR}/.obsidian/community-plugins.json" <<JSON
["${PLUGIN_ID}"]
JSON

mkdir -p "${REPO_ROOT}/.tmp"
echo "setup-dev-vault: building plugin (log: .tmp/plugin-build.log)" >&2
npm run build > "${REPO_ROOT}/.tmp/plugin-build.log" 2>&1

# The repo root is the plugin folder: the build writes main.js and styles.css there, next to manifest.json.
mkdir -p "${PLUGIN_DIR}"
cp "${REPO_ROOT}/main.js" "${REPO_ROOT}/manifest.json" "${REPO_ROOT}/styles.css" "${PLUGIN_DIR}/"
echo "setup-dev-vault: plugin installed at path=[${PLUGIN_DIR}]" >&2
