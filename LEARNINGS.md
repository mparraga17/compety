# Learnings: building Compety

What it took to go from an idea to an iOS app on the App Store in about six weeks: the milestones, the product decisions and the lessons, grouped by area. No day by day log. Each lesson is written as what happened, then the rule that came out of it.

The app was built by a product manager working with an AI coding agent: the PM decided and reviewed, the agent wrote the code. Many lessons are about that way of working too.

The scoring engine is private, so the scoring lessons here explain the reasoning, never the formula or its numbers.

## Milestones

**Validating the idea (late August 2026)**
- Turned a personal health dashboard into a product idea: a social competition app on top of wearable data.
- Market study, a feasibility check for shipping iOS from Windows, and a library of about 60 papers on effort measurement.
- First test on a real iPhone: the band writes heart rate to Apple Health about once a minute, enough to measure effort. Building made sense from there.

**Scoring engine (late August to September)**
- Training load from heart-rate zones (Edwards TRIMP), with sport weights from the 2024 Compendium of Physical Activities.
- Calibrated against dozens of real sessions, with tests for every rule.
- Second version: the score for a period is the sum of the effort of every session.
- Workouts logged after the fact score from heart rate when the band covered the session.

**App and backend up to the beta (end of August to mid September)**
- Expo development build, HealthKit behind a single permission gate.
- Supabase with row level security, leagues joined by invite code, push notifications, background sync.
- Sign in with Apple, friends, five tabs, city and district leagues with promotion and relegation.
- TestFlight beta with friends, then a social feed with reactions and comments.

**Hardening the beta (mid to late September)**
- Background sync actually wired up, a full security review, CI with typecheck and tests.
- Frontend redesign from an approved HTML mockup, and the first over-the-air update.
- Account deletion that also revokes Sign in with Apple, a season medal table, Sentry for crashes.
- Feed duplicates removed for good by reconciliation.

**Launch (late September to early October)**
- App Privacy, the listing and the review notes, submitted on 25 September.
- Approved first time and live on 6 October, free, in 175 countries.

**After launch (October)**
- A design review against Apple's guidelines: grid cards for health metrics, a night detail in Sleep, a podium in leagues, more colour on Today.
- Light mode with its own palette and measured contrast, plus Automatic to follow the iPhone.
- This repository, the interactive map and the launch videos.

## Product decisions and why

**Data and platform**
- **Apple Health, not brand APIs.** Fitbit, Garmin, WHOOP, Oura and Apple Watch all write to it, it is free and nobody can close it.
- **No Google Health API.** Its restricted scopes cap an app at 100 users and require a paid yearly audit.
- **No Strava API.** Its terms forbid virtual competitions and showing one user's data to another.
- **Privacy by design.** All the math runs on the phone. The server gets the sport, the hour, a duration band, the points and where the score came from. No heart rate, sleep or routes.
- **HRV, calories and sleep stages do not score.** Not every brand writes HRV, calories depend on body weight, and there is no scientific consensus on sleep stages.

**Scoring**
- **No sport is the main one.** Barre, strength, golf and walking compete in the same table. That is the whole point.
- **Effort from heart rate, against your own maximum.** A generic `220 - age` is biased, so each person's maximum comes from their own data.
- **Weights from a published table,** not set by eye.
- **Diminishing returns on duration.** The dose response of exercise is not linear, so four easy hours cannot beat ninety hard minutes.
- **A period is the sum of its sessions.** An earlier version scored each session against your own average. Moving more could lower your total, which is the wrong incentive. The personal baseline now only describes a session.
- **Sessions without heart rate still score,** with a small discount and a label saying where the score came from. A big discount would punish everyone to correct a few.
- **Closed weeks are frozen.** Taking away a win someone already celebrated predicts they quit.
- **Three periods: week, month, year.** Five options were too many, and "this week" next to "last 7 days" confused people.

**Social**
- **Private leagues with friends, no global ranking.** Competing with people you know is what keeps people going.
- **Join by invite code,** shared over WhatsApp. No contacts access and no phone numbers.
- **Findable is not visible.** Search shows a name and a photo; points only show inside a shared league.
- **Exact username search,** so nobody can list who uses the app.
- **Your position leads, not your points.** "2nd of 7" needs no explanation.

**Account and legal**
- **Sign in with Apple only,** for now.
- **Account deletion inside the app,** revoking the Apple token. If revoking fails, nothing is deleted silently.
- **No ads.** Apple forbids advertising with HealthKit data.
- **It describes, it never diagnoses.** No injury predictions, no medical language.

## Lessons by area

### HealthKit and data
- HealthKit only links heart rate to a workout when the writing app creates the link, and Fitbit does not. Rule: read heart rate by time range.
- Fitbit writes a gym session as "other". Rule: no mapping fixes it, so the user can correct the sport.
- Six activity codes in the mapping table were wrong, and golf scored as cycling. Rule: test the table against the full official enum.
- A code comment said "verified", so nobody checked the table again. Rule: always say what something was verified against.
- iOS never tells an app that read access was denied. Rule: an empty result is not a zero, and the app offers to check permissions.
- Querying a type you did not request crashes the app. Rule: one typed list drives both the request and every query.
- Background delivery only gets the entitlement from the config plugin. Rule: it also has to be set up from JavaScript, once.
- Observing heart rate would wake the app dozens of times an hour. Rule: observe workouts only.
- A band, a watch and a GPS app record the same run. Rule: merge N to 1 in clusters, field by field, taking the longest distance.
- Some apps rewrite their workouts with new identifiers on every sync, leaving ghost rows in the feed. Rule: reconciliation, where the phone sends a complete snapshot of a time window and the server deletes what is missing.
- Workouts logged by hand were treated like recorded ones, then all of them lost their heart rate. Rule: read the "user entered" flag and decide by heart-rate coverage.
- Documentation contradicted itself about what a brand writes to Health. Rule: measure on a real device.

### Scoring
- Every ranking designed without real sessions turned out wrong. Rule: run each version against real data before accepting it.
- A result that came out perfect (0% error) was an artefact. Rule: treat a too-clean result as an alarm.
- A minimum-intensity filter removed all strength training. Rule: do not punish what the research does not punish.
- Weeks iterated in milliseconds broke on the daylight saving change. Rule: calendar arithmetic, and the test suite pins a time zone.
- A missing value typed by a user produced NaN points. Rule: check every user input with `Number.isFinite`.
- Choosing between options without reading the literature was a mistake. Rule: every scoring decision traces back to a paper.

### Backend (Supabase and Postgres)
- Postgres does not warn about ambiguous names when a function returns a column with the same name as a table column. Rule: distinct output names, and test by running the function.
- Revoking a permission from the app roles did nothing, because they inherit it from `PUBLIC`. Rule: revoke from `public`, then grant explicitly.
- An update policy that did not restrict columns let a row change more than intended. Rule: grant update on specific columns only.
- A recursive membership policy fails with error 42P17. Rule: a `security definer` helper, and joining through a function.
- Changing the points scale broke a check constraint in production. Rule: search the migrations for constraints before changing a range.
- Recreating a function from an old migration file dropped later changes. Rule: start from the definition deployed in production.
- `getSession()` can return null with a retryable error while a valid session is still stored. Rule: look at the error before deciding the user is signed out.
- Edge Functions run in any region by default. Rule: pin the region in the webhook URL to keep data in the EU.
- Test changes inside a transaction that ends in `rollback`, simulating the user's session. Test what already existed too, not only the new code.

### Builds, EAS and over-the-air updates
- Three builds of a 15-per-month free plan went in one morning on JavaScript-only changes. Rule: before a build, check whether anything native changed at all.
- With `expo-updates`, every JavaScript change ships over the air the same night. Rule: compare the production environment variables with the local ones before publishing.
- A runtime version tied to the app version would send updates to binaries with different native code. Rule: the `fingerprint` runtime policy.
- An update applies on the second cold start. Rule: tell testers to close and open the app twice.
- An update with a layout change broke one tab for everyone, and an update cannot roll back a single screen. Rule: check on a device before publishing, and keep the previous update ready to republish.
- A static import of a missing native module crashes the whole app, and `try/catch` does not help. Rule: optional native modules are required lazily.
- `expo prebuild` does not work on Windows. Rule: inspect the native config with `expo config --type introspect`.
- A build command can drop in the terminal and still create the build. Rule: list the builds before launching another.
- Secrets typed on the command line get echoed by the shell. Rule: pass them in files or through standard input.

### App Store Connect
- The price lives in a different section from the version page, and it was nearly missed. Rule: one checklist covering the version, App Information, App Privacy and Pricing, verified after a reload.
- Subtitle and category were empty. Rule: review App Information in full.
- Screenshots uploaded together arrive in random order. Rule: reorder them before submitting.
- The required screenshot size inherits from the 6.5" set. Rule: replacing that set is enough.
- Screenshots of a published version are locked. Rule: new screenshots ship with the next version.
- App Privacy has to say exactly what the privacy policy says.
- Review notes should explain the login, provide a demo league and explain the user content (friends and private leagues only).

### Design and frontend
- The first version looked generated: saturated borders, a grid of KPIs. Rule: one number leads, colour only when it means something.
- Copying another brand's signature ring did not fit and measured nothing. Rule: do not imitate, show something that informs.
- Mockup transparencies were unreadable on the phone. Rule: compute contrast (at least 4.5:1) and check on the device.
- A double tap was needed to send a comment. Rule: `keyboardShouldPersistTaps="handled"` on every scroll view above a text input, even across a modal.
- `Intl.PluralRules` does not exist in the Hermes engine, and neither TypeScript nor Node catches it. Rule: no `Intl` on the phone.
- Data objects carried translated text and broke the language switch. Rule: data carries flags, the UI translates.
- The theme could not change while the app runs. Rule: read the appearance before creating styles, and reload on change.
- Structure before pixels. A detailed visual audit missed that the tab bar was gone.
- HTML mockup first, with variants, approved before any React Native. Deliver mockups pre-rendered, because some viewers do not run JavaScript.
- Do not animate what people see many times a day.

### Working with an AI agent
- The worst bugs were caught by looking at the app, not by tests. Rule: try it on the iPhone with your own data.
- A new test file outside the test runner's match pattern passes because it never runs. Rule: check the suite count includes it.
- Running the test suite next to the bundler ran out of memory. Rule: limit test workers.
- A delegated task that ran out of turns left code that did not compile. Rule: typecheck and test after every handoff.
- Reading real code on GitHub beat reading documentation, and the best finds were in repositories with almost no stars.
- Diagnose with production data before changing code, and reproduce every bug with a failing test first.
- The private engine once ended up in a public repository. Rule: an automatic leak check runs before every push here.
- Never paste secrets in the chat; pass file paths instead.

### Videos
- The phone screens in the videos are copied from the app's real code. Invented states would be noticed by anyone who downloads the app.
- The renderer does not blur text, so anything private is drawn as bars without text.
- Only the app's palette. An accent red looked foreign in an app with almost no red.
- Review single frames before rendering the full video.

More detail on the videos is in [`resources/videos.md`](resources/videos.md). The six lessons with code are in the [README](README.md#lessons-that-cost-a-bug-each).
