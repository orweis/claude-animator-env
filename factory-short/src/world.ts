// The factory short's three sets in one three.js scene: the 1977 machine room (x = RX), the factory floor (origin) and
// the street (x = SX). Static scenery is merged per material (Batch); moving things (drawer, belt, parcels, window
// sash, barrier arm, button, ledger, delegation strings, car trunk) are posed every frame from story time.
// update(id, f, camera) is a pure function of shot id + frame.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, Kit, quad } from "./build";
import { ctex, rep, stoneHD, cloudHD, facadeHD, roofHD, jit } from "./paint";
import { Pen } from "./toon";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone, twoTone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, SHOTS, RX, SX, EV, BELT, AGENT_X, AGENT_Z, DEV, BUTTON, WALL_Z, WIN, BOOTH, GATE_X, LEDGER, BELT_SPEED, ROOM, STREET,
  camAt, V3, smooth, clamp01, ShotDef,
} from "./story";

export const loadKit = () => Promise.resolve({} as Kit); // no GLB models in this short

// ---------------- painted textures ----------------
const checker = () => ctex("lino", 512, 512, (g, r) => {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = jit(r, (x + y) % 2 ? "#d9cdb2" : "#9a4a3a", 0.05, 2, 0.08); g.fillRect(x * 64, y * 64, 64, 64); }
  g.strokeStyle = "rgba(40,30,40,0.35)"; g.lineWidth = 2; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 512); g.moveTo(0, i * 64); g.lineTo(512, i * 64); g.stroke(); }
});
const panelWall = (key: string, base: string, low: string) => ctex(key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,90,60,${0.03 + 0.04 * r()})`; g.beginPath(); g.arc(r() * 512, r() * 512, 20 + 60 * r(), 0, 7); g.fill(); }
  g.fillStyle = low; g.fillRect(0, 360, 512, 152); g.fillStyle = "rgba(40,30,40,0.8)"; g.fillRect(0, 356, 512, 6);
  for (let x = 0; x < 512; x += 128) g.fillRect(x, 362, 4, 150);
});
const concrete = () => ctex("concrete", 1024, 1024, (g, r) => {
  g.fillStyle = "#cfc3a8"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "90,85,80" : "230,228,220"},${0.04 + 0.05 * r()})`; g.beginPath(); g.arc(r() * 1024, r() * 1024, 10 + 70 * r(), 0, 7); g.fill(); }
  g.strokeStyle = "rgba(40,30,40,0.55)"; g.lineWidth = 3; g.strokeRect(1, 1, 1022, 1022);
  g.strokeStyle = "#e6c34a"; g.lineWidth = 26; g.beginPath(); g.moveTo(0, 860); g.lineTo(1024, 860); g.stroke(); // safety line
});
const metalWall = () => ctex("metalWall", 512, 512, (g, r) => {
  g.fillStyle = "#7d9bb2"; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) { g.fillStyle = jit(r, "#7d9bb2", 0.06, 3, 0.1); g.fillRect(x + 3, 0, 58, 512); g.fillStyle = "rgba(40,30,50,0.55)"; g.fillRect(x, 0, 3, 512); }
  g.fillStyle = "#4f6b82"; g.fillRect(0, 400, 512, 112); g.fillStyle = "rgba(40,30,50,0.8)"; g.fillRect(0, 396, 512, 6);
});
const glass = () => ctex("glass", 256, 384, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 384); gr.addColorStop(0, "#7fb2ea"); gr.addColorStop(1, "#cfe4f7");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 384);
  g.fillStyle = "rgba(255,255,255,0.85)"; for (const [x, y, w] of [[60, 120, 90], [150, 90, 70], [100, 260, 110]]) { g.beginPath(); g.ellipse(x, y, w, w * 0.32, 0, 0, 7); g.fill(); }
  g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 14; g.beginPath(); g.moveTo(30, 200); g.lineTo(120, 80); g.stroke();
});
const beltTex = () => ctex("belt", 128, 512, (g) => {
  g.fillStyle = "#2f3138"; g.fillRect(0, 0, 128, 512);
  g.fillStyle = "#3d4049"; for (let y = 0; y < 512; y += 64) g.fillRect(0, y, 128, 30);
});
const cardboard = () => ctex("cardboard", 256, 256, (g, r) => {
  g.fillStyle = "#c99a5e"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(120,80,40,${0.05 + 0.06 * r()})`; g.fillRect(r() * 256, r() * 256, 40 * r(), 3); }
  g.fillStyle = "#e9dcae"; g.fillRect(108, 0, 40, 256);
  g.strokeStyle = "rgba(40,30,40,0.6)"; g.lineWidth = 6; g.strokeRect(3, 3, 250, 250);
});
const tapeFace = () => ctex("tapeFace", 256, 512, (g) => {
  g.fillStyle = "#d8d4c6"; g.fillRect(0, 0, 256, 512);
  for (const y of [120, 300]) { g.fillStyle = "#2a2a30"; g.beginPath(); g.arc(128, y, 74, 0, 7); g.fill(); g.fillStyle = "#8a8f99"; g.beginPath(); g.arc(128, y, 26, 0, 7); g.fill(); g.strokeStyle = "#5a5e68"; g.lineWidth = 6; g.beginPath(); g.arc(128, y, 52, 0, 7); g.stroke(); }
  g.fillStyle = "#3a3d47"; g.fillRect(30, 410, 196, 70);
  for (let i = 0; i < 6; i++) { g.fillStyle = ["#f05a4a", "#f2c84a", "#5ad06a"][i % 3]; g.beginPath(); g.arc(52 + i * 30, 445, 9, 0, 7); g.fill(); }
  g.strokeStyle = "rgba(40,30,40,0.8)"; g.lineWidth = 8; g.strokeRect(4, 4, 248, 504);
});
const drawerFace = () => ctex("drawers", 256, 384, (g) => {
  g.fillStyle = "#d9a63a"; g.fillRect(0, 0, 256, 384);
  for (let i = 0; i < 3; i++) { const y = i * 128; g.strokeStyle = "rgba(60,35,20,0.85)"; g.lineWidth = 7; g.strokeRect(14, y + 12, 228, 104); g.fillStyle = "#6a4a2a"; g.fillRect(98, y + 52, 60, 14); g.fillStyle = "#f3ecd4"; g.fillRect(104, y + 26, 48, 18); }
});
const screen = (key: string, col: string, lines: string) => ctex(key, 256, 192, (g) => {
  g.fillStyle = col; g.fillRect(0, 0, 256, 192);
  g.fillStyle = lines; for (let i = 0; i < 6; i++) g.fillRect(24, 26 + i * 26, 60 + ((i * 53) % 140), 10);
});
const asphalt = () => ctex("asphalt", 512, 512, (g, r) => {
  g.fillStyle = "#5d5f66"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "40,40,48" : "140,140,150"},${0.15 * r()})`; g.fillRect(r() * 512, r() * 512, 3, 3); }
});
/** the factory's decision log: ruled page, n entries (agent colour, arrow, check or cross) */
const AGENT_COLS = ["#2f9e8f", "#e0604a", "#7b5ac9", "#e8b43a"];
const ledgerTex = (n: number) => ctex(`ledger${n}`, 1024, 768, (g) => {
  g.fillStyle = "#f7f1df"; g.fillRect(0, 0, 1024, 768);
  g.fillStyle = "#c9a26a"; g.fillRect(0, 0, 1024, 70); g.fillStyle = "#8a5a34"; g.fillRect(506, 0, 12, 768);
  g.strokeStyle = "rgba(90,120,170,0.5)"; g.lineWidth = 3;
  for (let i = 0; i < 12; i++) for (const x0 of [30, 540]) { g.beginPath(); g.moveTo(x0, 120 + i * 54); g.lineTo(x0 + 450, 120 + i * 54); g.stroke(); }
  for (let i = 0; i < n; i++) {
    const col = i < 12 ? 0 : 1, row = i % 12, x0 = col ? 560 : 50, y = 102 + row * 54;
    g.fillStyle = AGENT_COLS[i % 4]; g.beginPath(); g.arc(x0 + 16, y, 14, 0, 7); g.fill();
    g.strokeStyle = "#241726"; g.lineWidth = 6; g.beginPath(); g.moveTo(x0 + 44, y); g.lineTo(x0 + 120, y); g.lineTo(x0 + 106, y - 10); g.moveTo(x0 + 120, y); g.lineTo(x0 + 106, y + 10); g.stroke();
    g.fillStyle = "#7a8699"; g.fillRect(x0 + 140, y - 6, 120 + ((i * 47) % 150), 12);
    const ok = i % 5 !== 3;
    g.strokeStyle = ok ? "#3a9a5a" : "#d43a3a"; g.lineWidth = 10; g.beginPath();
    if (ok) { g.moveTo(x0 + 402, y); g.lineTo(x0 + 414, y + 12); g.lineTo(x0 + 438, y - 14); } else { g.moveTo(x0 + 404, y - 12); g.lineTo(x0 + 430, y + 12); g.moveTo(x0 + 430, y - 12); g.lineTo(x0 + 404, y + 12); }
    g.stroke();
  }
  g.strokeStyle = "#241726"; g.lineWidth = 12; g.strokeRect(6, 6, 1012, 756);
});

const cyl = (r: number, h: number, seg = 16) => new THREE.CylinderGeometry(r, r, h, seg);
const at = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
const up = (x0: number, x1: number, z0: number, z1: number, y: number, u: number, v: number) =>
  quad(V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0), u, v);
/** vertical wall quad facing +z (or -z when flip) */
const wallZ = (x0: number, x1: number, y0: number, y1: number, z: number, u: number, v: number, flip = false) =>
  flip ? quad(V(x1, y0, z), V(x0, y0, z), V(x0, y1, z), V(x1, y1, z), u, v) : quad(V(x0, y0, z), V(x1, y0, z), V(x1, y1, z), V(x0, y1, z), u, v);
const wallX = (z0: number, z1: number, y0: number, y1: number, x: number, u: number, v: number, faceNegX = false) =>
  faceNegX ? quad(V(x, y0, z0), V(x, y0, z1), V(x, y1, z1), V(x, y1, z0), u, v) : quad(V(x, y0, z1), V(x, y0, z0), V(x, y1, z0), V(x, y1, z1), u, v);
const unlit = (map: THREE.Texture, col = 0xffffff) => new THREE.MeshBasicMaterial({ map, color: col, fog: false });

const PARCELS = 22, PARCEL_GAP = (BELT.x1 - BELT.x0) / PARCELS;
/** x of parcel k on the belt at time t */
export const parcelX = (k: number, t: number) => BELT.x0 + ((((k * PARCEL_GAP + t * BELT_SPEED) % (BELT.x1 - BELT.x0)) + (BELT.x1 - BELT.x0)) % (BELT.x1 - BELT.x0));

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunCache = new Map<number, THREE.Vector3>();
  private clouds: THREE.Mesh[] = [];
  private drawer: THREE.Mesh; private beltMap: THREE.Texture; private parcels: THREE.Mesh[] = [];
  private sash: THREE.Group; private arm: THREE.Group; private button: THREE.Mesh; private ledger: THREE.Mesh;
  private lamp: THREE.Mesh; private lampMat: THREE.MeshBasicMaterial; private boothLamp: THREE.MeshBasicMaterial;
  private strings: THREE.Mesh[] = []; private trunk: THREE.Group;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(_kit: Kit) {
    const R = this.root;
    // ---- sky + light (same rig as the bridge short) ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el)); gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    const cm = [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60, w = 130 + (i % 4) * 30;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cm[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      m.position.set(SX + Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1); m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }
    const solid = new Batch(), shell = new Batch(); // shell = walls that must not shadow the interiors

    // ================= 1977 machine room =================
    {
      const x = (v: number) => RX + v;
      const lino = lam("lino", () => ({ map: rep(checker(), 3, 2.5) }));
      const wall = lam("roomWall", () => ({ map: panelWall("roomWall", "#efe0c0", "#7a5a3c") }));
      solid.add(up(x(-6), x(6), -5, 6, 0, 1, 1), lino);
      shell.add(wallZ(x(-6), x(6), 0, 3.4, -5, 3, 1), wall);
      shell.add(wallX(-5, 6, 0, 3.4, x(-6), 3, 1), wall);
      shell.add(wallX(-5, 6, 0, 3.4, x(6), 3, 1, true), wall);
      const tape = lam("tapeBody", () => ({ color: "#c9c4b4" })), face = lam("tapeFace", () => ({ map: tapeFace() }));
      for (const tx of [-5.1, -3.95, -2.8, -1.65]) {
        solid.add(boxGeo(V(x(tx - 0.5), 0, -4.95), V(x(tx + 0.5), 2.05, -4.25)), tape);
        solid.add(wallZ(x(tx - 0.46), x(tx + 0.46), 0.08, 1.98, -4.24, 1, 1), face);
      }
      const [cx, , cz] = ROOM.cab, gold = lam("goldCab", () => ({ color: "#d9a63a" }));
      solid.add(boxGeo(V(x(cx - 0.45), 0, cz - 0.35), V(x(cx + 0.45), 1.35, cz + 0.35)), gold);
      solid.add(wallZ(x(cx - 0.43), x(cx + 0.43), 0.04, 0.88, cz + 0.351, 1, 0.66), lam("drawers2", () => ({ map: rep(drawerFace(), 1, 0.66) })));
      this.drawer = new THREE.Mesh(boxGeo(V(-0.43, -0.21, -0.6), V(0.43, 0.21, 0.0)), [lam("drawers", () => ({ map: drawerFace() }))][0]);
      this.drawer.position.set(x(cx), 1.1, cz + 0.36); this.drawer.castShadow = true; R.add(this.drawer);
      const wood = lam("desk", () => ({ color: "#8a5a3c" })), beige = lam("crt", () => ({ color: "#d8cfb8" }));
      solid.add(boxGeo(V(x(3.0), 0.74, -3.9), V(x(4.6), 0.8, -2.9)), wood);
      for (const [lx, lz] of [[3.05, -3.85], [4.55, -3.85], [3.05, -2.95], [4.55, -2.95]]) solid.add(boxGeo(V(x(lx - 0.04), 0, lz - 0.04), V(x(lx + 0.04), 0.74, lz + 0.04)), wood);
      solid.add(boxGeo(V(x(3.45), 0.8, -3.8), V(x(4.15), 1.36, -3.2)), beige);
      const crt = new THREE.Mesh(wallZ(x(3.53), x(4.07), 0.88, 1.28, -3.19, 1, 1), unlit(screen("crt", "#123a22", "#5ff08a"), 0xd0d0d0));
      crt.layers.set(NOINK); R.add(crt);
      // a wall clock-shaped disc and a framed blank chart for some life (no text)
      solid.add(new THREE.CircleGeometry(0.28, 32), lam("clock", () => ({ color: "#f7f1df" })), at(x(-0.4), 2.6, -4.97));
      solid.add(boxGeo(V(x(3.0), 1.7, -4.98), V(x(4.6), 2.7, -4.93)), lam("chart", () => ({ color: "#bcd4c8" })));
    }

    // ================= factory floor =================
    {
      solid.add(up(-24, 24, WALL_Z, 12, 0, 6, 2), lam("concrete", () => ({ map: concrete() })));
      solid.add(up(-400 + 260, 260, -300, 300, -0.03, 120, 120), lam("yard", () => ({ map: rep(asphalt(), 1, 1), color: "#e2e8d4" })));
      const mw = lam("metalWall", () => ({ map: metalWall() }));
      // back wall with tall windows (holes left for the glass), the paste-site window and the ledger
      const winX = [-17, -14.5, -9.5, -7, -2, 4.6, 7.2, 14.5, 17];
      let x0 = -24;
      for (const wx of [...winX, WIN[0]].sort((a, b) => a - b)) {
        const w = wx === WIN[0] ? 0.6 : 0.8, lo = wx === WIN[0] ? WIN[1] : 1.2, hi = wx === WIN[0] ? WIN[1] + 1.3 : 4.2;
        shell.add(wallZ(x0, wx - w, 0, 5.2, WALL_Z, (wx - w - x0) / 2, 1), mw);
        shell.add(wallZ(wx - w, wx + w, 0, lo, WALL_Z, w, 0.3), mw);
        shell.add(wallZ(wx - w, wx + w, hi, 5.2, WALL_Z, w, 0.3), mw);
        if (wx !== WIN[0]) {
          const gl = new THREE.Mesh(wallZ(wx - w, wx + w, lo, hi, WALL_Z - 0.05, 1, 1), unlit(glass(), 0xf0f0f0)); gl.layers.set(NOINK); R.add(gl);
          for (const fx of [wx - w, wx, wx + w]) solid.add(boxGeo(V(fx - 0.05, lo, WALL_Z - 0.04), V(fx + 0.05, hi, WALL_Z + 0.06)), lam("mullion", () => ({ color: "#38404c" })));
          for (const fy of [lo, (lo + hi) / 2, hi]) solid.add(boxGeo(V(wx - w, fy - 0.05, WALL_Z - 0.04), V(wx + w, fy + 0.05, WALL_Z + 0.06)), lam("mullion", () => ({ color: "#38404c" })));
        }
        x0 = wx + w;
      }
      shell.add(wallZ(x0, 24, 0, 5.2, WALL_Z, (24 - x0) / 2, 1), mw);
      // outside the paste-site window: sill and a strip of sky
      solid.add(boxGeo(V(WIN[0] - 0.75, WIN[1] - 0.08, WALL_Z - 0.4), V(WIN[0] + 0.75, WIN[1], WALL_Z)), lam("sill", () => ({ color: "#c9c4b4" })));
      const out = new THREE.Mesh(wallZ(WIN[0] - 1.6, WIN[0] + 1.6, 0.4, 4.6, WALL_Z - 1.2, 1, 1), unlit(glass(), 0xffffff)); out.layers.set(NOINK); R.add(out);
      for (const fy of [WIN[1], WIN[1] + 1.3]) solid.add(boxGeo(V(WIN[0] - 0.68, fy - 0.05, WALL_Z - 0.04), V(WIN[0] + 0.68, fy + 0.05, WALL_Z + 0.06)), lam("mullion", () => ({ color: "#38404c" })));
      for (const fx of [WIN[0] - 0.63, WIN[0] + 0.63]) solid.add(boxGeo(V(fx - 0.05, WIN[1], WALL_Z - 0.04), V(fx + 0.05, WIN[1] + 1.3, WALL_Z + 0.06)), lam("mullion", () => ({ color: "#38404c" })));
      // the sash: hinged on its left edge, swings out
      this.sash = new THREE.Group(); this.sash.position.set(WIN[0] - 0.58, WIN[1], WALL_Z - 0.01);
      const pane = new THREE.Mesh(wallZ(0.02, 1.14, 0.03, 1.27, 0, 1, 1), new THREE.MeshBasicMaterial({ map: glass(), color: 0xdde8f0, fog: false, side: THREE.DoubleSide }));
      pane.layers.set(NOINK); this.sash.add(pane);
      for (const [a, b] of [[[0, 0, -0.03], [1.16, 0.06, 0.03]], [[0, 1.24, -0.03], [1.16, 1.3, 0.03]], [[0, 0, -0.03], [0.06, 1.3, 0.03]], [[1.1, 0, -0.03], [1.16, 1.3, 0.03]]] as [V3, V3][])
        this.sash.add(new THREE.Mesh(boxGeo(V(...a), V(...b)), lam("sash", () => ({ color: "#d9573f" }))));
      R.add(this.sash);
      // alarm lamp over the window
      this.lampMat = new THREE.MeshBasicMaterial({ color: "#6a2a2a" });
      this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10), this.lampMat); this.lamp.position.set(WIN[0], WIN[1] + 1.55, WALL_Z + 0.12); R.add(this.lamp);
      solid.add(boxGeo(V(WIN[0] - 0.12, WIN[1] + 1.4, WALL_Z), V(WIN[0] + 0.12, WIN[1] + 1.48, WALL_Z + 0.2)), lam("mullion", () => ({ color: "#38404c" })));
      // ledger board
      this.ledger = new THREE.Mesh(wallZ(LEDGER[0] - 1.6, LEDGER[0] + 1.6, LEDGER[1] - 1.2, LEDGER[1] + 1.2, LEDGER[2], 1, 1), unlit(ledgerTex(0), 0xe8e8e8));
      this.ledger.layers.set(NOINK); R.add(this.ledger);
      solid.add(boxGeo(V(LEDGER[0] - 1.7, LEDGER[1] - 1.3, WALL_Z), V(LEDGER[0] + 1.7, LEDGER[1] + 1.3, WALL_Z + 0.04)), lam("ledgerFrame", () => ({ color: "#8a5a34" })));
      // conveyor
      const frame = lam("beltFrame", () => ({ color: "#3f6fb5" })), steel = lam("steel", () => ({ color: "#9aa3ad" }));
      solid.add(boxGeo(V(BELT.x0, 0.68, BELT.z - 0.62), V(BELT.x1, 0.84, BELT.z - 0.5)), frame);
      solid.add(boxGeo(V(BELT.x0, 0.68, BELT.z + 0.5), V(BELT.x1, 0.84, BELT.z + 0.62)), frame);
      for (let lx = BELT.x0 + 0.5; lx < BELT.x1; lx += 2.2) for (const s of [-1, 1]) solid.add(boxGeo(V(lx - 0.06, 0, BELT.z + s * 0.56 - 0.06), V(lx + 0.06, 0.7, BELT.z + s * 0.56 + 0.06)), steel);
      for (const ex of [BELT.x0, BELT.x1]) { const g = cyl(0.12, 1.1); g.rotateX(Math.PI / 2); solid.add(g, steel, at(ex, 0.76, BELT.z)); }
      this.beltMap = rep(beltTex(), 1, (BELT.x1 - BELT.x0) / 2);
      const bm = twoTone(new THREE.MeshLambertMaterial({ map: this.beltMap }));
      const beltG = up(BELT.x0, BELT.x1, BELT.z - 0.5, BELT.z + 0.5, 0.86, 1, 1);
      const uv = beltG.attributes.uv as THREE.BufferAttribute; // u along z, v along x so the stripes run across the belt
      for (let i = 0; i < uv.count; i++) { const pz = beltG.attributes.position.getZ(i), px = beltG.attributes.position.getX(i); uv.setXY(i, (pz - BELT.z + 0.5), (px - BELT.x0) / 2); }
      const beltMesh = new THREE.Mesh(beltG, bm); beltMesh.receiveShadow = true; R.add(beltMesh);
      const cb = lam("cardboard", () => ({ map: cardboard() })), pg = boxGeo(V(-0.22, 0, -0.22), V(0.22, 0.34, 0.22));
      for (let k = 0; k < PARCELS; k++) { const m = new THREE.Mesh(pg, cb); m.castShadow = true; m.receiveShadow = true; m.rotation.y = (k % 3 - 1) * 0.12; this.parcels.push(m); R.add(m); }
      // stations: a console with a screen beside each agent
      const cons = lam("console", () => ({ color: "#e8e2d2" }));
      AGENT_X.forEach((ax, i) => {
        const cx0 = i === 2 ? ax - 1.45 : ax + 0.75; // the review agent's console sits left, clear of the window shots
        solid.add(boxGeo(V(cx0, 0, AGENT_Z - 0.55), V(cx0 + 0.7, 1.1, AGENT_Z + 0.05)), cons);
        const sc = new THREE.Mesh(wallZ(cx0 + 0.07, cx0 + 0.63, 0.62, 1.02, AGENT_Z + 0.06, 1, 1), unlit(screen(`scr${i}`, ["#123a3a", "#3a1a12", "#24163a", "#3a3012"][i], AGENT_COLS[i]), 0xd8d8d8));
        sc.layers.set(NOINK); R.add(sc);
      });
      // merge button pedestal
      solid.add(cyl(0.09, 0.95), steel, at(BUTTON[0], 0.475, BUTTON[2]));
      solid.add(cyl(0.2, 0.08, 20), lam("btnBase", () => ({ color: "#38404c" })), at(BUTTON[0], 0.99, BUTTON[2]));
      this.button = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam("btn", () => ({ color: "#3ac05a" })));
      this.button.position.set(BUTTON[0], 1.03, BUTTON[2]); this.button.castShadow = true; R.add(this.button);
      // guard booth + barrier arm across the belt
      const [bx, , bz] = BOOTH, booth = lam("booth", () => ({ color: "#f3ecd4" })), trim = lam("boothTrim", () => ({ color: "#27406b" }));
      solid.add(boxGeo(V(bx - 0.8, 0, bz - 0.7), V(bx + 0.8, 0.9, bz + 0.7)), booth);
      for (const px of [bx - 0.8, bx + 0.68]) for (const pz of [bz - 0.7, bz + 0.58]) solid.add(boxGeo(V(px, 0.9, pz), V(px + 0.12, 2.2, pz + 0.12)), booth);
      solid.add(boxGeo(V(bx - 0.8, 0.9, bz - 0.7), V(bx + 0.8, 2.2, bz - 0.58)), booth);
      solid.add(boxGeo(V(bx - 0.95, 2.2, bz - 0.85), V(bx + 0.95, 2.36, bz + 0.85)), trim);
      solid.add(boxGeo(V(bx - 0.84, 0.86, bz + 0.6), V(bx + 0.84, 0.96, bz + 0.82)), trim);
      this.boothLamp = new THREE.MeshBasicMaterial({ color: "#3ac05a" });
      const bl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 8), this.boothLamp); bl.position.set(bx, 2.48, bz); R.add(bl);
      solid.add(boxGeo(V(GATE_X - 0.1, 0, BELT.z + 0.7), V(GATE_X + 0.1, 1.25, BELT.z + 0.9)), trim);
      this.arm = new THREE.Group(); this.arm.position.set(GATE_X, 1.15, BELT.z + 0.8);
      const stripe = ctex("stripe", 256, 32, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#f3ecd4" : "#d43a3a"; g.fillRect(i * 32, 0, 32, 32); } });
      this.arm.add(new THREE.Mesh(boxGeo(V(-0.05, -0.05, -1.75), V(0.05, 0.05, 0)), lam("armStripe", () => ({ map: stripe }))));
      R.add(this.arm);
      // delegation strings: each agent's badge to the developer's hand (grown in by drawRange)
      const sm = lam("string", () => ({ color: "#e8b43a" }));
      AGENT_X.forEach((ax, i) => {
        const a = V(ax + 0.12, 1.32, AGENT_Z - 0.05), b = V(DEV[0] - 0.2, 1.3, DEV[2] - 0.05);
        const mid = a.clone().lerp(b, 0.5).add(V(0, 0.9 + 0.15 * i, -0.5 - 0.1 * i));
        const g = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 80, 0.045, 6, false);
        const m = new THREE.Mesh(g, sm); m.visible = false; m.frustumCulled = false; this.strings.push(m); R.add(m);
      });
    }

    // ================= street =================
    {
      const x = (v: number) => SX + v;
      solid.add(up(x(-30), x(30), -2.2, 30, 0, 12, 6), lam("asphalt", () => ({ map: rep(asphalt(), 1, 1) })));
      const pave = lam("pave", () => ({ map: stoneHD("paveHD", ["#d9d2c2", "#cfc7b6", "#e1dacb", "#c7bfae"], "#a39584") }));
      solid.add(boxGeo(V(x(-30), 0, -7), V(x(30), 0.15, -2.2), 1.2), pave);
      solid.add(boxGeo(V(x(-30), 0, -2.3), V(x(30), 0.17, -2.15)), lam("curb", () => ({ color: "#bdb6a8" })));
      for (let i = -2; i <= 2; i++) solid.add(boxGeo(V(x(i * 6 - 1.2), 0.001, 3.4), V(x(i * 6 + 1.2), 0.012, 3.55)), lam("lane", () => ({ color: "#f3ecd4" })));
      const fac = [["#e9cfa0", "#3f6fb5"], ["#d98f6a", "#2f5f6a"], ["#c9d4b8", "#8c3b4a"], ["#e0b8c8", "#5d7a3a"]];
      for (let i = 0; i < 5; i++) {
        const [w, s] = fac[i % 4], hx = -14 + i * 7, h = 8 + (i % 2) * 1.6;
        const m = lam(`fac${i}`, () => ({ map: facadeHD(`street${i}`, 7, h, { wall: w, shutter: s, door: i % 2 === 0 }) }));
        solid.add(wallZ(x(hx - 3.5), x(hx + 3.5), 0.15, 0.15 + h, -7, 1, 1), m);
        solid.add(boxGeo(V(x(hx - 3.5), 0.15, -12), V(x(hx + 3.5), 0.15 + h, -7.01)), lam(`facb${i}`, () => ({ color: w })));
        solid.add(boxGeo(V(x(hx - 3.6), 0.15 + h, -12), V(x(hx + 3.6), 0.45 + h, -6.8)), lam("roofEdge", () => ({ map: roofHD("#9a4a3a") })));
      }
      solid.add(cyl(0.07, 4.2), lam("post", () => ({ color: "#2f3540" })), at(x(4.2), 2.25, -2.7));
      solid.add(new THREE.SphereGeometry(0.22, 14, 10), lam("lampGlobe", () => ({ color: "#f7f1df" })), at(x(4.2), 4.4, -2.7));
      // the car (front toward +x)
      const [cx, , cz] = STREET.car, paint = lam("carPaint", () => ({ color: "#2f9e8f" })), dark = lam("tyre", () => ({ color: "#26262c" }));
      const glassM = lam("carGlass", () => ({ color: "#a9d1ee" })), chrome = lam("chrome", () => ({ color: "#d8dde3" }));
      solid.add(boxGeo(V(x(cx - 1.25), 0.32, cz - 0.85), V(x(cx + 2.1), 0.98, cz + 0.85)), paint);
      solid.add(boxGeo(V(x(cx - 2.1), 0.32, cz - 0.85), V(x(cx - 1.25), 0.9, cz + 0.85)), paint);
      solid.add(boxGeo(V(x(cx - 1.0), 0.98, cz - 0.75), V(x(cx + 0.95), 1.55, cz + 0.75)), paint);
      solid.add(wallZ(x(cx - 0.9), x(cx + 0.85), 1.03, 1.5, cz + 0.755, 1, 1), glassM);
      for (const wx of [cx - 1.35, cx + 1.35]) for (const wz of [cz - 0.82, cz + 0.82]) { const g = cyl(0.34, 0.24, 20); g.rotateX(Math.PI / 2); solid.add(g, dark, at(x(wx), 0.34, wz)); const h = cyl(0.14, 0.26, 14); h.rotateX(Math.PI / 2); solid.add(h, chrome, at(x(wx), 0.34, wz)); }
      for (const s of [-1, 1]) solid.add(cyl(0.11, 0.06, 14).rotateZ(Math.PI / 2), lam("headlight", () => ({ color: "#fff3c4" })), at(x(cx + 2.11), 0.75, cz + s * 0.55));
      solid.add(boxGeo(V(x(cx - 2.15), 0.3, cz - 0.86), V(x(cx + 2.15), 0.4, cz + 0.86)), chrome);
      // trunk lid hinged at its front edge (x = cx - 1.25)
      this.trunk = new THREE.Group(); this.trunk.position.set(x(cx - 1.25), 0.98, cz);
      const lid = new THREE.Mesh(boxGeo(V(-0.87, -0.08, -0.85), V(0, 0.0, 0.85)), paint); lid.castShadow = true; this.trunk.add(lid);
      R.add(this.trunk);
      solid.add(boxGeo(V(x(-3.4), 0.15, -3.0), V(x(-2.8), 1.1, -2.6)), lam("podium", () => ({ color: "#c0353a" })));
    }
    solid.build(R);
    shell.build(R, false);
  }

  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 10, s.place === "factory" && dist > 12 ? 40 : 22);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // interiors: the golden preset is a backlit sunset; indoors it reads as warm lamp light, so lift the shade
    if (s.place === "room") { TONE.uShadeCol.value.set(0.5, 0.4, 0.36); TONE.uShadeLift.value.set(0.07, 0.05, 0.04); TONE.uLitCol.value.set(1.6, 1.36, 1.02); CHAR.uCharTint.value.set(1.0, 0.92, 0.8); }
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = s.place === "room" ? 40 : L.fogNear; this.fog.far = s.place === "room" ? 400 : L.fogFar;
    scene.fog = this.fog; scene.background = null;
    for (const m of this.clouds) m.lookAt(cam.position.x, m.position.y, cam.position.z);
    // ---- moving scenery ----
    // drawer: out on the hook and on "Didn't matter", shut otherwise
    const dOut = id === 1 ? smooth((t - EV.wipe + 0.35) / 0.3) : id === 2 ? smooth((t - EV.matter + 0.3) / 0.3) : 0;
    this.drawer.position.z = ROOM.cab[2] + 0.36 + 0.42 * dOut;
    this.beltMap.offset.y = -(t * BELT_SPEED) / 2;
    this.parcels.forEach((m, k) => {
      const px = parcelX(k, t);
      m.position.set(px, 0.87, BELT.z + ((k * 37) % 7 - 3) * 0.03);
      m.visible = px > BELT.x0 + 0.3 && px < BELT.x1 - 0.3;
    });
    // window: opens on "post", slams shut on "Deny by default" (and stays shut)
    const open = id === 8 ? smooth((t - EV.post - 0.2) / 0.5) : id === 9 ? 1 : id === 11 ? 1 - smooth((t - EV.deny + 0.12) / 0.12) : 0;
    this.sash.rotation.y = 1.15 * open;
    const alarm = id >= 11 && id <= 13 && t >= EV.deny;
    this.lampMat.color.set(alarm ? (Math.floor(t * 4) % 2 ? "#ff5a4a" : "#c0302a") : "#6a2a2a");
    // button press on "merge"
    this.button.position.y = 1.03 - 0.05 * (id === 4 ? Math.max(0, 1 - Math.abs(t - EV.merge - 0.05) / 0.15) : 0);
    // barrier arm: lifts for each approved parcel passing the gate (shots 11-13)
    const near = this.parcels.map((_, k) => parcelX(k, t)).filter((px) => px > GATE_X - 1.2 && px < GATE_X + 0.4).length;
    this.arm.rotation.x = id >= 11 && near ? -1.25 : 0;
    this.boothLamp.color.set(id >= 11 ? (near ? "#3ac05a" : "#d43a3a") : "#3ac05a");
    // ledger entries fill in from "One log"
    const nL = id >= 13 ? Math.min(24, 6 + Math.floor(Math.max(0, t - EV.log) * 6)) : id >= 11 ? 6 : 0;
    const mat = this.ledger.material as THREE.MeshBasicMaterial;
    const lt = ledgerTex(nL);
    if (mat.map !== lt) mat.map = lt;
    // delegation strings grow in on "delegated from a human"
    const winCU = id === 11 && t >= EV.deny - 6 / FPS && t < EV.policy - 6 / FPS; // strings would cross the window close-up
    const grow = winCU ? 0 : id === 11 ? clamp01((t - EV.delegated + 0.3) / 0.9) : id >= 12 && id <= 13 ? 1 : 0;
    this.strings.forEach((m, i) => {
      const g = clamp01(grow * 1.25 - i * 0.08);
      m.visible = g > 0;
      const n = (m.geometry.index?.count ?? 0);
      m.geometry.setDrawRange(0, Math.floor((n * g) / 36) * 36);
    });
    // trunk: tries to open on "won't open the trunk", bounces shut
    const tr = id === 10 ? t - EV.trunk : -1;
    this.trunk.rotation.z = tr > 0 && tr < 0.9 ? 0.32 * Math.sin(Math.min(1, tr / 0.25) * Math.PI / 2) * Math.max(0, 1 - Math.max(0, tr - 0.3) / 0.25) + 0.05 * Math.max(0, Math.sin((tr - 0.55) * 30)) * Math.max(0, 1 - (tr - 0.55) / 0.35) * (tr > 0.55 ? 1 : 0) : 0;

    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 2.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow && s.place !== "room";
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft);
      e2.mesh.visible = true;
      e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(p.rot ?? 0); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e2 of fused) e2.bind();
    return focus;
  }
}
export { Pen };
