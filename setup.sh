#!/bin/bash
# cartoon-3d-short skill + Remotion project (~/remotion-shorts) for animated shorts
set -euo pipefail
pip install -q numpy scipy pillow
SK=/root/.claude/skills/cartoon-3d-short
if [ ! -f "$SK/SKILL.md" ]; then
  mkdir -p /root/.claude/skills
  git clone -q https://github.com/mromidev/claude-animated-shorts.git "$SK"
  git -C "$SK" checkout -q e3b817b
fi
P=/root/remotion-shorts
mkdir -p "$P/src/videos/bridge" "$P/scripts" "$P/public/bridge/kenney" "$P/out"
cd "$P"
[ -f src/videos/bridge/Bridge.tsx ] || cp "$SK"/templates/bridge/* src/videos/bridge/
[ -f scripts/short_qa.py ] || cp "$SK"/templates/scripts/* scripts/
sed -i 's#"C:/Program Files/Google/Chrome/Application/chrome.exe"#process.env.BROWSER_EXECUTABLE || "/opt/pw-browsers/chromium"#' scripts/bridge-stills.mjs
sed -i 's#{ gl: "angle" }#{ gl: process.env.REMOTION_GL || "swangle" }#' scripts/bridge-stills.mjs
sed -i 's#os.path.expanduser("your Remotion project")#os.path.expanduser("~/remotion-shorts")#' scripts/bridge_merge.py
cat > package.json <<'EOF'
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
    "@react-three/fiber": "^8.18.0", "@react-three/postprocessing": "^2.19.1", "postprocessing": "^6.36.0"
  },
  "devDependencies": { "typescript": "^5.6.0", "@types/react": "^18.3.0", "@types/three": "0.170.0" }
}
EOF
cat > tsconfig.json <<'EOF'
{ "compilerOptions": { "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler", "jsx": "react-jsx",
  "strict": false, "skipLibCheck": true, "noEmit": true, "esModuleInterop": true, "lib": ["DOM", "ES2022"] },
  "include": ["src"] }
EOF
[ -f src/Root.tsx ] || cat > src/Root.tsx <<'EOF'
import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
EOF
[ -f src/index.ts ] || printf '%s\n' 'import { registerRoot } from "remotion";' \
  'import { RemotionRoot } from "./Root";' 'registerRoot(RemotionRoot);' > src/index.ts
npm install --no-audit --no-fund --loglevel=error
