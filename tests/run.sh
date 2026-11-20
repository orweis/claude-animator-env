#!/usr/bin/env bash
# Test suite for setup.sh. Runs fully offline in a sandboxed HOME with a local
# fixture repo standing in for the upstream skill; npm and pip are skipped.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PASS=0 FAIL=0

ok()   { PASS=$((PASS + 1)); printf 'ok   - %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf 'FAIL - %s\n' "$1"; }
check() { # description, command...
  local d="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$d"; else fail "$d"; fi
}
check_not() { local d="$1"; shift; if "$@" >/dev/null 2>&1; then fail "$d"; else ok "$d"; fi; }

make_fixture() { # dir -> prints commit sha
  local d="$1"
  mkdir -p "$d/templates/bridge" "$d/templates/scripts"
  echo '# skill' > "$d/SKILL.md"
  echo 'export const BRIDGE_FRAMES = 1;' > "$d/templates/bridge/Bridge.tsx"
  printf 'const o = { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" };\nrender({ gl: "angle" });\n' > "$d/templates/scripts/bridge-stills.mjs"
  printf 'import os\nP = os.path.expanduser("your Remotion project")\n' > "$d/templates/scripts/bridge_merge.py"
  echo 'print(1)' > "$d/templates/scripts/short_qa.py"
  git -C "$d" init -q
  git -C "$d" add -A
  git -C "$d" -c user.name=t -c user.email=t@example.invalid commit -q -m fixture
  git -C "$d" rev-parse HEAD
}

new_env() { # name -> sets H, SHA, env for run_setup
  H="$WORK/$1/home"; mkdir -p "$H"
  FIX="$WORK/$1/fixture"
  SHA="$(make_fixture "$FIX")"
}
run_setup() {
  HOME="$H" SKILL_REPO_URL="file://$FIX" SKILL_SHA="$SHA" SKIP_NPM=1 SKIP_PIP=1 \
    bash "$ROOT/setup.sh"
}
P() { echo "$H/remotion-shorts"; }

# 1. fresh run
new_env fresh
check "fresh run succeeds" run_setup
check "skill checked out at pinned sha" test "$(git -C "$H/.claude/skills/cartoon-3d-short" rev-parse HEAD)" = "$SHA"
check "chrome path patched" grep -q 'process.env.BROWSER_EXECUTABLE' "$(P)/scripts/bridge-stills.mjs"
check "windows chrome path removed" bash -c "! grep -q 'C:/Program Files' '$(P)/scripts/bridge-stills.mjs'"
check "gl option patched" grep -q 'REMOTION_GL || "swangle"' "$(P)/scripts/bridge-stills.mjs"
check "merge path patched to project dir" grep -qF "expanduser(\"$H/remotion-shorts\")" "$(P)/scripts/bridge_merge.py"
check "package.json is valid JSON" python3 -c "import json,sys;json.load(open('$(P)/package.json'))"
check "lockfile copied with package.json" test -f "$(P)/package-lock.json"
check "Root.tsx and index.ts created" test -f "$(P)/src/Root.tsx" -a -f "$(P)/src/index.ts"
check "tmp clone dirs cleaned up" bash -c "! ls -A '$H/.claude/skills' | grep -q '^\.skill\.'"

# 2. idempotency and preservation of user edits
echo '{"name":"mine","edited":true}' > "$(P)/package.json"
echo '// mine' > "$(P)/src/Root.tsx"
echo 'tweaked' >> "$(P)/scripts/short_qa.py"
check "second run succeeds" run_setup
check "user package.json preserved" grep -q '"edited":true' "$(P)/package.json"
check "user Root.tsx preserved" grep -q '// mine' "$(P)/src/Root.tsx"
check "user script edits preserved" grep -q tweaked "$(P)/scripts/short_qa.py"
check "patches not applied twice" test "$(grep -c 'process.env.BROWSER_EXECUTABLE' "$(P)/scripts/bridge-stills.mjs")" = 1

# 3. pin mismatch on existing checkout
git -C "$H/.claude/skills/cartoon-3d-short" -c user.name=t -c user.email=t@example.invalid commit -q --allow-empty -m drift
out="$(run_setup 2>&1)"; rc=$?
check "drifted skill checkout is rejected" test "$rc" -ne 0
check "mismatch message names expected sha" bash -c "grep -q '$SHA' <<<\"\$1\"" _ "$out"

# 4. upstream text changed -> patch failure is loud
new_env changed
echo 'nothing to patch here' > "$FIX/templates/scripts/bridge-stills.mjs"
git -C "$FIX" add -A; git -C "$FIX" -c user.name=t -c user.email=t@example.invalid commit -q -m change
SHA="$(git -C "$FIX" rev-parse HEAD)"
out="$(run_setup 2>&1)"; rc=$?
check "missing patch target fails" test "$rc" -ne 0
check "failure explains patch target" bash -c "grep -q 'patch target not found' <<<\"\$1\"" _ "$out"

# 5. unfetchable / wrong sha
new_env badsha
SHA=0000000000000000000000000000000000000001
check_not "unknown pinned sha fails" run_setup
check_not "no half-installed skill left behind" test -e "$H/.claude/skills/cartoon-3d-short"

# 6. non-empty non-git skill dir is not clobbered
new_env foreign
mkdir -p "$H/.claude/skills/cartoon-3d-short"; echo keep > "$H/.claude/skills/cartoon-3d-short/mine.txt"
check_not "foreign skill dir refused" run_setup
check "foreign skill dir untouched" test -f "$H/.claude/skills/cartoon-3d-short/mine.txt"

# 7. prerequisites and input validation
new_env prereq
EMPTYBIN="$WORK/emptybin"; mkdir -p "$EMPTYBIN"
out="$(HOME="$H" PATH="$EMPTYBIN" /bin/bash "$ROOT/setup.sh" 2>&1)"; rc=$?
check "missing git fails early" test "$rc" -ne 0
check "missing tool is named" bash -c "grep -q 'required command not found: git' <<<\"\$1\"" _ "$out"
new_env badpath
check_not "PROJECT_DIR with quote rejected" env PROJECT_DIR="$H/x\"y" HOME="$H" SKILL_REPO_URL="file://$FIX" SKILL_SHA="$SHA" SKIP_NPM=1 SKIP_PIP=1 bash "$ROOT/setup.sh"

# 8. interrupted earlier run (empty dir) recovers
new_env recover
mkdir -p "$H/.claude/skills/cartoon-3d-short"
check "empty skill dir is reused" run_setup

# 9. templates and repo hygiene
check "lockfile matches package.json deps" python3 - <<PY
import json
p=json.load(open("$ROOT/templates/package.json")); l=json.load(open("$ROOT/templates/package-lock.json"))
root=l["packages"][""]
assert root["dependencies"]==p["dependencies"] and root["devDependencies"]==p["devDependencies"]
PY
check "template deps are exact pins" python3 - <<PY
import json,re
p=json.load(open("$ROOT/templates/package.json"))
assert all(re.fullmatch(r"\d+\.\d+\.\d+",v) for d in (p["dependencies"],p["devDependencies"]) for v in d.values())
PY
check "pin in setup.sh is a full 40-char sha" grep -Eq 'SKILL_SHA:-[0-9a-f]{40}\}' "$ROOT/setup.sh"
check "tsconfig is valid JSON" python3 -c "import json;json.load(open('$ROOT/templates/tsconfig.json'))"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
