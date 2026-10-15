// The ladder (Players), as in the club's ranked app: placed players by rating, each with their last
// few results as dots, W–L, a sparkline of their rating and how far they've moved today; then
// everyone still placing. Pure: ratings in, rows out.
import { PROV_N, type Ratings, type PlayerRating } from "@/lib/standings";

export type Form = ("W" | "L")[];

export type LadderRow = {
  id: string;
  rank: number;
  rating: number;
  w: number;
  l: number;
  form: Form;
  /** Rating after each of their last placed games, oldest first: the sparkline. */
  spark: number[];
  /** Rating moved at `eventId` (today's tournament), and places moved since it began. */
  today: number | null;
  move: number | "new" | null;
};

export type PlacingRow = { id: string; games: number; w: number; l: number; form: Form };

const form = (p: PlayerRating): Form => p.entries.slice(-5).map((e) => (e.won ? "W" : "L"));

/** The ladder. `eventId` is a live (or just finished) tournament: rows say what it's done to them. */
export function ladder(r: Ratings, eventId: string | null = null): { rows: LadderRow[]; placing: PlacingRow[] } {
  // Places before the event: the order of everyone placed by then, on their rating going in.
  let before: Map<string, number> | null = null;
  if (eventId) {
    const pre = [...r.players.values()].map((p) => {
      const first = p.entries.findIndex((e) => e.eventId === eventId);
      const gamesIn = first < 0 ? p.games : first;
      const rating = first < 0 ? p.rating : p.entries[first].ratingBefore;
      return { id: p.id, rating, placed: gamesIn >= PROV_N };
    }).filter((x) => x.placed).sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id));
    before = new Map(pre.map((x, i) => [x.id, i + 1]));
  }
  const rows = r.ranked.map((p): LadderRow => {
    const es = eventId ? p.entries.filter((e) => e.eventId === eventId) : [];
    const shown = es.filter((e) => e.gamesBefore >= PROV_N);
    const was = before?.get(p.id);
    return {
      id: p.id, rank: p.rank!, rating: p.rating, w: p.wins, l: p.losses, form: form(p),
      spark: p.entries.filter((e) => e.gamesBefore + 1 >= PROV_N).map((e) => e.ratingAfter).slice(-10),
      today: shown.length ? shown.reduce((n, e) => n + e.delta, 0) : null,
      move: !before ? null : was === undefined ? "new" : was - p.rank!,
    };
  });
  const placing = r.placing.map((p) => ({ id: p.id, games: p.games, w: p.wins, l: p.losses, form: form(p) }));
  return { rows, placing };
}
