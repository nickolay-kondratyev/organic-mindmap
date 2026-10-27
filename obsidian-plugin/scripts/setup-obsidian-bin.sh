#!/usr/bin/env bash
# Provision a REAL Obsidian binary for the e2e suite (see e2e/obsidianHarness.ts).
#
# WHY this exists: `npm run test:e2e` drives a real Obsidian (Electron), but the
# binary is NOT an npm dependency. On Linux this downloads a PINNED Obsidian
# release once, caches it, and prints the binary path on stdout so run-e2e.sh can
# export OBSIDIAN_PATH. All progress goes to stderr so stdout stays a single clean
# path line for `$(...)` capture.
#
# WHY the tarball (not the AppImage): it extracts to a plain directory with a
# runnable `obsidian` binary; no FUSE and no `--appimage-extract`, both of which
# containers lack.
#
# Pinned on purpose: the harness is verified against this version, and a floating
# "latest" would let a new Obsidian release break e2e with NO code change. Bump the
# default deliberately; OBSIDIAN_VERSION overrides it for one run (the cache is
# keyed by version, so builds coexist).
#
# WHY-NOT an integrity checksum: Obsidian publishes a hash only for the `.asar`
# payload, not the platform tarball; `curl --fail` + `tar` validity is the 80/20 guard.
#
# Non-Linux: no auto-download (Obsidian ships .dmg/.exe, not a drop-in binary).
# Set OBSIDIAN_PATH yourself; see e2e/obsidianHarness.ts resolveObsidianPath().
set -euo pipefail

OBSIDIAN_VERSION="${OBSIDIAN_VERSION:-1.12.7}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Git-ignored, per checkout. Override with OBSIDIAN_CACHE_DIR to share one download
# across checkouts (e.g. ~/.cache/obsidian-e2e, or a Docker volume).
CACHE_DIR="${OBSIDIAN_CACHE_DIR:-${REPO_ROOT}/.tmp/obsidian-e2e/bin}"

log() { echo "setup-obsidian-bin: $*" >&2; }

if [[ "$(uname -s)" != "Linux" ]]; then
	log "auto-download is Linux-only (got $(uname -s))."
	log "Set OBSIDIAN_PATH to a local Obsidian binary and re-run. See docs/development.md."
	exit 1
fi

case "$(uname -m)" in
	x86_64 | amd64) asset="obsidian-${OBSIDIAN_VERSION}.tar.gz" ;;
	aarch64 | arm64) asset="obsidian-${OBSIDIAN_VERSION}-arm64.tar.gz" ;;
	*)
		log "unsupported arch: $(uname -m)"
		exit 1
		;;
esac

# The tarball's single top-level dir == asset name without `.tar.gz`.
binary="${CACHE_DIR}/${asset%.tar.gz}/obsidian"

if [[ -x "${binary}" ]]; then
	log "using cached binary (Obsidian ${OBSIDIAN_VERSION}) path=[${binary}]"
	echo "${binary}"
	exit 0
fi

url="https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/${asset}"
tarball="${CACHE_DIR}/${asset}"
mkdir -p "${CACHE_DIR}"

log "downloading Obsidian ${OBSIDIAN_VERSION}: ${url}"
curl --fail --location --show-error --silent --output "${tarball}" "${url}"
log "extracting ${asset}"
tar -xzf "${tarball}" -C "${CACHE_DIR}"
rm -f "${tarball}" # keep only the extracted tree, not the archive

if [[ ! -x "${binary}" ]]; then
	log "expected binary missing after extract: path=[${binary}]"
	exit 1
fi

log "ready."
echo "${binary}"
