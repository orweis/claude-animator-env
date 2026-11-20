# claude-animator-env

Cloud environment setup for making animated story shorts with the
[`cartoon-3d-short`](https://github.com/mromidev/claude-animated-shorts) Claude skill
(three.js inside Remotion, ink outlines, painted 3D world, synthesized sound).

`setup.sh` is the setup script of a Claude Code cloud environment (named `video` in the author's setup).
It is not a standalone library; it prepares a machine. Version history: [CHANGELOG.md](CHANGELOG.md).

## What it does
1. Installs the Python packages the audio and QA scripts need (`requirements.txt`: numpy, scipy, Pillow).
2. Fetches the skill into `$SKILL_DIR` (default `~/.claude/skills/cartoon-3d-short`), pinned to the full commit
   `e3b817b6afc6cd413466d43f11ba31209e034bbf`, the version that was security-reviewed (no network calls, eval,
   credential reads, hidden Unicode or prompt injection; images are real JPEGs). Review any newer commit before moving
   the pin. An existing checkout at a different commit makes the script abort.
3. Builds a Remotion project in `$PROJECT_DIR` (default `~/remotion-shorts`) with the bridge template in
   `src/videos/bridge` (composition `BridgeShort`) and the helper scripts in `scripts/`, then runs `npm ci` from the
   committed lockfile (`templates/package-lock.json`).

## Prerequisites
`bash`, `git`, `python3` with `pip`, Node.js and `npm` (tested with Node 22, Python 3.13), network access to GitHub,
PyPI and npm, and a Chromium (default `/opt/pw-browsers/chromium`) for stills.

## Usage
```bash
./setup.sh
cd ~/remotion-shorts
REMOTION_TMP=/tmp/remotion-tmp node scripts/bridge-stills.mjs out/test/x_ 100,400,1200 0.5
```
`bridge-stills.mjs` arguments: output filename prefix, comma-separated frame numbers, render scale.
Then ask Claude: *"Use the cartoon short skill and make a short about ..."*.

The script is idempotent. `package.json`, `tsconfig.json`, `src/Root.tsx`, `src/index.ts` and the copied skill
templates are only created when missing, so your edits survive re-runs. Patches are verified and the script fails loudly
if upstream text no longer matches.

## Configuration
| Variable | Default | Purpose |
|---|---|---|
| `SKILL_DIR` | `~/.claude/skills/cartoon-3d-short` | skill location |
| `PROJECT_DIR` | `~/remotion-shorts` | Remotion project location |
| `SKILL_SHA`, `SKILL_REPO_URL` | pinned commit, upstream URL | override only for testing or a reviewed new pin |
| `SKIP_PIP=1`, `SKIP_NPM=1` | unset | skip installing Python / npm packages |
| `BROWSER_EXECUTABLE` | `/opt/pw-browsers/chromium` | browser used by `bridge-stills.mjs` (runtime) |
| `REMOTION_GL` | `swangle` | WebGL backend (`angle` on a GPU machine; runtime) |

## Fixes over the upstream skill
- **Pinned versions.** See "Why these versions".
- **Linux browser.** `scripts/bridge-stills.mjs` hard-coded a Windows Chrome path. It now uses
  `$BROWSER_EXECUTABLE` or the preinstalled `/opt/pw-browsers/chromium`.
- **No GPU.** WebGL defaults to software rendering (`swangle`). Stills take ~20 s each at scale 0.5.
- **Project path.** `scripts/bridge_merge.py` points at `$PROJECT_DIR`.

## Why these versions
With the latest React 19 / `@react-three/fiber` 9 / `@react-three/postprocessing` 3, the post-processing composer
draws nothing inside Remotion's `ThreeCanvas` and every frame is the flat background colour. The working stack is
React 18.3, fiber 8, `@react-three/postprocessing` 2, three 0.170, Remotion 4.0.545. These are deliberately behind
latest; to try an upgrade, change `templates/package.json`, regenerate the lockfile, and render a still to check it
is not a flat colour.

## Kenney models (manual)
The template loads 26 CC0 models from Kenney's **Nature Kit** and **Fantasy Town Kit** into
`public/bridge/kenney/<name>.glb`. kenney.nl refuses automated downloads, so download both kits in a browser and copy
the `.glb` files there. Without them, scenes render without trees, bushes, flowers, stalls, banners, windmill, cart,
lantern and canoe. Check with `ls public/bridge/kenney/*.glb | wc -l` (expect 26).

## Troubleshooting
- `patch target not found`: the upstream skill text changed; keep the pin or update the patches in `setup.sh`.
- `is at <sha>, expected <sha>`: the skill directory is at another commit; remove it and re-run.
- pip `externally-managed-environment`: handled automatically with `--break-system-packages`; use a venv if you prefer.

## Development
```bash
shellcheck -x -s bash setup.sh tests/run.sh
bash tests/run.sh      # offline; uses a local fixture instead of GitHub
```
CI runs the same on every push and pull request.

## License
No license file is present, so default copyright applies; the repository owner needs to choose one. The upstream skill
has its own terms.
