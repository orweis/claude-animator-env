"""Sound for the factory short: synthesized SFX on the picture's event table + an original light score, ducked under
the voice, mixed to mix.wav (48 kHz stereo, exactly the film's length) with stems.
Builds on the cartoon-3d-short skill's audio toolkit (dsp.py, instruments.py, sfx_gen.py), imported from the skill folder.
Usage: python make_sound.py   (reads ../voice/voice.wav + words.json, writes mix.wav, stems/, cues.md here)
Mix convention (skill): music +3 dB, SFX -6 dB relative to the house levels below, voice unchanged."""
import json, os, sys
import numpy as np

SK = os.path.expanduser("~/.claude/skills/cartoon-3d-short/templates/audio")
sys.path.insert(0, SK)
from dsp import SR, ns, tt, dbg, rng, lp, hp, bp, fades, pan, st, place, widen, make_ir, convolve_st, integrated, \
    momentary_max, true_peak, read_wav, write_wav, modal, phase, colored, smooth_noise  # noqa: E402
import instruments as I  # noqa: E402
import sfx_gen as G  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FPS, TOTAL = 30, 2300
DUR = TOTAL / FPS
N = ns(DUR)
EV = dict(wipe=1.58, flash=5.6, slip=6.98, key=7.92, didnt=9.14, matter=10.0, nearly=11.7, deputy=13.58, factory=14.98,
          ticket=19.78, tests=21.08, review=22.16, merge=23.14, ssh=26.16, cloud=27.2, github=28.24, expires=30.62, read=32.02,
          poisoned=36.26, post=37.44, does=39.8, luckily=40.8, unluckily=42.66, street=45.76, starts=46.84, trunk=47.4,
          back=48.36, valet=49.9, fix=51.68, delegated=54.08, deny=55.14, policy=56.12, guarantee=60.36, human=61.46,
          log=63.4, laptop=65.68, callback=66.9, master=68.78, hand=72.38, card=73.0)
# places by time (for beds): room / factory / street
PLACES = [(0, 14.98, "room"), (14.98, 45.76, "factory"), (45.76, 51.68, "street"), (51.68, 66.9, "factory"), (66.9, DUR, "room")]
R = rng(7)

# ---------------------------------------------------------------- SFX
def keys_jingle(r, n=10, dur=0.45, f=1.0):
    y = np.zeros(ns(dur + 0.2))
    for k in range(n):
        c = G.clink(r, f0=np.exp(r.uniform(np.log(2200), np.log(6000))) * f, dur=0.12)
        G._place_mono(y, c * r.uniform(0.4, 1.0), r.uniform(0, dur) ** 1.3)
    return y
def paper_flutter(r, dur=0.8, rate=14):
    t = tt(dur); y = np.zeros(len(t)); nz = r.standard_normal(len(t))
    for k in range(int(dur * rate)):
        t0 = r.uniform(0, dur * 0.9); i = ns(t0); m = ns(0.05)
        if i + m < len(y): y[i:i + m] += bp(nz[i:i + m], 1500, 7000, 1) * np.hanning(m) * r.uniform(0.3, 1)
    return y * np.exp(-t / (dur * 0.6))
def drawer_slide(r):
    d = 0.45; t = tt(d); nz = colored(len(t), r, 0.4)
    y = bp(nz, 300, 2500, 1) * np.sin(np.pi * np.clip(t / 0.35, 0, 1)) * 0.6
    y += modal(d, [(140, 1.0, 0.06), (310, 0.6, 0.04)], r) * (t > 0.3) * np.exp(-np.maximum(0, t - 0.3) / 0.05) * 1.2
    return y
def click(r, f=2400, amp=1.0):
    d = 0.08; t = tt(d)
    return (modal(d, [(f, 1.0, 0.008), (f * 2.3, 0.5, 0.004)], r) + hp(r.standard_normal(len(t)), 3000) * np.exp(-t / 0.001)) * amp
def ding(f=1568, vel=0.6, r=None): return I.glock(f, vel, r or R, 1.6)
def sparkle(r, n=6, f0=2093):
    y = np.zeros(ns(1.4))
    for k in range(n): G._place_mono(y, I.glock(f0 * 2 ** (k * 2 / 12), 0.35, r, 0.8), 0.06 * k)
    return y
def creak_short(r): return G.creak(0.55, r, 120, 240)
def slam(r):
    d = 0.6; t = tt(d)
    body = modal(d, [(120, 1.0, 0.07), (260, 0.8, 0.05), (520, 0.5, 0.03), (900, 0.3, 0.02)], r)
    hit = bp(r.standard_normal(len(t)), 300, 5000, 1) * np.exp(-t / 0.006)
    glass = modal(d, [(3200, 0.25, 0.15), (4700, 0.18, 0.1)], r)
    return body * 1.2 + hit + glass
def flaps(r, dur=1.4, rate=9):
    t = tt(dur); y = np.zeros(len(t)); nz = r.standard_normal(len(t))
    for k in range(int(dur * rate)):
        i = ns(k / rate); m = ns(0.06)
        if i + m < len(y): y[i:i + m] += bp(nz[i:i + m], 400, 2500, 1) * np.hanning(m) * (1 - k / (dur * rate))
    return y
def engine_start(r):
    d = 1.6; t = tt(d)
    crank = sum(np.exp(-((t - 0.08 * k) / 0.02) ** 2) for k in range(5)) * 0.6
    f = 32 + 18 * np.clip((t - 0.4) / 0.3, 0, 1) - 6 * np.clip((t - 0.8) / 0.6, 0, 1)
    rum = np.sin(phase(f)) + 0.5 * np.sin(phase(2 * f)) + 0.3 * np.sign(np.sin(phase(f)))
    env = np.clip((t - 0.35) / 0.1, 0, 1) * np.exp(-np.maximum(0, t - 0.9) / 0.5)
    return lp(rum * env + crank * bp(r.standard_normal(len(t)), 200, 1200, 1), 900)
def thunk(r):
    d = 0.4; t = tt(d)
    return modal(d, [(95, 1.0, 0.07), (210, 0.6, 0.04), (480, 0.3, 0.02)], r) + bp(r.standard_normal(len(t)), 200, 3000, 1) * np.exp(-t / 0.004) * 0.6
def stamp(r):
    y = G.push_thump(r) * 0.8; c = click(r, 900, 0.6); y[:len(c)] += c; return y
def beep(f, d=0.12):
    t = tt(d); return np.sin(2 * np.pi * f * t) * np.sin(np.pi * t / d) ** 0.5
def scribble(r, d=0.14):
    t = tt(d); return bp(r.standard_normal(len(t)), 2000, 7000, 1) * (0.6 + 0.4 * np.sin(2 * np.pi * 38 * t)) * np.sin(np.pi * t / d)
def sting_low(r):
    d = 1.6; return I.pad([m for m in (I.m2f(46), I.m2f(52), I.m2f(53))], d, 0.5, r, 0.05, 0.7, 600)

sfx = np.zeros((2, N)); events = []
def ev(name, x, t, gain_db=0.0, p=0.0, width=False):
    x = np.asarray(x, float)
    y = widen(x, R) if (width and x.ndim == 1) else (pan(x, p) if x.ndim == 1 else x)
    place(sfx, y, t, dbg(gain_db)); events.append((t, name, gain_db))

ev("whoosh-hook", G.whoosh(0.7, R, 0.25), EV["wipe"] - 0.25, -4)
ev("papers", paper_flutter(R, 1.4), EV["wipe"], -2, 0.3, True)
ev("burst-snare", I.snare(0.7, R), EV["wipe"], -6)
ev("flash-whoosh", G.whoosh(0.5, R, 0.3, 600, 3000), EV["flash"] - 0.3, -8, width=True)
ev("slip", paper_flutter(R, 0.3, 20), EV["slip"], -8, -0.2)
ev("keys", keys_jingle(R), EV["key"] - 0.05, -4, 0.2)
ev("drawer", drawer_slide(R), EV["matter"] - 0.3, -3, 0.3)
ev("papers2", paper_flutter(R, 1.5), EV["matter"], -2, 0.3, True)
ev("dazed", sparkle(R, 5, 1047), EV["deputy"], -10)
ev("to-factory", G.whoosh(0.9, R, 0.45), EV["factory"] - 0.45, -8, width=True)
for k, t0 in enumerate([EV["ticket"], EV["tests"], EV["review"]]): ev(f"station{k}", click(R, 1800 + 300 * k, 0.7), t0, -10, -0.3 + 0.3 * k)
ev("button", click(R, 1200, 1.0), EV["merge"], -4, 0.4); ev("merge-ding", ding(1568, 0.6), EV["merge"] + 0.05, -8, 0.4)
for k, t0 in enumerate([24.4, EV["ssh"], EV["cloud"], EV["github"]]): ev(f"keyring{k}", keys_jingle(R, 14, 0.5), t0, -5, -0.4 + 0.27 * k)
ev("glint", sparkle(R), EV["expires"], -9, 0.1)
for k in range(4): ev(f"ticket{k}", paper_flutter(R, 1.0, 10), EV["read"] - 1.2 + 0.35 * k, -11, -0.5 + 0.3 * k)
ev("poison-ticket", paper_flutter(R, 1.0, 10), EV["poisoned"] - 1.0, -9)
ev("poison-sting", sting_low(R), EV["poisoned"], -10, width=True)
for k in range(3): ev(f"step{k}", G.stroll_step(R, 0.3), EV["post"] - 0.85 + k * 0.3, -14, 0.2)
ev("window-open", creak_short(R), EV["post"] + 0.15, -8, 0.3)
ev("envelope", G.whoosh(0.5, R, 0.35, 700, 2600), EV["does"] - 0.5, -8, 0.3)
ev("flaps", flaps(R), EV["does"] + 0.15, -6, 0.5, True)
ev("street-whoosh", G.whoosh(0.8, R, 0.4), EV["street"] - 0.4, -9, width=True)
ev("engine", engine_start(R), EV["starts"] - 0.4, -3, -0.4)
ev("trunk-thunk", thunk(R), EV["trunk"] + 0.35, -4, -0.5)
ev("trunk-rattle", G.rattle(0.3, R, 20), EV["trunk"] + 0.6, -12, -0.5)
ev("key-handover", keys_jingle(R, 4, 0.2), EV["back"] + 0.3, -8)
ev("keyring-big", keys_jingle(R, 16, 0.5), EV["valet"], -7, 0.3)
ev("to-fix", G.whoosh(0.8, R, 0.4), EV["fix"] - 0.4, -9, width=True)
for k in range(4): ev(f"string{k}", G.whoosh(0.4, R, 0.2, 900, 3500, tail=0.1), EV["delegated"] - 0.2 + 0.1 * k, -13, -0.6 + 0.4 * k)
ev("slam", slam(R), EV["deny"], -2, 0.2)
for k in range(10): ev(f"alarm{k}", beep(988 if k % 2 else 784, 0.2), EV["deny"] + 0.25 + 0.25 * k, -22, 0.2)
for k in range(8):
    t0 = EV["policy"] + 0.1 + 0.95 * k
    ev(f"gate{k}", beep(1319, 0.09), t0, -18, 0.5); ev(f"gate-arm{k}", click(R, 700, 0.6), t0 + 0.1, -16, 0.5)
ev("verdict-ok", ding(2093, 0.5), 58.25, -12, 0.4); ev("verdict-no", beep(330, 0.25), 59.65, -16, 0.4)
ev("stamp", stamp(R), EV["human"], -3, 0.3); ev("stamp-ding", ding(1760, 0.5), EV["human"] + 0.1, -10, 0.3)
for k in range(18): ev(f"scribble{k}", scribble(R), EV["log"] + k / 6, -16, -0.3)
ev("pullback", G.whoosh(2.4, R, 1.2, 250, 1600, 1.0, 0.8), EV["laptop"] - 1.0, -10, width=True)
ev("to-room", G.whoosh(0.9, R, 0.45), EV["callback"] - 0.45, -10, width=True)
ev("small-key", keys_jingle(R, 2, 0.1), EV["hand"], -8)
ev("card-shimmer", sparkle(R, 8, 1568), EV["card"] + 0.1, -10, width=True)

# beds: hum of the factory, street air, room tick
bed = np.zeros((2, N)); t_all = np.arange(N) / SR
hum = lp(colored(N, R, 1.0), 400) * 0.6 + 0.25 * np.sin(2 * np.pi * 60 * t_all) + 0.12 * np.sin(2 * np.pi * 120 * t_all)
belt = bp(colored(N, R, 0.3), 800, 3000, 1) * (0.5 + 0.5 * (np.sin(2 * np.pi * 2.2 * t_all) > 0.9)) * 0.25
street = G.breeze(DUR, R, 0.8) if hasattr(G, "breeze") else lp(colored(N, R, 1.0), 900)
street = street[:N] if street.ndim == 1 else street[0, :N]
chirps = G.bird_chirps(DUR, R, 0.35); chirps = (chirps if chirps.ndim == 1 else chirps[0])[:N]
tick = np.zeros(N)
for k in range(int(DUR)): G._place_mono(tick, click(R, 3200, 0.35), float(k))
def gate(a, b, fade=0.5):
    g = np.clip((t_all - a) / fade + 0.5, 0, 1) * np.clip((b - t_all) / fade + 0.5, 0, 1)
    return g
fac = sum(gate(a, b) for a, b, p in PLACES if p == "factory"); stg = sum(gate(a, b) for a, b, p in PLACES if p == "street")
rmg = sum(gate(a, b) for a, b, p in PLACES if p == "room")
bed += widen((hum + belt) * fac, R) * 0.6 + widen(street * stg, R) * 0.5 + st(chirps * stg * 0.4) + st(tick * rmg * 0.25)

# ---------------------------------------------------------------- score (112 bpm, C major)
BPM = 112; BEAT = 60 / BPM
mus = np.zeros((2, N))
def note(x, t, g=1.0, p=0.0): place(mus, pan(x, p) if np.asarray(x).ndim == 1 else x, t, g)
MEL_A = [72, 76, 79, 76, 74, 77, 81, 79, 76, 72, 74, 71, 72, None, 67, None]
MEL_B = [79, 77, 76, 74, 72, 74, 76, 79, 81, 79, 77, 76, 74, None, 72, None]
CHORDS = [(48, 52, 55), (53, 57, 60), (55, 59, 62), (48, 52, 55)]
def bar_chord(t): return CHORDS[int(t / (4 * BEAT)) % 4]
def section(t0, t1, kind):
    b = int(np.ceil(t0 / BEAT))
    while b * BEAT < t1:
        t = b * BEAT; ch = bar_chord(t); beat = b % 4
        if kind in ("factory", "street", "fix"):
            note(I.pluck(I.m2f(ch[0] - 12 if beat % 2 == 0 else ch[2] - 12), 0.8, R, 0.6), t, 0.55, -0.2)
            if beat in (1, 3): note(I.brush(0.45, R), t, 0.35, 0.3)
            m = (MEL_A if (b // 16) % 2 == 0 else MEL_B)[b % 16]
            if m and kind != "street": note(I.glock(I.m2f(m), 0.5, R, 1.2), t, 0.32, 0.25)
            if m and kind == "street": note(I.vibes(I.m2f(m - 12), 0.5, R, 1.2), t, 0.35, 0.2)
            if kind == "fix":
                if beat == 0: note(I.brass(I.m2f(ch[0]), BEAT * 1.8, 0.6, R, "tuba"), t, 0.45, -0.1)
                if beat == 0: note(I.pad([I.m2f(x + 12) for x in ch], BEAT * 4, 0.35, R, 0.2, 0.6), t, 0.4)
                note(I.snare(0.35 + 0.2 * (beat == 3), R), t + BEAT / 2, 0.2, 0.2)
        elif kind == "room":
            m = MEL_A[b % 16]
            if m: note(I.musicbox(I.m2f(m + 12), 0.5, R, 1.4), t, 0.35, 0.15)
            if beat == 0: note(I.pad([I.m2f(x) for x in ch], BEAT * 4, 0.3, R, 0.4, 0.8, 800), t, 0.5)
        elif kind == "tension":
            note(I.pluck(I.m2f(46 if beat % 2 else 47), 0.7, R, 0.4), t, 0.5, -0.2)
            if beat == 0: note(I.pad([I.m2f(58), I.m2f(61), I.m2f(65)], BEAT * 4, 0.3, R, 0.3, 0.5, 700), t, 0.4)
        b += 1
section(0, 14.9, "room")
section(15.0, 35.6, "factory")
section(36.0, EV["does"] - 0.1, "tension")
note(I.pad([I.m2f(43), I.m2f(50)], 4.5, 0.25, R, 0.6, 1.5, 500), EV["luckily"] + 0.2, 0.5)  # deadpan: almost nothing
section(EV["street"] + 0.1, EV["fix"] - 0.2, "street")
section(EV["fix"], EV["callback"] - 0.3, "fix")
section(EV["callback"], EV["hand"] - 0.2, "room")
# the resolve: on "Hand out valet keys", ring through the end card
fin = sum(I.pad([I.m2f(x) for x in (48, 55, 64, 72)], 4.3, 0.45, R, 0.15, 2.0, 1200)[:, :ns(4.3)] for _ in range(1))
note(fin, EV["hand"], 0.8); note(I.glock(I.m2f(84), 0.6, R, 2.5), EV["hand"] + 0.5, 0.4); note(I.glock(I.m2f(79), 0.5, R, 2.5), EV["card"] + 0.1, 0.35)
note(I.cymbal(0.3, R, 2.5), EV["card"], 0.15)

# ---------------------------------------------------------------- mix
v, sr = read_wav(os.path.join(HERE, "..", "voice", "voice.wav")); assert sr == SR
voice = np.zeros((2, N)); vv = st(v)[:, :N]; voice[:, :vv.shape[1]] = vv
words = json.load(open(os.path.join(HERE, "..", "voice", "words.json")))["words"]
# speech duck for the music: -4 dB under words (80 ms pre, 450 ms release)
duck = np.zeros(N)
for w in words: duck[max(0, ns(w["start"] - 0.08)):ns(w["end"] + 0.12)] = 1
k = np.exp(-1 / (0.07 * SR)); kr = np.exp(-1 / (0.45 * SR)); env = np.zeros(N); e = 0.0
for i in range(0, N, 64):
    tgt = duck[i]; e = tgt + (e - tgt) * (k if tgt > e else kr) ** 64; env[i:i + 64] = e
duck_g = dbg(-4.0 * env)
Lv = integrated(voice)
room_ir = make_ir(0.9, 3, hf=0.6)
mus = convolve_st(mus, room_ir)[:, :N] * 0.35 + mus
mus *= dbg((Lv - 17.0 + 3.0) - integrated(mus))  # house level voice -17 LU, +3 dB standard
mus *= duck_g
sfx_out = sfx * dbg((Lv - 6.0 - 6.0) - momentary_max(sfx))  # house: loudest SFX moment 6 LU under the voice, -6 dB standard
bed *= dbg((Lv - 26.0) - integrated(bed))
mix = voice + mus + sfx_out + bed
# final: integrated -14 LUFS, true peak under -1 dBTP (whole-mix gain + a soft clip guard), same gain on every stem
g = dbg(-14.0 - integrated(mix)); mix *= g
tp = true_peak(mix)
if tp > -1.0:
    lim = dbg(-1.2); mix = np.tanh(mix / lim) * lim
fades_n = ns(0.6); mix[:, -fades_n:] *= np.linspace(1, 0, fades_n)
os.makedirs(os.path.join(HERE, "stems"), exist_ok=True)
for name, x in (("voice", voice * g), ("music", mus * g), ("sfx", sfx_out * g), ("beds", bed * g)): write_wav(os.path.join(HERE, "stems", f"{name}.wav"), x)
write_wav(os.path.join(HERE, "mix.wav"), mix)
with open(os.path.join(HERE, "cues.md"), "w") as f:
    f.write(f"# Sound cues\n\nLength {DUR:.3f} s ({N} samples @ {SR}). Integrated {integrated(mix):.1f} LUFS, true peak {true_peak(mix):.1f} dBTP.\n\n")
    f.write("| t (s) | event | gain dB |\n|---|---|---|\n")
    for t0, n, gd in sorted(events): f.write(f"| {t0:.2f} | {n} | {gd:+.0f} |\n")
print(f"mix {DUR:.3f}s  I={integrated(mix):.1f} LUFS  TP={true_peak(mix):.1f} dBTP  voice={integrated(voice*g):.1f}  music={integrated(mus*g):.1f}  sfx={integrated(sfx_out*g):.1f}")
