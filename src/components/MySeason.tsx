"use client";

import { useState } from "react";
import Link from "next/link";
import { card, fmtDate } from "@/components/ui";
import { levelFor, climb } from "@/lib/levels";
import type { ProfileEvent, Season } from "@/lib/data";

export type { Season };

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

/** A player's weekends at a glance (the Me tab and every profile): their level, XP and place, the
 *  headline numbers, XP weekend by weekend, and the latest weekend with the rest a tap away. */
export function MySeason({ s }: { s: Season }) {
  const [all, setAll] = useState(false);
  const lv = levelFor(s.xp);
  const played = s.events.filter((e) => e.w + e.l > 0);
  const { stats } = s;
  return (
    <section className="px-4 pb-6">
      <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[12px] font-bold uppercase tracking-[.12em] text-muted">At a glance</h2>
      </div>
      <div className={`${card} overflow-hidden`}>
        <div className="p-4">
          <div className="flex items-baseline justify-between gap-3">
            {/* The level's name is on the banner round the photo above, so here it's the numbers. */}
            <span className="tnum text-[13px] text-muted"><b className="text-[22px] font-black text-fg">Level {lv.level.level}</b> · {s.xp} XP</span>
            {s.position > 0 && <span className="tnum text-[13px] font-bold" style={{ color: lv.level.color }}>{ordinal(s.position)} of {s.of}</span>}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${lv.progress * 100}%`, background: lv.level.color }} />
          </div>
          <div className="mt-1.5 text-[12px] text-dim">
            {lv.next ? `${lv.next.min - s.xp} XP to Level ${lv.next.level}, ${lv.next.icon} ${lv.next.name}` : "The top level. Hold on to it: losses cost XP."}
          </div>
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
              {(all ? played : played.slice(0, 1)).map((e) => (
                <Link key={e.id} href={e.live ? `/e/${e.id}` : `/e/${e.id}/recap?p=${s.id}`} className="spk-press flex items-center gap-3 border-b border-white/[.03] px-4 py-2.5 last:border-0">
                  <span className="w-12 shrink-0 text-[12px] font-bold text-dim">{fmtDate(e.startsAt, false).split(" ").slice(1).join(" ")}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px]"><span className="tnum font-mono font-bold">{e.w}–{e.l}</span>{e.live ? <span className="text-accent"> · so far, live</span> : e.finish && <span className="text-muted"> · {e.finish}</span>}</span>
                  <span className={`tnum shrink-0 text-[12.5px] font-bold ${e.change == null ? "text-dim" : e.change >= 0 ? "text-win" : "text-loss"}`}>{e.change == null ? "–" : `${e.change >= 0 ? "+" : "−"}${Math.abs(e.change)}`}</span>
                  <span className="shrink-0 text-[12px] text-dim" aria-hidden="true">▶</span>
                </Link>
              ))}
              {played.length > 1 && <ShowAll open={all} n={played.length - 1} what={played.length === 2 ? "weekend" : "weekends"} onClick={() => setAll(!all)} />}
            </div>
          </>
        ) : (
          <p className="border-t border-white/[.05] p-4 text-[13.5px] text-muted">Play your first weekend and your climb starts here.</p>
        )}
      </div>
    </section>
  );
}

/** XP after each weekend, as a line that can climb and dip, with the level lines it
 *  crossed or sits between drawn across it. */
function Climb({ events }: { events: ProfileEvent[] }) {
  const rated = events.filter((e) => e.after != null);
  const { values, marks } = climb(rated.map((e) => e.after!));
  if (!values.length) return null;
  const W = 340, H = 118, L = 8, R = 112, T = 12, B = 10;
  const lo = Math.max(0, Math.min(...values, ...marks.map((m) => m.min)) - 15), hi = Math.max(...values, ...marks.map((m) => m.min)) + 15;
  const x = (i: number) => (values.length === 1 ? (L + W - R) / 2 : L + (i * (W - R - L)) / (values.length - 1));
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = values.length > 1 ? `${line} L${x(values.length - 1).toFixed(1)} ${H - B} L${x(0).toFixed(1)} ${H - B} Z` : "";
  return (
    <div className="border-t border-white/[.05] px-2 pt-3 pb-2">
      <div className="px-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-dim">XP, weekend by weekend</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 block w-full" role="img" aria-label={`${values.at(-1)} XP after ${values.length} weekends`}>
        <defs>
          <linearGradient id="climbFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#CBFB4F" stopOpacity=".28" />
            <stop offset="1" stopColor="#CBFB4F" stopOpacity="0" />
          </linearGradient>
        </defs>
        {marks.map((m) => (
          <g key={m.name}>
            <line x1={L} x2={W - R + 6} y1={y(m.min)} y2={y(m.min)} stroke={m.color} strokeOpacity=".55" strokeDasharray="3 4" />
            <text x={W - R + 10} y={y(m.min) + 3.5} fill={m.color} fontSize="9" fontWeight="700">{m.icon} {m.name}</text>
          </g>
        ))}
        <line x1={L} x2={W - R + 6} y1={H - B} y2={H - B} stroke="#fff" strokeOpacity=".08" />
        {area && <path d={area} fill="url(#climbFill)" />}
        <path d={line} fill="none" stroke="#CBFB4F" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 4.5 : 3} fill={i === values.length - 1 ? "#CBFB4F" : "#15181b"} stroke="#CBFB4F" strokeWidth="2" />
        ))}
      </svg>
      <div className="flex justify-between px-2 text-[10.5px] text-dim">
        <span>{fmtDate(rated[0].startsAt, false).split(" ").slice(1).join(" ")}</span>
        {rated.length > 1 && <span>{fmtDate(rated.at(-1)!.startsAt, false).split(" ").slice(1).join(" ")}</span>}
      </div>
    </div>
  );
}

/** The "Show N more" / "Show less" row under a shortened list. */
export function ShowAll({ open, n, what, onClick }: { open: boolean; n: number; what: string; onClick: () => void }) {
  // n is how many are hidden: "Show 3 more weekends".
  return (
    <button onClick={onClick} className="spk-press flex w-full items-center justify-center gap-1.5 border-t border-white/[.05] py-2.5 text-[12.5px] font-bold text-accent">
      {open ? "Show less" : `Show ${n} more ${what}`}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={open ? "rotate-180" : ""} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
  );
}
