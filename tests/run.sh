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
out="$(env PROJECT_DIR="$H/x\"y" HOME="$H" SKILL_REPO_URL="file://$FIX" SKILL_SHA="$SHA" SKIP_NPM=1 SKIP_PIP=1 bash "$ROOT/setup.sh" 2>&1)"; rc=$?
check "PROJECT_DIR with quote rejected" test "$rc" -ne 0
check "quote rejection is explained" bash -c "grep -q 'must not contain quotes' <<<\"\$1\"" _ "$out"
check "rejection happens before any side effects" bash -c "[ ! -e '$H/.claude' ] && [ -z \"\$(ls -A '$H')\" ]"

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

# 10. standalone: script copied outside the repo (cloud-environment usage)
new_env standalone
cp "$ROOT/setup.sh" "$WORK/standalone/setup-copy.sh"
check "script runs from outside the repo" env HOME="$H" SKILL_REPO_URL="file://$FIX" SKILL_SHA="$SHA" SKIP_NPM=1 SKIP_PIP=1 bash "$WORK/standalone/setup-copy.sh"
check "standalone creates all project files" bash -c "cd '$H/remotion-shorts' && test -f package.json -a -f tsconfig.json -a -f src/Root.tsx -a -f src/index.ts"
check "standalone has no lockfile (npm install path)" test ! -f "$H/remotion-shorts/package-lock.json"
new_env piped
check "script runs piped to bash -s" bash -c "HOME='$H' SKILL_REPO_URL='file://$FIX' SKILL_SHA='$SHA' SKIP_NPM=1 SKIP_PIP=1 bash -s < '$ROOT/setup.sh'"
new_env nohome
check "unset HOME falls back instead of crashing" bash -c "env -u HOME SKILL_DIR='$H/skill' PROJECT_DIR='$H/proj' SKILL_REPO_URL='file://$FIX' SKILL_SHA='$SHA' SKIP_NPM=1 SKIP_PIP=1 bash '$ROOT/setup.sh'"

# 11. upgrade from an install made by the previous (1.0/1.1) scripts
new_env legacy
run_setup >/dev/null 2>&1
sed -i "s|expanduser(\"$H/remotion-shorts\")|expanduser(\"~/remotion-shorts\")|" "$(P)/scripts/bridge_merge.py"
check "legacy ~/remotion-shorts patch is accepted" run_setup
check "legacy install left as is" grep -qF 'expanduser("~/remotion-shorts")' "$(P)/scripts/bridge_merge.py"

# 12. npm / pip invocation, with recording stubs on PATH
new_env stubs
STUB="$WORK/stubs/bin"; mkdir -p "$STUB"; LOG="$WORK/stubs/calls.log"; : > "$LOG"
printf '#!/bin/sh\necho "npm $*" >> "%s"\n' "$LOG" > "$STUB/npm"
printf '#!/bin/sh\necho "python3 $*" >> "%s"\n' "$LOG" > "$STUB/python3"
chmod +x "$STUB/npm" "$STUB/python3"
stub_setup() { HOME="$H" PATH="$STUB:$PATH" SKILL_REPO_URL="file://$FIX" SKILL_SHA="$SHA" "$@" bash "$ROOT/setup.sh"; }
check "setup with stubbed npm/pip succeeds" stub_setup env
check "pip gets bounded packages" grep -q 'pip install -q numpy>=1.26,<3 scipy>=1.11,<2 pillow>=10,<14' "$LOG"
check "npm ci used with the repo lockfile" grep -q '^npm ci ' "$LOG"
: > "$LOG"
# shellcheck disable=SC2016  # $1/$* are meant for the generated stub script
printf '#!/bin/sh\necho "npm $*" >> "%s"\n[ "$1" = ci ] && exit 1\nexit 0\n' "$LOG" > "$STUB/npm"
rm -f "$(P)/package-lock.json"
check "npm install fallback when npm ci fails" stub_setup env
check "fallback ran npm install" grep -q '^npm install ' "$LOG"
printf '#!/bin/sh\necho "python3 $*" >> "%s"\necho "error: externally-managed-environment" >&2\ncase "$*" in *break-system*) exit 0;; esac\nexit 1\n' "$LOG" > "$STUB/python3"
check "pep668 retries with --break-system-packages" stub_setup env
printf '#!/bin/sh\necho "network down" >&2\nexit 1\n' > "$STUB/python3"
out="$(stub_setup env 2>&1)"; rc=$?
check "non-PEP668 pip failure is surfaced, not retried" bash -c "test $rc -ne 0 && grep -q 'network down' <<<\"\$1\" && ! grep -q break-system <<<\"\$1\"" _ "$out"

# 13. failed checkout leaves no temp dir
new_env tmpclean
printf 'bad' > "$FIX/.git/HEAD"
check_not "broken upstream fails" run_setup
check "no temp dir left after failure" bash -c "! ls -A '$H/.claude/skills' 2>/dev/null | grep -q '^\.skill\.'"

# 14. embedded templates match templates/ and requirements.txt
extract() { awk -v fn="$1" '$0 ~ "^"fn"\\(\\)"{f=1;next} f&&/<<.(JSON|TSX|TS).$/{h=1;next} f&&h&&/^(JSON|TSX|TS)$/{exit} f&&h{print}' "$ROOT/setup.sh"; }
check "embedded package.json == templates" diff <(extract write_package_json) "$ROOT/templates/package.json"
check "embedded tsconfig == templates" diff <(extract write_tsconfig) "$ROOT/templates/tsconfig.json"
check "embedded Root.tsx == templates" diff <(extract write_root_tsx) "$ROOT/templates/Root.tsx"
check "embedded index.ts == templates" diff <(extract write_index_ts) "$ROOT/templates/index.ts"
check "setup.sh pip pins match requirements.txt" bash -c "diff <(grep -o '\"[a-z]*>=[^\"]*\"' '$ROOT/setup.sh' | tr -d '\"' | sort) <(sort '$ROOT/requirements.txt')"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
