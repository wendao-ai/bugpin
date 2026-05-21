#!/usr/bin/env bash
#
# Install / re-install the BugPin OpenCLI adapter from this repo into
# ~/.opencli/{clis,sites}/bugpin/.
#
# Uses hard links so the files appear in ~/.opencli/ but Node's ESM
# module resolver still finds @jackwener/opencli via the global path
# (symlinks break that resolution because Node walks the real path
# upward looking for node_modules).
#
# Hard links are intentional — files share the same inode with the
# repo copy, so editing either side updates both, but `git pull` /
# `git checkout` writes new inodes and the link stops tracking. Re-run
# this script after pulling.
#
# Usage:
#   bash client-integrations/opencli/install.sh   # from repo root
#   ./install.sh                                  # from this directory

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
adapters_src="$here/adapters"
site_src="$here/site-memory"

clis_dst="$HOME/.opencli/clis/bugpin"
site_dst="$HOME/.opencli/sites/bugpin"

if [[ ! -d "$adapters_src" || ! -d "$site_src" ]]; then
  echo "[install] source layout missing: expected $adapters_src and $site_src" >&2
  exit 1
fi

echo "[install] removing previous bugpin install (if any)"
rm -rf "$clis_dst" "$site_dst"

echo "[install] creating destination layout"
mkdir -p "$clis_dst" "$site_dst/verify" "$site_dst/fixtures"

echo "[install] hard-linking adapters → $clis_dst"
for f in "$adapters_src"/*.js; do
  ln "$f" "$clis_dst/$(basename "$f")"
done

echo "[install] hard-linking site memory → $site_dst"
ln "$site_src/endpoints.json" "$site_dst/endpoints.json"
ln "$site_src/notes.md"       "$site_dst/notes.md"
for f in "$site_src/verify"/*.json; do
  [[ -e "$f" ]] && ln "$f" "$site_dst/verify/$(basename "$f")"
done
for f in "$site_src/fixtures"/*.json; do
  [[ -e "$f" ]] && ln "$f" "$site_dst/fixtures/$(basename "$f")"
done

echo "[install] verifying opencli sees the commands"
if command -v opencli >/dev/null 2>&1; then
  opencli bugpin --help 2>/dev/null | grep -E "^  (list-reports|get-report|update-report|list-files|download-file|stats)" || {
    echo "[install] WARNING: 'opencli bugpin --help' output missing expected commands"
    echo "[install] make sure opencli >= 1.7.22 is installed and doctor passes"
  }
else
  echo "[install] opencli not on PATH yet; install via:"
  echo "          npm install -g @jackwener/opencli"
fi

echo "[install] done. re-run after every git pull that touches client-integrations/opencli/"
