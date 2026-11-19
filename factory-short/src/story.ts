// Timeline of the factory short ("The Deputy With the Master Key"): shots timed to the voice
// (claude-animator-env/factory-short/voice/words.json, onyx x1.3, 73.6 s), story event times, and the camera grammar
// from the skill: smootherstep glides 18-40 f, cuts on big reframes, every hold creeps, 7-frame flip kicks on impacts.
// Three sets live in one scene, far apart on x: the 1977 machine room (ROOM), the factory floor (origin), the street.
export const FPS = 30;
export const TOTAL = 2300; // 76.7 s: voice ends 72.9 s, end card from 73.0 s
export const D0 = 0; // ground height (build.ts helpers read it)
export type V3 = [number, number, number];
export const RX = -400; // machine room origin on x
export const SX = 400; // street origin on x

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

// ---------------- story events (seconds, from words.json word onsets) ----------------
export const EV = {
  wipe: 1.58, // "wiped out" (hook burst)
  slip: 6.98, // user hands the slip
  key: 7.92, // deputy picks the key
  didnt: 9.14, // user shows empty hands
  matter: 10.0, // drawer opens, billing records go
  nearly: 11.7, // shrug
  deputy: 13.58, // "confused deputy"
  ticket: 19.78, tests: 21.08, review: 22.16, merge: 23.14,
  ssh: 26.16, cloud: 27.2, github: 28.24,
  expires: 30.62,
  read: 32.02,
  poisoned: 36.26, post: 37.44, does: 39.8,
  luckily: 40.8, unluckily: 42.66,
  starts: 46.84, trunk: 47.4, back: 48.36, valet: 49.9,
  identity: 53.3, delegated: 54.08, deny: 55.14, policy: 56.12, guarantee: 60.36, human: 61.46,
  log: 63.4, laptop: 65.68,
  master: 68.78, ruined: 69.7, hand: 72.38,
  card: 73.0,
};

// ---------------- factory layout (metres) ----------------
export const BELT = { x0: -16, x1: 15, z: 0, y: 0.9, w: 1.0 };
export const AGENT_X = [-9, -4.5, 0, 4.5]; // ticket, tests, review, CI bot (behind the belt)
export const AGENT_Z = -1.0;
export const DEV: V3 = [9.5, 0, -1.0]; // developer at the merge station
export const BUTTON: V3 = [8.55, 0, -0.95];
export const WALL_Z = -3.2; // factory back wall
export const WIN: V3 = [1.9, 1.0, WALL_Z]; // paste-site window: centre x, sill y, wall z
export const WIN_SPOT: V3 = [1.05, 0, -2.6]; // where the review agent stands at the window
export const BOOTH: V3 = [12.6, 0, 1.45];
export const GATE_X = 12.0;
export const LEDGER: V3 = [-12.5, 2.55, WALL_Z + 0.05];
export const BELT_SPEED = 0.55; // m/s
// machine room (local, add RX)
export const ROOM = { deputy: [0.55, 0, -3.0] as V3, user: [-0.3, 0, -2.4] as V3, cab: [1.6, 0, -4.25] as V3 };
// street (local, add SX)
export const STREET = { car: [0, 0, -0.6] as V3, valet: [-1.75, 0, 0.85] as V3, owner: [1.35, 0, 0.95] as V3 };

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Place = "room" | "factory" | "street";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 168, light: "day", place: "room", sunAz: 150, sunEl: 38 },
  { id: 2, a: 168, b: 325, light: "day", place: "room", sunAz: 150, sunEl: 38 },
  { id: 3, a: 325, b: 449, light: "day", place: "room", sunAz: 150, sunEl: 38 },
  { id: 4, a: 449, b: 726, light: "day", place: "factory" },
  { id: 5, a: 726, b: 868, light: "day", place: "factory" },
  { id: 6, a: 868, b: 946, light: "day", place: "factory" },
  { id: 7, a: 946, b: 1072, light: "day", place: "factory" },
  { id: 8, a: 1072, b: 1224, light: "day", place: "factory" },
  { id: 9, a: 1224, b: 1372, light: "day", place: "factory", sunAz: 110 },
  { id: 10, a: 1372, b: 1550, light: "day", place: "street", sunAz: 70, sunEl: 42 },
  { id: 11, a: 1550, b: 1745, light: "day", place: "factory" },
  { id: 12, a: 1745, b: 1902, light: "day", place: "factory" },
  { id: 13, a: 1902, b: 2007, light: "day", place: "factory" },
  { id: 14, a: 2007, b: TOTAL, light: "day", place: "room", sunAz: 150, sunEl: 38 },
];
/** crossfades (frames) at place changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 4: 10, 10: 8, 11: 8, 14: 10 };
export const FLASH_AT = 168;
export const CARD_AT = Math.round(EV.card * FPS); // end card fades in over the last shot

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mixC = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixC(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
const F = (t: number) => Math.round(t * FPS);
/** push-in factor since f0 (subject grows ~rate per frame); punch raises it for n frames with 8 f soft edges */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });
const R = (x: number, y: number, z: number): V3 => [RX + x, y, z];
const S = (x: number, y: number, z: number): V3 => [SX + x, y, z];

// shot 1 (hook): the deputy at the gold billing cabinet, papers burst on "wiped out"
const S1a = (f: number) => dolly(R(0.2, 1.5, -0.6), R(1.35, 1.15, -3.9), pushK(f, 0, 0.0025), { fov: 42, roll: -0.03 });
const S1b = (f: number) => dolly(R(0.6, 1.25, -1.4), R(1.5, 1.2, -3.9), pushK(f, 60, 0.002), { fov: 40, roll: 0.035 });
// shot 2: establishing wide of the machine room -> MS on the key -> the drawer
const S2a = (f: number) => zoom(R(-1.4, 2.1, 3.6), R(0.2, 1.15, -3.4), 46, pushK(f, 168, 0.0018));
const S2b = (f: number) => dolly(R(0.1, 1.55, 0.7), R(0.15, 1.25, -2.7), pushK(f, F(EV.key) - 12, 0.0025), { fov: 40 });
const S2c = (f: number) => dolly(R(0.5, 1.35, -1.6), R(1.55, 1.05, -4.0), pushK(f, F(EV.matter) - 4, 0.002, 0.006, 30), { fov: 40, roll: -0.04 });
// shot 3: CU of the deputy, punch on "confused deputy"
const S3a = (f: number) => dolly(R(0.5, 1.62, -1.2), R(0.55, 1.5, -3.0), pushK(f, 325, 0.0022, 0.006, 32), { fov: 38 });
const S3b = (f: number) => dolly(R(0.62, 1.6, -1.45), R(0.55, 1.55, -3.0), pushK(f, F(EV.deputy) - 6, 0.0015, 0.006, 32), { fov: 36, roll: 0.04 });
// shot 4: factory aerial -> each station along the line -> the developer clicks merge
const S4a = (f: number) => zoom([-17, 10.5, 15], [-1, 0.6, -1.2], 46, pushK(f, 444, 0.0016));
const stationMS = (x: number, f0: number) => (f: number) => dolly([x + 0.8, 1.75, 3.0], [x, 1.25, -0.8], pushK(f, f0, 0.0022), { fov: 40 });
const S4e = (f: number) => dolly([DEV[0] - 1.6, 1.7, 2.6], [DEV[0] - 0.4, 1.15, -0.9], pushK(f, F(EV.merge) - 10, 0.0025, 0.006, 26), { fov: 40, roll: 0.035 });
// shot 5: lateral MS past the agents raising the developer's keyring
const lateral = (x: number, f0: number) => (f: number) => dolly([x + 0.4, 1.7, 3.3], [x, 1.35, -1.0], pushK(f, f0, 0.002), { fov: 38 });
// shot 6: CU of the CI bot and its golden key
const S6a = (f: number) => dolly([AGENT_X[3] + 0.35, 1.55, 1.25], [AGENT_X[3], 1.4, -1.0], pushK(f, 868, 0.0022, 0.006, 30), { fov: 36 });
// shot 7: tickets drift in; two agents read
const S7a = (f: number) => dolly([-4.15, 1.9, 3.3], [-4.5, 1.55, -1.0], pushK(f, 946, 0.002), { fov: 44, roll: -0.03 });
// shot 8: the poisoned ticket; the agent walks to the window and posts the envelope
const S8a = (f: number) => dolly([0.9, 1.65, 2.5], [0.4, 1.35, -1.5], pushK(f, 1072, 0.0022), { fov: 40 });
const S8b = (f: number) => dolly([0.6, 1.7, 0.6], [WIN[0], 1.55, WALL_Z], pushK(f, F(EV.post) - 8, 0.0018), { fov: 42, roll: -0.03 });
const S8c = (f: number) => dolly([1.2, 1.65, -0.2], [WIN[0] + 0.1, 1.7, WALL_Z - 0.4], pushK(f, F(EV.does) - 4, 0.002, 0.006, 28), { fov: 38, roll: 0.04 });
// shot 9: deadpan CU, roll on "Unluckily"
const S9a = (f: number) => dolly([WIN_SPOT[0] - 0.12, 1.58, -0.6], [WIN_SPOT[0] + 0.08, 1.5, WIN_SPOT[2]], pushK(f, 1224, 0.0018), { fov: 38 });
const S9b = (f: number) => dolly([WIN_SPOT[0] - 0.08, 1.58, -0.85], [WIN_SPOT[0] + 0.06, 1.52, WIN_SPOT[2]], pushK(f, F(EV.unluckily) - 8, 0.0018, 0.005, 30), { fov: 36, roll: 0.045 });
// shot 10: the valet stand
const S10a = (f: number) => zoom(S(0.2, 1.75, 6.4), S(-0.2, 0.95, -0.4), 44, pushK(f, 1368, 0.0016));
const S10b = (f: number) => dolly(S(-1.0, 1.5, 3.4), S(-1.9, 0.95, -0.4), pushK(f, F(EV.trunk) - 10, 0.0022), { fov: 40, roll: -0.03 });
const S10c = (f: number) => dolly(S(0.1, 1.6, 3.4), S(-0.1, 1.2, 0.85), pushK(f, F(EV.back) - 8, 0.002), { fov: 40 });
const S10d = (f: number) => dolly(S(-0.05, 1.5, 4.5), S(-0.05, 1.2, 0.9), pushK(f, F(EV.valet) - 4, 0.0018, 0.006, 30), { fov: 36, roll: 0.035 });
// shot 11: the fix along the line: badges tied to the developer, the window shuts, the guard's booth
const S11a = (f: number) => zoom([-2.2, 2.6, 6.6], [2.2, 1.3, -1.2], 46, pushK(f, 1546, 0.0016));
const S11b = (f: number) => dolly([0.4, 1.75, 0.9], [WIN[0], 1.55, WALL_Z], pushK(f, F(EV.deny) - 6, 0.002, 0.006, 26), { fov: 42 });
const S11c = (f: number) => dolly([BOOTH[0] - 0.9, 1.5, 5.4], [BOOTH[0] - 0.2, 1.1, 1.2], pushK(f, F(EV.policy) - 6, 0.0022), { fov: 40 });
// shot 12: the guard checks each parcel; then the developer stamps at merge
const S12a = (f: number) => dolly([BOOTH[0] - 0.35, 1.35, 3.9], [BOOTH[0], 1.2, 1.35], pushK(f, 1745, 0.002), { fov: 38, roll: 0.03 });
const S12b = (f: number) => dolly([DEV[0] - 0.4, 1.7, 2.5], [DEV[0] - 0.4, 1.1, -0.7], pushK(f, F(EV.human) - 8, 0.0022, 0.006, 26), { fov: 40 });
// shot 13: the ledger fills, then a long pull back over the whole factory
const S13a = (f: number) => dolly([LEDGER[0] + 0.4, 2.3, 1.2], [LEDGER[0], 2.45, WALL_Z], pushK(f, 1902, 0.002), { fov: 40 });
const S13b = (f: number): Shot => {
  const u = glide((f - F(EV.laptop) + 30) / 75), a = S13a(F(EV.laptop) - 30);
  const B: V3 = [3, 9.5, 17], L: V3 = [0, 0.8, -1.2];
  return { pos: a.pos.map((v, i) => v + (B[i] - v) * u) as V3, look: a.look.map((v, i) => v + (L[i] - v) * u) as V3, fov: 40 + 6 * u };
};
// shot 14: callback in the machine room, the single small key; holds under the end card
const S14a = (f: number) => dolly(R(-0.5, 1.6, 1.0), R(0.6, 1.25, -3.6), pushK(f, 2003, 0.0016), { fov: 44 });
const S14b = (f: number) => dolly(R(0.4, 1.55, -0.9), R(0.6, 1.35, -3.0), pushK(f, F(EV.master) - 8, 0.0016), { fov: 40 });
const S14c = (f: number) => dolly(R(0.5, 1.58, -1.3), R(0.58, 1.45, -3.0), pushK(f, F(EV.hand) - 6, 0.0012, 0.005, 30), { fov: 38, roll: -0.035 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 60, dur: 34, s: S1b }],
  2: [{ f: 164, s: S2a }, { f: F(EV.key) - 12, cut: true, s: S2b }, { f: F(EV.matter) - 4, cut: true, s: S2c }],
  3: [{ f: 321, s: S3a }, { f: F(EV.deputy) - 12, dur: 26, s: S3b }],
  4: [
    { f: 440, s: S4a },
    { f: F(EV.ticket) - 3, cut: true, s: stationMS(AGENT_X[0], F(EV.ticket) - 3) },
    { f: F(EV.tests) - 13, dur: 26, s: stationMS(AGENT_X[1], F(EV.tests)) },
    { f: F(EV.review) - 13, dur: 26, s: stationMS(AGENT_X[2], F(EV.review)) },
    { f: F(EV.merge) - 10, cut: true, s: S4e },
  ],
  5: [
    { f: 722, s: lateral(AGENT_X[0], 722) },
    { f: F(EV.ssh) - 14, dur: 28, s: lateral(AGENT_X[1], F(EV.ssh)) },
    { f: F(EV.cloud) - 14, dur: 28, s: lateral(AGENT_X[2], F(EV.cloud)) },
    { f: F(EV.github) - 14, dur: 28, s: lateral(AGENT_X[3], F(EV.github)) },
  ],
  6: [{ f: 864, s: S6a }, { f: F(EV.expires) - 10, dur: 20, s: rolled(S6a, 0.04) }],
  7: [{ f: 942, s: S7a }],
  8: [{ f: 1068, s: S8a }, { f: F(EV.post) - 8, cut: true, s: S8b }, { f: F(EV.does) - 4, cut: true, s: S8c }],
  9: [{ f: 1220, s: S9a }, { f: F(EV.unluckily) - 8, dur: 22, s: S9b }],
  10: [{ f: 1368, s: S10a }, { f: F(EV.trunk) - 10, cut: true, s: S10b }, { f: F(EV.back) - 8, cut: true, s: S10c }, { f: F(EV.valet) - 4, cut: true, s: S10d }],
  11: [{ f: 1546, s: S11a }, { f: F(EV.deny) - 6, cut: true, s: S11b }, { f: F(EV.policy) - 6, cut: true, s: S11c }],
  12: [{ f: 1741, s: S12a }, { f: F(EV.human) - 8, cut: true, s: S12b }],
  13: [{ f: 1898, s: S13a }, { f: F(EV.laptop) - 30, s: S13b }],
  14: [{ f: 2003, s: S14a }, { f: F(EV.master) - 8, cut: true, s: S14b }, { f: F(EV.hand) - 18, dur: 28, s: S14c }],
};

// impact kicks: offset flips sign every frame, decays to 0 in 7 f
const KICKS: [number, number][] = [[EV.wipe, 1], [EV.matter, 0.8], [EV.merge, 0.5], [EV.does, 1], [EV.trunk + 0.35, 0.6], [EV.deny, 0.8], [EV.human, 0.6]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 13 }, // hook CU: deputy + cabinet
  { f: 168, cInf: 0 }, // establishing wide
  { f: F(EV.key) - 12, cInf: 11 }, // MS key
  { f: F(EV.matter) - 4, cInf: 12 }, // drawer
  { f: 325, cInf: 14 }, // deputy CU
  { f: 449, cInf: 0 }, // factory aerial
  { f: F(EV.ticket) - 3, cInf: 11 }, // station MSs
  { f: F(EV.merge) - 10, cInf: 12 },
  { f: 726, cInf: 10 }, // lateral MS
  { f: 868, cInf: 14 }, // CI bot CU
  { f: 946, cInf: 8 }, // reading
  { f: 1072, cInf: 10 }, // poisoned ticket
  { f: F(EV.post) - 8, cInf: 9 },
  { f: F(EV.does) - 4, cInf: 11 },
  { f: 1224, cInf: 14 }, // deadpan CU
  { f: 1372, cInf: 0 }, // street wide
  { f: F(EV.trunk) - 10, cInf: 10 },
  { f: F(EV.valet) - 4, cInf: 13 },
  { f: 1550, cInf: 0 }, // fix wide
  { f: F(EV.deny) - 6, cInf: 10 },
  { f: F(EV.policy) - 6, cInf: 9 },
  { f: 1745, cInf: 12 }, // guard CU
  { f: F(EV.human) - 8, cInf: 11 },
  { f: 1902, cInf: 8 }, // ledger
  { f: F(EV.laptop) - 30, dur: 40, cInf: 0 }, // pull back sharp
  { f: 2007, cInf: 6 }, // callback wide
  { f: F(EV.master) - 8, cInf: 12 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};
