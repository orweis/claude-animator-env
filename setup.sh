#!/usr/bin/env bash
# Sets up the cartoon-3d-short skill and a Remotion project for animated shorts.
# See README.md for configuration and behaviour.
set -euo pipefail

# Pinned, security-reviewed upstream commit (full 40-char SHA; never abbreviate).
SKILL_SHA="${SKILL_SHA:-e3b817b6afc6cd413466d43f11ba31209e034bbf}"
SKILL_REPO_URL="${SKILL_REPO_URL:-https://github.com/mromidev/claude-animated-shorts.git}"
SKILL_DIR="${SKILL_DIR:-$HOME/.claude/skills/cartoon-3d-short}"
PROJECT_DIR="${PROJECT_DIR:-$HOME/remotion-shorts}"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf '[setup] %s\n' "$*"; }
die() { printf '[setup] ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

# Replace the literal text $2 with $3 in file $1. Succeeds if already applied,
# fails loudly if neither the old nor the new text is present.
patch_literal() {
  local file="$1" old="$2" new="$3" content
  [ -f "$file" ] || die "cannot patch, file missing: $file"
  content="$(cat "$file"; printf x)"
  content="${content%x}"
  if [[ "$content" == *"$new"* ]]; then
    return 0
  fi
  [[ "$content" == *"$old"* ]] || die "patch target not found in $file: $old (did the upstream skill change?)"
  printf '%s' "${content//"$old"/"$new"}" > "$file"
}

install_skill() {
  if [ -d "$SKILL_DIR/.git" ]; then
    local head
    head="$(git -C "$SKILL_DIR" rev-parse HEAD)"
    [ "$head" = "$SKILL_SHA" ] ||
      die "$SKILL_DIR is at $head, expected $SKILL_SHA. Remove it or fix it manually, then re-run."
    log "skill already at pinned commit"
    return 0
  fi
  if [ -e "$SKILL_DIR" ] && [ -n "$(ls -A "$SKILL_DIR" 2>/dev/null)" ]; then
    die "$SKILL_DIR exists but is not a git checkout; refusing to overwrite"
  fi
  mkdir -p "$(dirname "$SKILL_DIR")"
  local tmp
  tmp="$(mktemp -d "$(dirname "$SKILL_DIR")/.skill.XXXXXX")"
  git -C "$tmp" init -q
  git -C "$tmp" remote add origin "$SKILL_REPO_URL"
  git -C "$tmp" fetch -q --depth 1 --no-tags origin "$SKILL_SHA" ||
    { rm -rf "$tmp"; die "could not fetch $SKILL_SHA from $SKILL_REPO_URL"; }
  git -C "$tmp" -c advice.detachedHead=false checkout -q --detach FETCH_HEAD
  [ "$(git -C "$tmp" rev-parse HEAD)" = "$SKILL_SHA" ] ||
    { rm -rf "$tmp"; die "fetched commit does not match pinned SHA $SKILL_SHA"; }
  rm -rf "$SKILL_DIR"
  mv "$tmp" "$SKILL_DIR"
  log "installed skill at $SKILL_SHA"
}

install_python_deps() {
  if [ "${SKIP_PIP:-0}" = 1 ]; then
    log "SKIP_PIP=1, skipping python packages"
    return 0
  fi
  local req="$REPO_DIR/requirements.txt"
  if ! python3 -m pip install -q -r "$req"; then
    log "pip failed (PEP 668 externally-managed Python?); retrying with --break-system-packages"
    python3 -m pip install -q --break-system-packages -r "$req"
  fi
}

copy_if_missing() { # src dest
  [ -f "$2" ] || cp "$1" "$2"
}

setup_project() {
  mkdir -p "$PROJECT_DIR/src/videos/bridge" "$PROJECT_DIR/scripts" \
    "$PROJECT_DIR/public/bridge/kenney" "$PROJECT_DIR/out"
  cd "$PROJECT_DIR"

  if [ ! -f src/videos/bridge/Bridge.tsx ]; then
    cp "$SKILL_DIR"/templates/bridge/* src/videos/bridge/
  fi
  if [ ! -f scripts/short_qa.py ]; then
    cp "$SKILL_DIR"/templates/scripts/* scripts/
  fi

  case "$PROJECT_DIR" in
    *\"* | *\\*) die "PROJECT_DIR must not contain quotes or backslashes" ;;
  esac
  patch_literal scripts/bridge-stills.mjs \
    '"C:/Program Files/Google/Chrome/Application/chrome.exe"' \
    'process.env.BROWSER_EXECUTABLE || "/opt/pw-browsers/chromium"'
  patch_literal scripts/bridge-stills.mjs \
    '{ gl: "angle" }' \
    '{ gl: process.env.REMOTION_GL || "swangle" }'
  patch_literal scripts/bridge_merge.py \
    'os.path.expanduser("your Remotion project")' \
    "os.path.expanduser(\"$PROJECT_DIR\")"

  # Project files are only created when missing, so local edits survive re-runs.
  if [ ! -f package.json ]; then
    # The lockfile belongs to the template package.json, so they travel together.
    cp "$REPO_DIR/templates/package.json" package.json
    copy_if_missing "$REPO_DIR/templates/package-lock.json" package-lock.json
  fi
  copy_if_missing "$REPO_DIR/templates/tsconfig.json" tsconfig.json
  copy_if_missing "$REPO_DIR/templates/Root.tsx" src/Root.tsx
  copy_if_missing "$REPO_DIR/templates/index.ts" src/index.ts

  if [ "${SKIP_NPM:-0}" = 1 ]; then
    log "SKIP_NPM=1, skipping npm install"
  elif [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund --loglevel=error
  else
    npm install --no-audit --no-fund --loglevel=error
  fi
}

main() {
  require_cmd git
  [ "${SKIP_PIP:-0}" = 1 ] || require_cmd python3
  [ "${SKIP_NPM:-0}" = 1 ] || require_cmd npm
  install_python_deps
  install_skill
  setup_project
  log "done: project at $PROJECT_DIR"
}

main "$@"
