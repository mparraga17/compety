# Architecture

How Compety is put together, at the level you need to build something similar. The SQL, the function bodies and the scoring formula stay private.

## The big picture

```
iPhone                              Supabase (Postgres, EU region)
+------------------------+          +-----------------------------------------+
| Apple Health           |          | 1. People       users, profiles,        |
|   |                    |          |                 friendships             |
|   v                    |  results | 2. Competition  leagues, members,       |
| Scoring engine         | -------> |                 scores, zones           |
| (heart rate, minutes   |   only   | 3. Social       workouts, reactions,    |
|  and formula stay here)|          |                 comments                |
+------------------------+          | 4. Alerts       alerts table            |
                                    |                   | webhook             |
                                    |                   v                     |
                                    |                 Edge Function -> push   |
                                    +-----------------------------------------+
```

The phone does the maths. The server only stores results and decides who can see them.

## What travels to the server

Per workout: sport, points, a tone (easy, normal or hard, compared with your own baseline), the time it ended, a duration band (short, medium or long, never exact minutes) and its origin (measured, declared or estimated). No heart rate, no zones, no raw HealthKit data. Apple does not allow health data to reach a third party without explicit consent, and the leaderboard does not need it.

## The four blocks

It is a relational database: Postgres, managed by Supabase.

| Block | Tables | What it holds |
|---|---|---|
| People | `auth.users`, profiles, friendships | The account (Sign in with Apple), the display name and push token, and friend requests |
| Competition | leagues, members, scores, zones and weekly movements | Private leagues joined by a 6-character code, and city leagues with divisions, promotion and relegation |
| Social | workouts, reactions, comments | The feed: each published workout, one emoji reaction per person, short comments |
| Alerts | alerts | Every notification is written down first, then sent |

Everything hangs off the user account with cascading deletes, so deleting an account removes all of it in one step.

## Patterns worth copying

- **The database decides who sees what.** Every table has row level security. You see a league only if you are in it, and a workout only if it is yours, a friend's or a league mate's. The app is not trusted to filter.
- **Sensitive writes go through functions, not tables.** There is no insert policy on members, so the only way into a league is a function that checks the code. The same goes for comments, reactions, publishing workouts and closing a week. A plain update policy would let anyone rewrite their own points.
- **Idempotent by key.** A score is one row per person, league and period, so background sync can run ten times and the leaderboard still counts once. Workouts carry a fingerprint for the same reason.
- **Reconciliation instead of dedup heuristics.** The phone sends the complete list for its time window and the server removes anything in that window that is not on it. The phone is the single source of truth.
- **Write the alert, then send it.** An alert row is inserted, a database webhook calls an Edge Function, and the function sends the Expo push. A failed push still leaves a record you can debug.
- **Migrations, numbered.** One base schema plus numbered migrations, each backed up before it is applied. When a later migration changes a function, start from the deployed version, not the old file.

## Languages

| Part | Language |
|---|---|
| Tables, access rules, database functions | SQL and PL/pgSQL |
| Edge Functions (send notification, delete account) | TypeScript on Deno |
| App and scoring engine | TypeScript, React Native with Expo |
