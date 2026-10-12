import Link from "next/link";
import { card, fmtDate, LevelPill } from "@/components/ui";
import { levelFor, climb } from "@/lib/levels";
import type { Line } from "@/lib/cards";
import type { ProfileEvent } from "@/lib/data";

export type Season = { id: string; points: number; position: number; of: number; stats: Line & { events: number }; titles: number; events: ProfileEvent[] };

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

/** The Me tab's summary of every weekend you've played: rank, the headline numbers, the climb in
 *  rank points, and your latest weekends. Compact on purpose; the full detail is on your profile. */
export function MySeason({ s }: { s: Season }) {
  const lv = levelFor(s.points);
  const played = s.events.filter((e) => e.w + e.l > 0);
  const { stats } = s;
  return (
    <section className="px-4 pb-6">
      <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[12px] font-bold uppercase tracking-[.12em] text-muted">Your weekends</h2>
        <Link href={`/p/${s.id}`} className="text-[12px] font-bold text-accent">Full profile →</Link>
      </div>
      <div className={`${card} overflow-hidden`}>
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <LevelPill level={lv.level} size="md" />
            <span className="tnum text-[13px] text-muted"><b className="text-fg">{s.points}</b> pts{s.position ? ` · ${ordinal(s.position)} of ${s.of}` : ""}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${lv.progress * 100}%`, background: lv.level.color }} />
          </div>
          <div className="mt-1.5 text-[12px] text-dim">{lv.next ? `${lv.next.min - s.points} to ${lv.next.name}` : "Top rank"}</div>
        </div>

        <div className="grid grid-cols-4 border-t border-white/[.05] text-center">
          {([
            [String(stats.events), "weekends"],
            [`${stats.w}–${stats.l}`, "won–lost"],
            [stats.gp ? `${Math.round((100 * stats.w) / stats.gp)}%` : "–", "win rate"],
            [String(s.titles), s.titles === 1 ? "title" : "titles"],
          ] as const).map(([v, l]) => (
            <div key={l} className="py-3">
              <div className="tnum text-[18px] font-black leading-none">{v}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[.1em] text-dim">{l}</div>
            </div>
          ))}
        </div>

        {played.length > 0 ? (
          <>
            <Climb events={[...played].reverse()} />
            <div className="border-t border-white/[.05]">
              {played.slice(0, 4).map((e) => (
                <Link key={e.id} href={e.live ? `/e/${e.id}` : `/e/${e.id}/recap?p=${s.id}`} className="spk-press flex items-center gap-3 border-b border-white/[.03] px-4 py-2.5 last:border-0">
                  <span className="w-12 shrink-0 text-[12px] font-bold text-dim">{fmtDate(e.startsAt, false).split(" ").slice(1).join(" ")}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px]"><span className="tnum font-mono font-bold">{e.w}–{e.l}</span>{e.live ? <span className="text-accent"> · so far, live</span> : e.finish && <span className="text-muted"> · {e.finish}</span>}</span>
                  <span className="tnum shrink-0 text-[12.5px] font-bold text-accent">+{e.points}</span>
                  <span className="shrink-0 text-[12px] text-dim" aria-hidden="true">▶</span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="border-t border-white/[.05] p-4 text-[13.5px] text-muted">Play your first weekend and your climb starts here.</p>
        )}
      </div>
    </section>
  );
}

/** Rank points after each weekend, as a line, with the rank thresholds it passed (or is next to
 *  reach) drawn across it. */
function Climb({ events }: { events: ProfileEvent[] }) {
  const { totals, marks } = climb(events.map((e) => e.points));
  const W = 340, H = 118, L = 8, R = 62, T = 12, B = 10;
  const max = Math.max(totals.at(-1) ?? 0, ...marks.map((m) => m.min)) * 1.06 || 1;
  const x = (i: number) => (totals.length === 1 ? (L + W - R) / 2 : L + (i * (W - R - L)) / (totals.length - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = totals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = totals.length > 1 ? `${line} L${x(totals.length - 1).toFixed(1)} ${H - B} L${x(0).toFixed(1)} ${H - B} Z` : "";
  return (
    <div className="border-t border-white/[.05] px-2 pt-3 pb-2">
      <div className="px-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-dim">Rank points, weekend by weekend</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 block w-full" role="img" aria-label={`Rank points climbing to ${totals.at(-1)} over ${totals.length} weekends`}>
        <defs>
          <linearGradient id="climbFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#CBFB4F" stopOpacity=".28" />
            <stop offset="1" stopColor="#CBFB4F" stopOpacity="0" />
          </linearGradient>
        </defs>
        {marks.map((m) => (
          <g key={m.tier}>
            <line x1={L} x2={W - R + 6} y1={y(m.min)} y2={y(m.min)} stroke={m.color} strokeOpacity=".55" strokeDasharray="3 4" />
            <text x={W - R + 10} y={y(m.min) + 3.5} fill={m.color} fontSize="10" fontWeight="700">{m.tier}</text>
          </g>
        ))}
        <line x1={L} x2={W - R + 6} y1={H - B} y2={H - B} stroke="#fff" strokeOpacity=".08" />
        {area && <path d={area} fill="url(#climbFill)" />}
        <path d={line} fill="none" stroke="#CBFB4F" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {totals.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === totals.length - 1 ? 4.5 : 3} fill={i === totals.length - 1 ? "#CBFB4F" : "#15181b"} stroke="#CBFB4F" strokeWidth="2" />
        ))}
      </svg>
      <div className="flex justify-between px-2 text-[10.5px] text-dim">
        <span>{fmtDate(events[0].startsAt, false).split(" ").slice(1).join(" ")}</span>
        {events.length > 1 && <span>{fmtDate(events.at(-1)!.startsAt, false).split(" ").slice(1).join(" ")}</span>}
      </div>
    </div>
  );
}
