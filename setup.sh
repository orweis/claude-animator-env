#!/usr/bin/env bash
# Sets up the cartoon-3d-short skill and a Remotion project for animated shorts.
# See README.md for configuration and behaviour.
set -euo pipefail

# Pinned, security-reviewed upstream commit (full 40-char SHA; never abbreviate).
SKILL_SHA="${SKILL_SHA:-e3b817b6afc6cd413466d43f11ba31209e034bbf}"
SKILL_REPO_URL="${SKILL_REPO_URL:-https://github.com/mromidev/claude-animated-shorts.git}"
HOME_DIR="${HOME:-/root}"
SKILL_DIR="${SKILL_DIR:-$HOME_DIR/.claude/skills/cartoon-3d-short}"
PROJECT_DIR="${PROJECT_DIR:-$HOME_DIR/remotion-shorts}"

# This script is self-contained (it can be pasted as a cloud environment setup
# script or piped to bash). When run from a checkout of this repo it additionally
# uses templates/package-lock.json for reproducible `npm ci` installs.
REPO_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

log() { printf '[setup] %s\n' "$*"; }
die() { printf '[setup] ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

# Replace the literal text $2 with $3 in file $1. Succeeds (no change) if $3 or
# any further already-applied variant ($4...) is present; fails loudly if
# nothing matches.
patch_literal() {
  local file="$1" old="$2" new="$3" content applied
  shift 3
  [ -f "$file" ] || die "cannot patch, file missing: $file"
  content="$(cat "$file"; printf x)"
  content="${content%x}"
  for applied in "$new" "$@"; do
    if [[ "$content" == *"$applied"* ]]; then
      return 0
    fi
  done
  [[ "$content" == *"$old"* ]] || die "patch target not found in $file: $old (the upstream skill changed, or the file was edited by hand)"
  printf '%s' "${content//"$old"/"$new"}" > "$file"
}

SKILL_TMP=""
cleanup() { [ -z "$SKILL_TMP" ] || rm -rf "$SKILL_TMP"; }
trap cleanup EXIT

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
  SKILL_TMP="$tmp"
  git -C "$tmp" init -q
  git -C "$tmp" remote add origin "$SKILL_REPO_URL"
  git -C "$tmp" fetch -q --depth 1 --no-tags origin "$SKILL_SHA" ||
    { rm -rf "$tmp"; die "could not fetch $SKILL_SHA from $SKILL_REPO_URL"; }
  git -C "$tmp" -c advice.detachedHead=false checkout -q --detach FETCH_HEAD
  [ "$(git -C "$tmp" rev-parse HEAD)" = "$SKILL_SHA" ] ||
    { rm -rf "$tmp"; die "fetched commit does not match pinned SHA $SKILL_SHA"; }
  rm -rf "$SKILL_DIR"
  mv "$tmp" "$SKILL_DIR"
  SKILL_TMP=""
  log "installed skill at $SKILL_SHA"
}

install_python_deps() {
  if [ "${SKIP_PIP:-0}" = 1 ]; then
    log "SKIP_PIP=1, skipping python packages"
    return 0
  fi
  # Keep in sync with requirements.txt (a test enforces this).
  local pkgs=("numpy>=1.26,<3" "scipy>=1.11,<2" "pillow>=10,<14") out
  if out="$(python3 -m pip install -q "${pkgs[@]}" 2>&1)"; then
    return 0
  fi
  if [[ "$out" == *externally-managed-environment* ]]; then
    log "PEP 668 externally-managed Python; retrying with --break-system-packages"
    python3 -m pip install -q --break-system-packages "${pkgs[@]}"
  else
    printf '%s\n' "$out" >&2
    die "pip install failed"
  fi
}

# Embedded project templates (templates/ in this repo mirrors them; a test enforces this).
write_package_json() {
  cat > package.json <<'JSON'
{
  "name": "remotion-shorts",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": { "studio": "remotion studio src/index.ts", "typecheck": "tsc --noEmit" },
  "dependencies": {
    "remotion": "4.0.545", "@remotion/cli": "4.0.545", "@remotion/three": "4.0.545",
    "@remotion/bundler": "4.0.545", "@remotion/renderer": "4.0.545",
    "react": "18.3.1", "react-dom": "18.3.1", "three": "0.170.0",
    "@react-three/fiber": "8.18.0", "@react-three/postprocessing": "2.19.1", "postprocessing": "6.39.6"
  },
  "devDependencies": { "typescript": "5.9.3", "@types/react": "18.3.28", "@types/three": "0.170.0" }
}
JSON
}
write_tsconfig() {
  cat > tsconfig.json <<'JSON'
{ "compilerOptions": { "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler", "jsx": "react-jsx",
  "strict": false, "skipLibCheck": true, "noEmit": true, "esModuleInterop": true, "lib": ["DOM", "ES2022"] },
  "include": ["src"] }
JSON
}
write_root_tsx() {
  cat > src/Root.tsx <<'TSX'
import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
TSX
}
write_index_ts() {
  cat > src/index.ts <<'TS'
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";
registerRoot(RemotionRoot);
TS
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

  patch_literal scripts/bridge-stills.mjs \
    '"C:/Program Files/Google/Chrome/Application/chrome.exe"' \
    'process.env.BROWSER_EXECUTABLE || "/opt/pw-browsers/chromium"'
  patch_literal scripts/bridge-stills.mjs \
    '{ gl: "angle" }' \
    '{ gl: process.env.REMOTION_GL || "swangle" }'
  patch_literal scripts/bridge_merge.py \
    'os.path.expanduser("your Remotion project")' \
    "os.path.expanduser(\"$PROJECT_DIR\")" \
    'os.path.expanduser("~/remotion-shorts")'

  # Project files are only created when missing, so local edits survive re-runs.
  if [ ! -f package.json ]; then
    write_package_json
    # The lockfile belongs to the template package.json, so they travel together.
    if [ -n "$REPO_DIR" ] && [ -f "$REPO_DIR/templates/package-lock.json" ] && [ ! -f package-lock.json ]; then
      cp "$REPO_DIR/templates/package-lock.json" package-lock.json
    fi
  fi
  [ -f tsconfig.json ] || write_tsconfig
  [ -f src/Root.tsx ] || write_root_tsx
  [ -f src/index.ts ] || write_index_ts

  if [ "${SKIP_NPM:-0}" = 1 ]; then
    log "SKIP_NPM=1, skipping npm install"
  elif [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund --loglevel=error || {
      log "npm ci failed (package.json and lockfile out of sync?); falling back to npm install"
      npm install --no-audit --no-fund --loglevel=error
    }
  else
    npm install --no-audit --no-fund --loglevel=error
  fi
}

validate_path() { # name value
  case "$2" in
    "") die "$1 must not be empty" ;;
    *\"* | *\\* | *$'\n'*) die "$1 must not contain quotes, backslashes or newlines" ;;
  esac
}

main() {
  validate_path PROJECT_DIR "$PROJECT_DIR"
  validate_path SKILL_DIR "$SKILL_DIR"
  require_cmd git
  [ "${SKIP_PIP:-0}" = 1 ] || require_cmd python3
  [ "${SKIP_NPM:-0}" = 1 ] || require_cmd npm
  install_python_deps
  install_skill
  setup_project
  log "done: project at $PROJECT_DIR"
}

main "$@"
