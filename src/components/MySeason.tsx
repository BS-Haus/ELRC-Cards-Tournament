"use client";

import { useState } from "react";
import Link from "next/link";
import { card, fmtDate } from "@/components/ui";
import { levelFor, LEVELS } from "@/lib/levels";
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

/** XP after each weekend as a path up through the levels: each level a band, labelled inside on
 *  the left, the band you're in tinted in its colour, and your latest XP tagged at the end. Only the
 *  levels the path has been through, plus the next one up, so it reads at a glance. */
function Climb({ events }: { events: ProfileEvent[] }) {
  const rated = events.filter((e) => e.after != null);
  const values = rated.map((e) => e.after!);
  if (!values.length) return null;
  const W = 340, H = 132, T = 16, B = 6;
  const first = levelFor(Math.min(...values)).level, now = levelFor(values.at(-1)!), top = levelFor(Math.max(...values));
  const lo = first.min, hi = (top.next ?? top.level).min + (top.next ? 0 : 60);
  const bands = LEVELS.filter((l) => l.min >= lo && l.min < hi).map((l, i, all) => ({ ...l, to: all[i + 1]?.min ?? hi }));
  const G = 44; // label gutter on the left, so the path never sits on a level's name
  const x = (i: number) => (values.length === 1 ? (G + W) / 2 : G + 8 + (i * (W - G - 22)) / (values.length - 1));
  const y = (v: number) => T + (1 - (Math.min(v, hi) - lo) / (hi - lo)) * (H - T - B);
  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = values.length > 1 ? `${path} L${x(values.length - 1).toFixed(1)} ${H - B} L${x(0).toFixed(1)} ${H - B} Z` : "";
  const last = { x: x(values.length - 1), y: y(values.at(-1)!) };
  const tag = `${values.at(-1)} XP`;
  const tagW = tag.length * 6.2 + 12;
  const tagX = Math.min(W - tagW - 2, Math.max(2, last.x - tagW / 2));
  const dates = rated.map((e) => fmtDate(e.startsAt, false).split(" ").slice(1).join(" "));
  return (
    <div className="border-t border-white/[.05] px-3 pt-3 pb-2">
      <div className="px-1 text-[10.5px] font-bold uppercase tracking-[.1em] text-dim">Your climb</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block w-full overflow-visible" role="img" aria-label={`${values.at(-1)} XP after ${values.length} weekends, Level ${now.level.level}`}>
        <defs>
          <linearGradient id="climbFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#CBFB4F" stopOpacity=".3" />
            <stop offset="1" stopColor="#CBFB4F" stopOpacity="0" />
          </linearGradient>
          <clipPath id="climbClip"><rect x="0" y={T} width={W} height={H - T - B} rx="10" /></clipPath>
        </defs>
        <g clipPath="url(#climbClip)">
          {bands.map((b, i) => {
            const y0 = y(b.to), y1 = y(b.min), mine = b.level === now.level.level;
            return (
              <g key={b.level}>
                <rect x="0" y={y0} width={W} height={y1 - y0} fill={mine ? b.color : "#ffffff"} fillOpacity={mine ? 0.12 : i % 2 ? 0.035 : 0.015} />
                <line x1="0" x2={W} y1={y1} y2={y1} stroke="#ffffff" strokeOpacity=".07" />
                {y1 - y0 >= 13 && (
                  <text x="8" y={y1 - 5} fill={mine ? b.color : "#8A9196"} fillOpacity={mine ? 1 : 0.8} fontSize="9" fontWeight="800">Lv {b.level} {b.icon}</text>
                )}
              </g>
            );
          })}
          {area && <path d={area} fill="url(#climbFill)" />}
        </g>
        {top.next && (
          <g>
            <line x1={G} x2={W} y1={T} y2={T} stroke={top.next.color} strokeOpacity=".7" strokeDasharray="3 4" />
            <text x="8" y={T + 3.5} fill={top.next.color} fontSize="9" fontWeight="800">Lv {top.next.level} {top.next.icon}</text>
          </g>
        )}
        <path d={path} fill="none" stroke="#CBFB4F" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 5 : 3} fill={i === values.length - 1 ? "#CBFB4F" : "#15181b"} stroke="#CBFB4F" strokeWidth="2" />
        ))}
        <g transform={`translate(${tagX} ${Math.max(0, last.y - 24)})`}>
          <rect width={tagW} height="16" rx="8" fill="#CBFB4F" />
          <text x={tagW / 2} y="11.5" textAnchor="middle" fill="#0c0e10" fontSize="10" fontWeight="800">{tag}</text>
        </g>
      </svg>
      <div className="relative mt-1 h-4 text-[10px] text-dim">
        {(dates.length <= 6 ? dates.map((d, i) => [d, i] as const) : [[dates[0], 0] as const, [dates.at(-1)!, dates.length - 1] as const]).map(([d, i]) => (
          <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(x(i) / W) * 100}%` }}>{d}</span>
        ))}
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
