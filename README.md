# Compety: how it is built

[Compety on the App Store](https://apps.apple.com/app/compety/id6810288777) · [Website](https://mparraga17.github.io/compety/)

Compety is an iOS app that scores the effort of every workout from heart rate, so padel, gym or barre count as much as a run, and lets you compete in private leagues with people you know.

This repository shows how the app is built, so others can learn from it. It is a curated part of the real code base, translated to English and published a piece at a time.

**The scoring engine is not here.** The real formula, its calibration and the merging of duplicate sources are private. `src/engine` contains a simple textbook engine instead, so the rest compiles and the tests run.

## What you can learn here

| Folder | What it shows |
|---|---|
| [`src/health`](src/health) | Reading HealthKit safely: one list of types, one permission gate, and why an empty result never means "no data" |
| [`src/notifications`](src/notifications) | Push notifications with Expo, routing a tap to the right screen, and Apple's HealthKit disclosure rule |
| [`src/data`](src/data) | Supabase client setup and a pattern that makes failed writes visible |
| [`src/engine`](src/engine) | Example engine: Edwards heart-rate zones and TRIMP, the published starting point |

More folders (sync, feed, screens, components) will be added over time.

## Architecture in one picture

```
iPhone                                    Server
├─ HealthKit                              ├─ accounts
│  (band, watch, sports apps)             ├─ leagues
├─ reads heart rate for each session      └─ scores
├─ engine computes the effort score
└─ produces the points  ────── uploads only this ──┘
```

Health data never leaves the phone. The server gets the sport, the time, a duration band and the points. No heart rate, no sleep, no routes.

## Lessons that cost a bug each

- **The `{ workout }` filter returns nothing for most bands.** HealthKit only links heart-rate samples to a workout if the writing app created the link. The Google Health bridge (Fitbit) does not, so heart rate is read by time range. See `src/health/reading.ts`.
- **You cannot know if read access was denied.** iOS returns empty either way. The app says "no data is arriving", never "you have no data". See `src/health/status.ts`.
- **Querying a type you did not authorise crashes the app.** A single `as const` list of types drives both the permission request and the TypeScript type, so the mistake does not compile. See `src/health/types.ts`.
- **A silent `return` hid failed uploads.** Writes now throw when there is no session. See `src/data/supabase.ts`.

## Run it

```bash
npm install
npm test              # pure JS tests, no iPhone needed
npm run typecheck
npm run check:leaks   # guard against private engine code
```

The HealthKit and notification code needs a development build on a real iPhone (HealthKit is a native module, Expo Go does not work).

## License

All rights reserved. The code is published so anyone can read and learn from how it works. No licence is granted to use, copy, modify or redistribute it.

---

Pizco Deploy · [pizcodeploy@gmail.com](mailto:pizcodeploy@gmail.com)
