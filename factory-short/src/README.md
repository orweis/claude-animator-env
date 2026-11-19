# FactoryShort source

Copy of `~/remotion-shorts/src/videos/factory/` (the Remotion composition `FactoryShort`, 1080x1920 @ 30 fps, 2300 frames).
Built on the cartoon-3d-short skill's bridge template: `ink.ts`, `lensblur.ts`, `grade.ts`, `lights.ts`, `shade.ts`,
`cardshade.ts`, `paint.ts` and `build.ts` are the template's; `story.ts`, `world.ts` and `cast.ts` are new for this short;
`toon.ts` adds the stetson, star badge, keyrings, held props, the Akita guard and the factory effects; `Bridge.tsx` adds the end card.
`Root.tsx.txt` is the project's root that registers it. Restore with:

```bash
cp factory-short/src/*.ts factory-short/src/*.tsx ~/remotion-shorts/src/videos/factory/
```

Voice: `voice/voice.flac` is the locked take (convert back with `ffmpeg -i voice.flac voice.wav`); `voice/words.json` holds its word timings.
Sound: `audio/make_sound.py` rebuilds `audio/mix.wav` and stems. Final render: `scripts/render_chunk.sh 0..4`.
