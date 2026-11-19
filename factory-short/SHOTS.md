# Shot plan (draft) and production prep

Style: cartoon-3d-short (bean-head 2D character cards in a painted 3D world, ink outlines, lens blur, gliding
cameras). No captions or on-screen text; every idea has to read from the picture alone. Timings get locked to
`words.json` once the voice exists.

## Cast (new cards in toon.ts / cast.ts)
- **The Deputy** (1970s compiler): bean head, sheriff star badge, huge ring of keys on the belt.
- **The User**: 70s plaid shirt, hands over a paper slip.
- **Agents**: bean-head workers in coloured overalls, one colour per agent so no vendor logos are needed. One is the
  CI bot, with a golden key on a neck chain.
- **The Developer**: hoodie, at the end of the line with a big green button.
- **The Guard**: Permit's Akita Inu mascot ("stands guard") in a booth. New quadruped card; the hardest new
  character, so a fallback is a guard with an Akita on a cap patch.
- **The Valet**: red vest, tiny key.

## Worlds (new build.ts layout)
- **A. 1977 machine room** (golden light): tape cabinets, a gold-painted billing filing cabinet, a slot desk.
- **B. The factory floor** (day light): sky-lit sawtooth roof, conveyor belt of parcel-shaped PRs, stations for
  ticket, tests, review, merge. Replaces the town and river; Kenney models are mostly not needed.
- **C. Valet stand**: a kerb, one cartoon car with a trunk that bounces shut.

## Shots
| # | Beat | Picture | Camera / effect |
|---|------|---------|-----------------|
| 1 | Hook | The Deputy feeds paper into the gold cabinet; the drawers spit shredded paper | CU push-in, flip kick on "wiped out" |
| 2 | Setting | The User hands a slip; the Deputy picks a key from the ring; the User's own pockets are empty | MS, DOF on faces |
| 3 | "nearly true" | Deputy shrugs, star badge flips round, then a white flash | Flash after the hook block |
| 4 | Factory | Wide glide down the factory line; agents at stations, parcels moving, Developer slaps the green button | Aerial glide, sharp |
| 5 | Same keys | Each agent pulls an identical copy of the Developer's keychain from a pocket | Quick lateral glide past 3 agents |
| 6 | CI bot | Golden key on a chain, glints (HDR bloom) | Insert CU |
| 7 | Reading | Paper tickets float in on the belt; agents read them | MS, DOF |
| 8 | Snap | A purple-tinted ticket; the agent reads it, opens a window, posts a fat envelope to a waiting pigeon | Hard cut, kick on "does" |
| 9 | Deadpan | The agent beams and holds up a perfect ID badge / the badge, the open window behind | Static-creep CU, then same frame |
| 10 | Valet key | Valet starts the car with a tiny key; the trunk refuses and bounces shut | Golden or day, side MS |
| 11 | Fix | Each agent's badge hangs on a string back to the Developer; agents walk through the Akita's booth; a red light on the paste-site window | Glide along the line |
| 12 | Human checkpoint | Parcel stops at a turnstile at the merge station; the Developer stamps it | MS |
| 13 | One log | A giant ledger writes itself line by line behind the line | Pull-back reveal |
| 14 | Callback | Back in 1977: the Deputy now holds a single tiny key; the gold cabinet stays shut; he looks at it, satisfied | Golden, slow push-in, end |

## Sound
- Score: light and mechanical (typewriter and conveyor clacks in the rhythm) instead of the bridge's march.
- SFX: shredder, key jingle, conveyor hum, paper flutter, envelope thunk, car start, trunk bounce, stamp, dog woof
  at the booth (one only).
- Standard mix: music +3 dB, SFX -6 dB, voice unchanged.

## Prep done
- `~/remotion-shorts/src/videos/factory/` (renders land in `factory-short/out/`): copy of the bridge source, registered as composition `FactoryShort`
  (1080x1920, 30 fps). Still renders the bridge until the story, world and cast are rewritten.

## Decisions
1. **Script:** awaiting approval (SCRIPT.md). After that the skill runs end to end.
2. **Voice:** OpenAI TTS (`gpt-4o-mini-tts`) via `voice/make_voice.py`, words.json from `whisper-1`. Samples in
   `voice/samples/`. Pick A (onyx) or B (ash).
3. **End card:** yes. A ~2 s Permit logo + agent.security card after the last line, the one exception to the
   no-text rule. Logo file needed (SVG or PNG).
