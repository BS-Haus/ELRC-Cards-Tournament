# Cards · East London Roundnet

Weekend **cards** tournaments for the Victoria Park group. Post a session, share the link in
WhatsApp, people add themselves. On the day everyone plays in small groups with a new partner
every game, regroups by level, and finishes in Gold / Silver / Bronze finals.

Built on the same stack and look as the club's ladder app ([spike-east](https://github.com/ttavni/spike-east)):
Next.js on Vercel, Postgres (Neon), dark theme with the lime accent.

## How a weekend runs
1. **Organiser posts an event** (Events → + New event) and shares the link in WhatsApp.
2. **Players tap the link → Join** (name + a 4-digit code, no email) → **I'm in**.
3. **On the day:** people tap **I'm here**, or the organiser checks them in. Walk-ins can be added
   by name and claim the profile later by joining with the same name.
4. **Draw random groups.** Groups of 4 (3 games) or 5 (5 games, one sits out each game). Each
   group keeps its own net. Everyone partners everyone in their group once. 1 point per win.
5. **Enter scores** from any phone, in any order: tap the winners, tap the losers' score.
6. **Next stage: regroup by level.** Best players together, then the next group, and so on.
7. **Finals:** Gold, Silver (and Bronze with 12+). Best record in Gold is champion.

### Changes on the day never break the draw
- A game, once drawn, keeps its players. Nothing gets redrawn under you.
- **Late arrivals** check in and join the next stage. Meanwhile they can sub in.
- **Someone leaves:** they (or the organiser) mark them out. Their games show "Needs a sub":
  pick a sub, or skip the game. A sub's game counts for the other three, not for the sub.
- **Undo last draw** works as long as nothing in that stage has a score.

## Accounts
- Anyone can view everything without signing in.
- Signed-in players (name + 4-digit code) can add themselves, check in, enter scores and subs.
- **Organiser tools** (post events, check people in, draw stages, finish) unlock for 12 hours with
  the organiser code (`ORGANISER_CODE`) on the Me tab.
- Code guesses are rate-limited per device and per name.

## Set up on Vercel (once)
1. **Database:** in the Vercel project → **Storage** → **Create Database** → **Neon** (free) →
   connect it to this project. That sets `DATABASE_URL` for you.
2. **Settings → Environment Variables**, add:
   - `AUTH_SECRET`: a long random string (`openssl rand -base64 32`, or any 40+ random characters)
   - `ORGANISER_CODE`: the organisers' code, 8+ characters
3. **Settings → Build and Deployment → Framework Preset: Next.js** (the old version was a plain page).
4. Redeploy. Each build applies any new database migrations itself (`scripts/migrate.mjs`).

The previous single-page version is still at `/classic.html`.

## Local development
Needs Node 22 and a Postgres 16.
```bash
npm ci
cp .env.example .env.local     # points at postgres://cards:cards@localhost:5432/cards
npm run db:migrate
npm run dev                    # http://localhost:3000, organiser code: dev-organiser
```
| command | what |
|---|---|
| `npm test` | engine tests (groups, schedules, standings, subs) |
| `npm run typecheck` | TypeScript |
| `npm run build` | migrate (if `DATABASE_URL` is set) + production build |
| `npm run db:generate` | new migration from `src/db/schema.ts` |

## Where things live
- `src/lib/cards.ts`: the format as pure functions (group sizes, schedules, tables, subs). Tested in `cards.test.ts`.
- `src/lib/views.ts`, `src/lib/data.ts`: what each page shows, from the database.
- `src/app/actions.ts`: every change anyone can make, with its permission check.
- `src/components/EventScreen.tsx`: the event page (sign-up, live nets, groups, finals, organiser panel).
