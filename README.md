# Cards · East London Roundnet

Weekend **cards** tournaments for the Victoria Park group. Post a session, share the link in
WhatsApp, people add themselves. On the day everyone plays in small groups with a new partner
every game, regroups by level, and finishes in Gold / Silver / Bronze finals.

Built on the same stack and look as the club's ladder app ([spike-east](https://github.com/ttavni/spike-east)):
Next.js on Vercel, Postgres (Neon), dark theme with the lime accent.

## Two formats
- **Ladder** (parked for now: the new-event form only offers Cards; flip `LADDER_ON` in
  `src/components/HomeBits.tsx` to bring the choice back): nets ranked top to bottom. Everyone's seeded onto a net by rating;
  each round is one game per net. Win and you go up a net, lose and you go down (the top net's
  winners stay, as do the bottom net's losers). The four on each net are split into teams that
  don't repeat a partnership from earlier in the day, picked at random among the splits close to
  even (within `CLOSE_ENOUGH`, about 55/45), so it's a new partner every game and never stale.
  With extra people it's king of the court: the pair who lose on the bottom net sit out, and
  whoever sat out comes back on the bottom net. The next round draws itself the
  moment the last net's score goes in. Games to 11, 15, 17 or 21. The **Tournament** tab is just
  the nets: four faces each, ↑/↓ once a net's scored, everyone sliding to their new net when the
  round turns. Tap a net to score it in a sheet, and the result (who goes up, who goes down, each
  player's ±) shows in that sheet. The organiser can swap someone out of an unscored game there.
  Check-in and "I have to leave" live on Me. The day ends with one story. Engine:
  `src/lib/netLadder.ts`, screen: `src/components/LadderScreen.tsx`.
- **Cards** (what new events use): groups, then finals, as below. Groups are mixed by rating
  (`mixedOrder`), and the organiser can add another round, mixed or by level, before the finals.
  Scoring: tap a net, score it in the sheet, and the result (each player's rating change) shows
  in a small sheet. The draw stories and the finals banners stay; nothing else pops up mid-day.
  The **Tournament** tab goes net by net, a carousel with the next net peeking in and dots underneath
  (swipe, or tap a net in the switch that sticks to the top; it opens on your net): the game on the net now (tap to score it), then the
  table and fixtures of the group playing there. Live nets have a slow green light
  circling their edge. The page has no tabs of its own: your day is on Me while a tournament is
  on, right under your rating (`src/components/MyDay.tsx`): a small Today card (won–lost, points,
  rating today, with your check-in folded underneath), then your results.
  Style: lime means live or act now (primary buttons, live dots, the glow on live nets); the selected net is a thin lime
  outline, other selected states white, gains green, losses red, titles gold; small labels all use `.spk-label`.

Both feed the same ratings (`src/lib/standings.ts`).

## How a cards weekend runs
1. **Organiser posts an event** (Organise → + New event) and shares the link in WhatsApp.
2. **Players tap the link → Join** (name + a 4-digit code, no email) → **I'm in**.
3. **On the day:** people tap **I'm here**, or the organiser checks them in. Walk-ins can be added
   by name and claim the profile later by joining with the same name.
4. **Draw random groups.** Groups of 4 (3 games) or 5 (5 games, one sits out each game). Each
   group keeps its own net. Everyone partners everyone in their group once. 1 point per win.
5. **Enter scores** from any phone, in any order: tap the winners, tap the losers' score.
6. **Finals:** Gold, Silver (and Bronze with 12+), seeded from the group stage. Most wins in
   Gold is champion, second is runner-up; level on wins goes to points difference, then a decider: the organiser taps
   **Play decider** and the tied pair play two games to 11 on opposite sides, swapping partners;
   most points across both wins. Deciders count for nothing else.
   Late arrivals who haven't played start in the bottom final.
7. **Another round before the finals** (mixed, or by level): a by-level round regroups on the
   results so far and keeps earlier group-mates apart where it can (`spreadRepeats`), so partners
   stay fresh. With two or more rounds played, **they all count together** for the finals: seeded on
   the whole day's record (win %, then points difference per game), and a final never replays a
   group exactly. The event page shows a "Standings · both rounds" table with where each final starts.
   Finals are stored as A–D and shown as Gold, Silver, Bronze, Copper (`finalLabel`).
8. **Nobody re-checks in between stages.** Everyone who played stays in unless marked Out.

### Changes on the day never break the draw
- A game, once drawn, keeps its players. Nothing gets redrawn under you.
- **Late arrivals** check in and join the next stage. Meanwhile they can sub in.
- **Someone leaves:** they (or the organiser) mark them out. Their games show "Needs a sub":
  pick a sub, or skip the game. A sub's game counts for the other three, not for the sub.
- **Undo last draw** works as long as nothing in that stage has a score.

## Points, levels and recaps
- **Profile photos:** add one on the Me tab. The phone crops and shrinks it before upload.
- **Points:** every weekend earns points for turning up (10), each game (1), each win (3), and
  your finish (Gold champion 30, runner-up 15, finalist 6; Silver 15 / 8 / 3; and so on). They add
  up into Rocket League-style ranks, each in divisions I, II and III: 🥉 Bronze (0), 🥈 Silver (60),
  🥇 Gold (150), 💎 Diamond (300) and 🏆 Champion (500). Cosmetic only: they never affect the draw. (`src/lib/levels.ts`)
- **Tournament story (the main event):** after a tournament, tap **Watch the tournament story**.
  The champion is the hero, then every final's podium, the day's stories (perfect days, streaks,
  dream teams, the climb from the bottom into Gold, the epic deuce), records broken against every
  earlier weekend, and the day in numbers. (`src/lib/story.ts`)
- **Your review (second):** each player's own reel, under the story on the event page and on every
  weekend in their profile: record, game by game, finish, points and rank, partners, you vs the
  field, and the trend since last time. (`src/lib/recap.ts`)
- **Photos from the day:** anyone signed in can add photos to an event (take one or pick from the
  camera roll; the phone shrinks them first). The first one is the cover of the tournament story and
  the backdrop of its shareable card. Up to 24 per event; whoever added one, or an organiser, can
  remove it. Videos aren't supported yet: they'd need a file store (e.g. Vercel Blob).
- **Live winners:** everyone on the event page gets a pop-up the moment a final is decided.

## Accounts
- Anyone can view everything without signing in.
- Signed-in players (name + 4-digit code) can add themselves, check in, enter scores and subs.
- **Organiser tools** (post events, check people in, draw stages, finish) unlock for 12 hours with
  the organiser code (`ORGANISER_CODE`) on the Me tab, and then live on their own **Organise** tab
  in the bottom nav (`src/app/organise`): pick the event, the next step, groups, check-in, game
  length, details, post a new event, Lock. Only in-context bits stay on the event page (a decider
  for a tied group, subbing someone in from the score sheet).
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
- `src/lib/netLadder.ts`: the ladder as pure functions (seeding, up and down, sitting out, teams, the day's story). Tested in `netLadder.test.ts`.
- `src/lib/cards.ts`: the cards format as pure functions (group sizes, schedules, tables, subs). Tested in `cards.test.ts`.
- `src/lib/views.ts`, `src/lib/data.ts`: what each page shows, from the database.
- `src/app/actions.ts`: every change anyone can make, with its permission check.
- `src/components/EventScreen.tsx`: the event page (sign-up, live nets, groups, finals, organiser panel).
