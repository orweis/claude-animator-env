// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, fxBurst, fxShadow, fxContact, fxPuff, akita, fxPapers, fxTicket, fxPigeon, fxVerdict, fxExhaust, fxGlow, fxEnvelope,
  Outfit, Expr, FrontOpts, SideOpts, INK, SKIN, SKINS, shade,
} from "./toon";
import {
  FPS, SHOTS, RX, SX, EV, AGENT_X, AGENT_Z, DEV, WIN, WIN_SPOT, WALL_Z, BOOTH, GATE_X, ROOM, STREET, BELT, V3, smooth, clamp01,
} from "./story";
import { LIGHTS } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const vOf = (i: number) => (i * 7 + (i >> 2)) % 4;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const SWAPS: Record<number, number[]> = {};
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- the factory short's cast ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };
const GOLD = "#e8b93a";
const DEPUTY: Outfit = { jacket: "#c9a46a", pants: "#5a4a3a", boots: "#4a3020", hat: "stetson", cap: "#b08a52", badge: GOLD, keyring: true, moustache: "#5a3b2a", build: "stout", skin: SKIN };
const DEPUTY_LATER: Outfit = { ...DEPUTY, keyring: false };
const USER: Outfit = { jacket: "#b5653f", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#5a3b2a", skin: SKINS[1] };
const AGENT_COL = ["#2f9e8f", "#e0604a", "#7b5ac9", "#e8b43a"];
const AGENTS: Outfit[] = AGENT_COL.map((c, i) => ({ jacket: c, pants: shade(c, 0.72), boots: INK, hat: "cap", cap: c, straps: shade(c, 0.82), skin: SKINS[(i + 2) % 4],
  ...(i === 3 ? { neckKey: GOLD } : {}) }));
const DEVO: Outfit = { jacket: "#3f6fb5", pants: "#3b3f52", boots: "#f4f1ea", hat: "hair", hair: "#2a201a", skin: SKINS[2] };
const VALET: Outfit = { jacket: "#c0353a", pants: "#2e2a36", boots: INK, hat: "cap", cap: "#c0353a", buttons: "#e8c45a", skin: SKINS[3] };
const L = LEAD;
const after = (t: number, ev: number) => t >= ev - L;
const ramp = (t: number, t0: number, d = 0.25) => smooth((t - t0 + L) / d);

type Who2 = { i: number; o: Outfit; okey: string };
const front = (cam: CamInfo, out: Stage, who: Who2, x: number, y: number, z: number, fo: FrontOpts, t: number, scale = 1, shadow = true) => {
  out.places.push(person(cam, who, x, y, z, { side: false, mirror: false }, { mode: "stand", blink: lidAt(t, who.i), ...fo }, {} as SideOpts, scale));
  if (shadow) blob(out, x, y, z, scale);
};
const deputyWho: Who2 = { i: 11, o: DEPUTY, okey: "dep" }, userWho: Who2 = { i: 12, o: USER, okey: "usr" };
const agentWho = (i: number): Who2 => ({ i: 20 + i, o: AGENTS[i], okey: `ag${i}` });
const devWho: Who2 = { i: 30, o: DEVO, okey: "dev" }, valetWho: Who2 = { i: 31, o: VALET, okey: "val" };
const R3 = (v: V3): V3 => [RX + v[0], v[1], v[2]];
const S3 = (v: V3): V3 => [SX + v[0], v[1], v[2]];
const q30 = (u: number) => q(u, 30);

/** billing sheets bursting out of the drawer */
const papers = (out: Stage, t: number, t0: number) => {
  const u = (t - t0) / 1.6;
  if (u < 0 || u >= 1) return;
  const [x, , z] = R3(ROOM.cab);
  out.fx.push({ key: `papers${q30(u)}`, cw: 600, ch: 600, draw: (p) => fxPapers(p, q30(u)), x, y: 1.35, z: z + 0.75, w: 2.2, h: 2.2 });
  if (u < 0.25) out.fx.push({ key: `burst${q30(u * 4)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q30(u * 4), "#fff3b0"), x, y: 1.15, z: z + 0.7, w: 1.0, h: 1.0 });
};

const room = (id: number, t: number, cam: CamInfo, out: Stage) => {
  const [dx, , dz] = R3(ROOM.deputy), [ux, , uz] = R3(ROOM.user);
  if (id === 1) {
    front(cam, out, deputyWho, dx + 0.15, 0, dz - 0.2, { expr: after(t, EV.wipe) ? "shock" : "neutral", prop: "slip", raise: 0.2, facing: 1 }, t);
    papers(out, t, EV.wipe);
  } else if (id === 2) {
    const hasSlip = after(t, EV.slip + 0.25);
    front(cam, out, userWho, ux, 0, uz, { expr: after(t, EV.didnt) ? "nervous" : "smile", prop: hasSlip ? null : "slip", raise: 0.35, palms: after(t, EV.didnt) ? ramp(t, EV.didnt) : 0, facing: 1 }, t);
    const keyUp = after(t, EV.key) ? ramp(t, EV.key) : 0;
    front(cam, out, deputyWho, dx, 0, dz, { expr: after(t, EV.matter) ? "grin" : after(t, EV.key) ? "smile" : "neutral", prop: after(t, EV.key) ? "key" : hasSlip ? "slip" : null, raise: 0.25 + 0.6 * keyUp, facing: -1 }, t);
    papers(out, t, EV.matter);
  } else if (id === 3) {
    const shrug = after(t, EV.nearly) && !after(t, EV.deputy - 0.4) ? ramp(t, EV.nearly) : 0;
    front(cam, out, deputyWho, dx, 0, dz, { expr: after(t, EV.deputy) ? "dazed" : after(t, EV.nearly) ? "smile" : "neutral", palms: shrug, facing: 0, headTilt: after(t, EV.deputy) ? 6 : 0 }, t);
  } else {
    const k = after(t, EV.hand) ? ramp(t, EV.hand, 0.3) : 0;
    front(cam, out, { ...deputyWho, o: DEPUTY_LATER, okey: "dep2" }, dx, 0, dz, { expr: after(t, EV.ruined) ? "smile_closed" : "smile", prop: "key", raise: 0.35 + 0.6 * k, facing: -1 }, t);
    front(cam, out, userWho, ux - 0.2, 0, uz - 0.4, { expr: "smile", facing: 1 }, t);
  }
};

/** a ticket (or the poisoned one) drifting down onto an agent's hands */
const ticketFall = (out: Stage, t: number, t0: number, x: number, z: number, bad = false) => {
  const u = (t - t0) / 1.1;
  if (u < 0 || u >= 1) return;
  out.fx.push({ key: `ticket${bad ? "B" : ""}`, cw: 300, ch: 380, draw: (p) => fxTicket(p, bad), x: x + 0.25 * Math.sin(u * 7), y: 3.0 - 1.7 * u, z: z + 0.25, w: 0.32, h: 0.4, rot: 0.5 * Math.sin(u * 9) });
};

const factory = (id: number, t: number, cam: CamInfo, out: Stage) => {
  // the four agents behind the belt, the developer at merge
  for (let i = 0; i < 4; i++) {
    let x = AGENT_X[i], z = AGENT_Z, fo: FrontOpts = { expr: "smile" };
    if (id === 4) fo = { expr: i === 0 && after(t, EV.ticket) ? "grin" : "smile", prop: i === 0 ? "ticket" : i === 1 ? "stamp" : null, raise: 0.15 };
    if (id === 5) {
      const t0 = [24.4, EV.ssh, EV.cloud, EV.github][i];
      fo = { expr: after(t, t0) ? "grin" : "smile", prop: "keyring", raise: after(t, t0) ? 0.3 + 0.7 * ramp(t, t0) : 0.1 };
    }
    if (id === 6) fo = { expr: i === 3 ? (after(t, EV.expires) ? "grin" : "smile_closed") : "smile" };
    if (id === 7) {
      const t0 = EV.read - 1.2 + i * 0.35;
      ticketFall(out, t, t0, x, z);
      fo = { expr: after(t, t0 + 1.1) ? "neutral" : "smile", prop: after(t, t0 + 1.1) ? "ticket" : null, raise: 0.45 };
    }
    if (id === 8 && i === 2) {
      ticketFall(out, t, EV.poisoned - 1.0, x, z, true);
      const walk = smooth((t - (EV.post - 0.9)) / 0.85);
      x = x + (WIN_SPOT[0] - x) * walk; z = z + (WIN_SPOT[2] - z) * walk;
      const sent = after(t, EV.does - 0.15);
      fo = { expr: sent ? "grin" : after(t, EV.poisoned) ? "neutral" : "smile", prop: sent ? null : after(t, EV.post) ? "envelope" : after(t, EV.poisoned) ? "ticketBad" : null,
        raise: after(t, EV.post) ? ramp(t, EV.post, 0.4) : 0.45, phase: walk > 0 && walk < 1 ? q((t * 1.6) % 1) : 0, mode: walk > 0 && walk < 1 ? "stroll" : "stand" };
    }
    if (id === 9 && i === 2) { x = WIN_SPOT[0]; z = WIN_SPOT[2]; fo = { expr: after(t, EV.unluckily) ? "smile" : "grin", prop: "badge", raise: 0.55 }; }
    if (id >= 11) fo = { expr: "smile", prop: "badge", raise: 0 };
    front(cam, out, agentWho(i), x, 0, z, { look: id === 7 ? 0 : 0, ...fo }, t);
  }
  const press = id === 4 && after(t, EV.merge - 0.2);
  const stamp = id === 12 ? 1 - Math.max(0, 1 - Math.abs(t - EV.human - 0.05) / 0.2) : 1;
  front(cam, out, devWho, DEV[0], 0, DEV[2], {
    expr: press ? "grin" : id === 12 && after(t, EV.human) ? "smile_closed" : "smile",
    prop: id === 12 ? "stamp" : null, raise: id === 12 ? 0.35 + 0.65 * stamp : 0, facing: -1,
  }, t);
  if (id === 12 && after(t, EV.human)) {
    const u = (t - EV.human) / 1.2;
    if (u < 1) out.fx.push({ key: `ok${q30(u)}`, cw: 300, ch: 300, draw: (p) => fxVerdict(p, true, q30(u)), x: DEV[0] - 0.55, y: 1.55 + 0.2 * u, z: BELT.z, w: 0.36, h: 0.36 });
  }
  // the pigeon on the sill outside the paste-site window
  if (id === 8 || id === 9) {
    const sent = id === 9 ? 99 : t - EV.does;
    if (id === 8 && sent > -0.6 && sent < 0) {
      const u = (sent + 0.6) / 0.6;
      out.fx.push({ key: "env", cw: 300, ch: 220, draw: fxEnvelope, x: WIN_SPOT[0] + 0.3 + 0.8 * u, y: 1.45 + 0.25 * Math.sin(u * Math.PI), z: WIN_SPOT[2] - 0.6 * u, w: 0.22, h: 0.18, rot: u * 3 });
    }
    const fly = Math.max(0, sent - 0.2), wing = q30(fly > 0 ? 0.5 + 0.5 * Math.sin(t * 40) : 0.1);
    if (fly < 1.8) out.fx.push({ key: `pigeon${wing}|${sent > 0 ? 1 : 0}`, cw: 360, ch: 300, draw: (p) => fxPigeon(p, wing, sent > 0), x: WIN[0] + 0.15 + 1.6 * fly, y: WIN[1] + 0.22 + 1.1 * fly * fly, z: WALL_Z - 0.22, w: 0.6, h: 0.5 });
  }
  if (id === 6 && after(t, EV.expires)) {
    const u = (t - EV.expires) / 0.5;
    if (u < 1) out.fx.push({ key: `glint${q30(u)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q30(u), "#fff6c8", 8, 20, 200), x: AGENT_X[3] + 0.02, y: 1.18, z: AGENT_Z + 0.1, w: 0.4, h: 0.4 });
  }
  if (id >= 11 && id <= 13 && after(t, EV.deny)) out.fx.push({ key: "glowRed", cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,80,60,0.55)"), x: WIN[0], y: WIN[1] + 1.55, z: WALL_Z + 0.2, w: 0.9, h: 0.9, soft: true });
  // the guard in the booth (shots 11-13)
  if (id >= 11) {
    const nod = q30(Math.max(0, Math.sin(t * Math.PI * 1.1)) ** 3), blink = lidAt(t, 40);
    const expr = id === 12 && t > EV.guarantee - L && t < EV.human ? "stern" : "smile";
    const paw = id === 12 ? q30(Math.max(0, Math.sin((t - 58.3) * 2.2))) : 0;
    const d = cam.pos.distanceTo(tmp.set(BOOTH[0], 1.0, BOOTH[2]));
    const [w, h, k] = tier(d);
    out.places.push({ key: `akita|${nod}|${expr}|${blink}|${paw}`, x: BOOTH[0], y: 0.45, z: BOOTH[2] - 0.1, size: [w, h, k],
      draw: (p) => akita(p, { nod, expr, blink, light: light2D(cam, false), paw }) });
    // a verdict pops over each parcel as it reaches the gate
    if (id === 12) for (let kk = 0; kk < 2; kk++) {
      const u = ((t - 58.2 + kk * 1.4) % 2.8) / 1.0;
      if (u >= 0 && u < 1) out.fx.push({ key: `v${kk}${q30(u)}`, cw: 300, ch: 300, draw: (p) => fxVerdict(p, kk === 0, q30(u)), x: GATE_X - 0.4, y: 1.55 + 0.15 * u, z: BELT.z, w: 0.32, h: 0.32 });
    }
  }
};

const street = (t: number, cam: CamInfo, out: Stage) => {
  const [cx, , cz] = S3(STREET.car), [vx0, , vz] = S3(STREET.valet), [ox, , oz] = S3(STREET.owner);
  const walk = smooth((t - (EV.back - 0.9)) / 0.8), vx = vx0 + (cx - 0.38 - vx0) * walk;
  const handed = after(t, EV.back + 0.35), shrug = after(t, EV.trunk + 0.35) && !after(t, EV.back - 0.9) ? ramp(t, EV.trunk + 0.35) : 0;
  front(cam, out, valetWho, vx, 0, vz, {
    expr: shrug ? "nervous" : after(t, EV.valet) ? "grin" : "smile", prop: handed && !after(t, EV.valet) ? null : "key",
    raise: after(t, EV.valet) ? 0.2 + 0.3 * ramp(t, EV.valet, 0.3) : after(t, EV.back) ? 0.5 : 0.2, palms: shrug,
    phase: walk > 0 && walk < 1 ? q((t * 1.6) % 1) : 0, mode: walk > 0 && walk < 1 ? "stroll" : "stand", facing: 1,
  }, t);
  front(cam, out, devWho, cx + 0.32, 0, oz, {
    expr: after(t, EV.valet) ? "smile_closed" : "smile", prop: after(t, EV.valet) ? "keyring" : handed ? "key" : null,
    raise: after(t, EV.valet) ? 0.2 + 0.3 * ramp(t, EV.valet, 0.3) : 0.3, facing: -1,
  }, t);
  void ox;
  const u = (t - EV.starts) / 1.4;
  if (u >= 0 && u < 1) out.fx.push({ key: `exh${q30(u)}`, cw: 300, ch: 300, draw: (p) => fxExhaust(p, q30(u)), x: cx - 2.5, y: 0.5, z: cz + 0.3, w: 1.2, h: 1.2, soft: true });
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (s.place === "room") room(id, t, cam, out);
  else if (s.place === "factory") factory(id, t, cam, out);
  else street(t, cam, out);
  return out;
};
export { FPS, fxPuff };
