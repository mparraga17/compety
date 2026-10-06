<div align="center">

# Compety

**Points for effort, not kilometers.**

An iOS app that scores every workout from your heart rate, so a padel match, a gym session or a barre class count as much as a run. Then you compete with your friends in private weekly leagues.

[**Download on the App Store**](https://apps.apple.com/app/compety/id6810288777) · [Website](https://mparraga17.github.io/compety/) · [Privacy](https://mparraga17.github.io/compety/privacy-en.html)

</div>

---

## Why it exists

Most fitness apps rank what is easy to count from the outside: steps, kilometers, percentage of a goal. That leaves padel, gym, barre or spinning worth almost nothing, even when they are the hardest session of your week.

Compety scores what your heart actually did. Time in each heart-rate zone, measured against **your own** maximum, so a beginner working hard scores like a veteran working hard. Any band or watch that writes to Apple Health works: Fitbit, Garmin and Apple Watch users compete in the same league.

This repository shows **how the app is built**, so other people can learn from it. It was built in about a month, entirely on Windows, without a Mac.

> **The scoring engine is private.** The real formula, its calibration and the merging of duplicate sources are not here. [`src/engine`](src/engine) contains a simple textbook engine instead, so the code compiles, the tests run and you can see where an engine plugs in.

## The science behind it

The score is built on published, peer-reviewed research, not on guesses:

- **Edwards TRIMP**: training load from minutes spent in each heart-rate zone. Simple, published, and computable from the samples HealthKit exposes.
- **2024 Compendium of Physical Activities**: the university-led reference that measures the real energy cost of more than 1,000 activities.
- **Racket sports and longevity**: in a study of 80,306 adults, racket sports were linked to 47% lower all-cause mortality (BJSM, 2017). One more reason padel deserves a score.
- **Why competition**: in the STEP UP randomised trial (JAMA, 602 adults), competition was the only gamification format whose effect lasted after it was switched off.

And what it deliberately does **not** do:

- It does not predict injuries. The popular ACWR metric is discredited; one paper is literally titled *Time to Dismiss ACWR*.
- It does not diagnose. It describes and compares, nothing more.
- HRV and sleep stages do not score. Not every brand provides them, and scoring them would reward owning a specific device.

## Privacy by design

```
iPhone                                         Server
├─ HealthKit (band, watch, sports apps)        ├─ accounts
├─ reads heart rate for each session           ├─ leagues
├─ engine computes the effort score            └─ scores
└─ produces the points  ────── uploads only this ──┘
```

**All the math runs on the phone.** The server receives the sport, the time of day, a duration band and the points. No heart rate, no sleep, no routes. A leak would expose positions in a ranking, not medical records.

## Lessons that cost a bug each

1. **The `{ workout }` filter returns nothing for most bands.** HealthKit only links heart-rate samples to a workout if the writing app created that link. The Google Health bridge (Fitbit) does not. Heart rate is read by time range instead. → [`src/health/reading.ts`](src/health/reading.ts)
2. **You cannot know whether read access was denied.** iOS returns an empty result either way. The app says "no data is arriving", never "you have no data". → [`src/health/status.ts`](src/health/status.ts)
3. **Querying a type you did not authorise crashes the app.** One `as const` list drives both the permission request and the TypeScript type, so the mistake does not compile. → [`src/health/types.ts`](src/health/types.ts)
4. **Is the heart-rate data even good enough?** Before building the product, the app measured the gap between samples on real devices. Under 5 minutes is viable; over 15 means rethinking everything. → [`src/health/diagnosis.ts`](src/health/diagnosis.ts)
5. **A silent `return` hid failed uploads.** With an expired session, uploads "finished fine" without uploading anything. Writes now throw. → [`src/data/supabase.ts`](src/data/supabase.ts)
6. **Notifications must not leak health data.** Apple forbids disclosing HealthKit information to third parties. "Marta scored 88 points" is fine; anything with heart rate is not. → [`src/notifications/push.ts`](src/notifications/push.ts)

## Shipped with Expo, from Windows

Compety went from first commit to the App Store in about a month, built by one person on a Windows laptop, with no Mac at any point. [Expo](https://expo.dev) is what made that possible:

| Step | How |
|---|---|
| Native modules | **Development build** with `expo-dev-client`. HealthKit is native, so Expo Go was never an option |
| iOS builds | **EAS Build** compiles the iPhone binary in the cloud and signs it, no Xcode on the developer's machine |
| TestFlight and App Store | **EAS Submit** uploads every build straight to App Store Connect |
| Fixes without a new build | **EAS Update**: over-the-air updates to the JavaScript. More than ten during the beta, each one live on testers' phones within minutes |
| Safe updates | Each update targets a runtime fingerprint, so a JavaScript update never lands on a binary with different native code |
| Crash reports | Sentry's Expo plugin uploads source maps with every build and update, so stack traces stay readable |

The rule that came out of it: a change that only touches JavaScript ships over the air the same night; a change to native code waits for a new build.

## What is in this repo

| Folder | What it shows |
|---|---|
| [`src/health`](src/health) | Reading HealthKit safely: one list of types, one permission gate, a permission probe, a data-quality diagnosis |
| [`src/notifications`](src/notifications) | Expo push notifications, routing a tap to the right screen, tested as pure JS |
| [`src/data`](src/data) | Supabase client and making failed writes visible |
| [`src/engine`](src/engine) | Example engine: Edwards heart-rate zones and TRIMP, with tests |

More of the app (sync, social feed, leagues, screens, components) will be added here over time.

## Stack

| | |
|---|---|
| App | Expo SDK 57 · React Native 0.86 · strict TypeScript |
| Health data | Apple HealthKit via [`@kingstinct/react-native-healthkit`](https://github.com/kingstinct/react-native-healthkit) |
| Backend | Supabase (EU region): auth with Sign in with Apple, Postgres with row level security, Edge Functions |
| Notifications | Expo push, sent from a Supabase Edge Function |
| Crash reports | Sentry (EU region), errors only, no personal data |
| Builds and updates | EAS Build, EAS Submit and EAS Update, all driven from a Windows machine |

HealthKit is a native module, so the app runs as a development build from day one. Expo Go never works.

## Run it

```bash
npm install
npm test              # pure JS tests, no iPhone needed
npm run typecheck
npm run check:leaks   # guard: fails if private engine code ever lands here
```

The HealthKit and notification code needs a development build on a real iPhone.

## License

All rights reserved. The code is published so anyone can read it and learn from how it works. No licence is granted to use, copy, modify or redistribute it.

---

<div align="center">

Made by Pizco Deploy · [pizcodeploy@gmail.com](mailto:pizcodeploy@gmail.com)

</div>
