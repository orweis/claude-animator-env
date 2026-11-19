# claude-animator-env

Cloud environment setup for making animated story shorts with the
[`cartoon-3d-short`](https://github.com/mromidev/claude-animated-shorts) Claude skill
(three.js inside Remotion, ink outlines, painted 3D world, synthesized sound).

`setup.sh` is the setup script of the Claude Code cloud environment **video**. On a fresh container it:

1. Installs the Python packages the audio and QA scripts need (numpy, scipy, Pillow).
2. Clones the skill into `~/.claude/skills/cartoon-3d-short`, pinned to commit `e3b817b`, the version that was
   security-reviewed (no network calls, eval, credential reads, hidden Unicode or prompt injection; images are real JPEGs).
   Review any newer commit before moving the pin.
3. Builds a Remotion project at `~/remotion-shorts` with the bridge template in `src/videos/bridge`
   (composition `BridgeShort`) and the helper scripts in `scripts/`.

The script is idempotent: running it again keeps existing project files and only reinstalls packages.

## Fixes over the upstream skill
- **Pinned versions.** With the latest React 19 / `@react-three/fiber` 9 / `@react-three/postprocessing` 3, the
  post-processing composer draws nothing inside Remotion's `ThreeCanvas` and every frame is the flat background colour.
  The working stack is React 18.3, fiber 8, `@react-three/postprocessing` 2, three 0.170, Remotion 4.0.545.
- **Linux browser.** `scripts/bridge-stills.mjs` hard-coded a Windows Chrome path. It now uses
  `$BROWSER_EXECUTABLE` or the preinstalled `/opt/pw-browsers/chromium`.
- **No GPU.** WebGL defaults to software rendering (`swangle`). Override with `REMOTION_GL=angle` on a GPU machine.
  Stills take ~20 s each at scale 0.5.
- **Project path.** `scripts/bridge_merge.py` points at `~/remotion-shorts`.

## Usage
```bash
cd ~/remotion-shorts
REMOTION_TMP=/tmp/remotion-tmp node scripts/bridge-stills.mjs out/test/x_ 100,400,1200 0.5
```
Then ask Claude: *"Use the cartoon short skill and make a short about …"*.

## Kenney models (manual)
The template loads 26 CC0 models from Kenney's **Nature Kit** and **Fantasy Town Kit** into
`public/bridge/kenney/<name>.glb`. kenney.nl refuses automated downloads, so download both kits in a browser and copy
the `.glb` files there. Without them, scenes render without trees, bushes, flowers, stalls, banners, windmill, cart,
lantern and canoe.
