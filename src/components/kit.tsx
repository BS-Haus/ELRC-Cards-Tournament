"use client";

// The pieces borrowed from the club's ranked app (spike-east, src/components/spike/ui.tsx) so the
// two read as one: form dots, a sparkline per player, ladder rows, broadcast-style result cards and
// a Disclosure that keeps a page short until you want more.

import { useId, useState } from "react";
import Link from "next/link";
import { Avatar, LevelPill } from "@/components/ui";
import { levelFor } from "@/lib/levels";
import type { LadderRow, Form } from "@/lib/ladder";
import type { PlayerLite } from "@/lib/data";

const WIN = "#5CD37D", LOSS = "#FF6B6B";

/** Last few results as dots, oldest first: green won, red lost. */
export function FormDots({ form, size = 7 }: { form: Form; size?: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`Last ${form.length}: ${form.join(" ")}`}>
      {form.map((r, i) => <span key={i} className="rounded-full" style={{ width: size, height: size, background: r === "W" ? WIN : LOSS }} />)}
    </span>
  );
}

/** A tiny trend line: green if it ends at or above where it started, red if it slipped. The line
 *  draws itself in and a dot marks where they are now. */
export function Sparkline({ points, w = 56, h = 26 }: { points: number[]; w?: number; h?: number }) {
  const id = useId();
  const pts = points.slice(-11);
  if (pts.length < 2) return <span className="block shrink-0" style={{ width: w, height: h }} />;
  const lo = Math.min(...pts), hi = Math.max(...pts), range = hi - lo || 1;
  const pad = 3, ih = h - pad * 2, step = w / (pts.length - 1);
  const xy = pts.map((v, i) => [i * step, pad + ih - ((v - lo) / range) * ih] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const col = pts.at(-1)! >= pts[0] ? WIN : LOSS;
  const [lx, ly] = xy.at(-1)!;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block shrink-0 overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`sg${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity={0.22} />
          <stop offset="100%" stopColor={col} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#sg${id})`} />
      <path d={line} pathLength={1} className="spk-draw" fill="none" stroke={col} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={3.4} fill={col} opacity={0.16} />
      <circle cx={lx} cy={ly} r={1.9} fill={col} />
    </svg>
  );
}

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n)}`;
const medal = (r: number) => (r === 1 ? "#FFCF5C" : r === 2 ? "#C4CDD6" : r === 3 ? "#E0935A" : "#6B7177");

/**
 * The ladder, a card per player like the ranked app: rank, photo, name, their last results as dots
 * with W–L, a sparkline of their XP and one big number, with their level on a footer line.
 * `metric` picks the big number: XP made today (a tournament) or all-time XP (Players).
 */
export function Ladder({ rows, people, metric, notes = {}, limit }: { rows: LadderRow[]; people: Record<string, PlayerLite>; metric: "today" | "xp"; notes?: Record<string, React.ReactNode>; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = limit && !all ? rows.slice(0, limit) : rows;
  return (
    <div className="flex flex-col gap-[7px]">
      {shown.map((r) => {
        const p = people[r.id];
        const top = r.rank === 1 && (metric === "xp" ? r.xp > 0 : r.w + r.l > 0);
        const lv = levelFor(r.xp).level;
        const played = r.w + r.l > 0;
        const big = metric === "today" ? (played ? signed(r.change) : "–") : String(r.xp);
        return (
          <Link
            key={r.id} href={`/p/${r.id}`}
            className={`spk-press spk-up flex flex-col gap-2 rounded-[14px] border px-3 py-[11px] ${top ? "border-accent/30 bg-accent/[.05]" : "border-white/[.06] bg-surface"}`}
          >
            <div className="flex items-center gap-[11px]">
              <span className="w-[22px] shrink-0 text-center font-mono text-[15px] font-extrabold leading-none" style={{ color: top ? "#CBFB4F" : medal(r.rank) }}>{played || metric === "xp" ? r.rank : "–"}</span>
              <span className="rounded-full" style={{ boxShadow: r.rank <= 3 && played ? `0 0 0 2px #15181b, 0 0 0 3.5px ${medal(r.rank)}` : undefined }}><Avatar p={p} size={36} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-bold">{p?.name ?? "Someone"}</span>
                  {top && <span aria-hidden="true" className="text-[12px]">👑</span>}
                </div>
                <div className="mt-[5px] flex flex-wrap items-center gap-1">
                  {played ? (
                    <>
                      <FormDots form={r.form} />
                      <span className="ml-1 shrink-0 whitespace-nowrap font-mono text-[11px] text-dim">{r.w}–{r.l}</span>
                    </>
                  ) : <span className="text-[11.5px] text-dim">Yet to play</span>}
                </div>
              </div>
              <Sparkline points={r.spark} />
              <div className="w-[52px] shrink-0 text-right">
                <span className={`block font-mono text-[19px] font-extrabold leading-tight ${top ? "text-accent" : metric === "today" && played ? (r.change >= 0 ? "text-fg" : "text-loss") : "text-fg"}`}>{big}</span>
                <span className="block whitespace-nowrap text-[8.5px] font-bold tracking-[.06em] text-dimmer">
                  {metric === "today" ? "XP TODAY" : <>XP{r.change !== 0 && <span className={r.change > 0 ? "text-win" : "text-loss"}> {signed(r.change)}</span>}</>}
                </span>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2 pl-[33px] whitespace-nowrap">
              <LevelPill level={lv} />
              {metric === "today" && <span className="font-mono text-[10px] text-dimmer">{r.xp} XP</span>}
              {notes[r.id] != null && <span className="ml-auto truncate text-[10.5px] font-semibold text-dim">{notes[r.id]}</span>}
            </div>
          </Link>
        );
      })}
      {limit != null && rows.length > limit && (
        <button onClick={() => setAll(!all)} className="spk-press mt-1 self-center rounded-full px-4 py-2 text-[12.5px] font-bold text-accent">
          {all ? "Show less" : `See all ${rows.length} →`}
        </button>
      )}
    </div>
  );
}

/**
 * A broadcast-style result: a small column on the left (net, game, date), both teams stacked with
 * their paired avatars, and the scores lined up on the right. Winner in lime. An unplayed game
 * shows a dashed score box instead.
 */
export function ResultCard({ a, b, scoreA, scoreB, people, left, aside, onClick, dim, label }: {
  a: string[]; b: string[]; scoreA: number | null; scoreB: number | null; people: Record<string, PlayerLite>;
  left?: React.ReactNode; aside?: React.ReactNode; onClick?: () => void; dim?: boolean; label?: string;
}) {
  const done = scoreA != null && scoreB != null;
  const aWon = done && scoreA! > scoreB!;
  const teams = [{ ids: a, score: scoreA, won: done && aWon }, { ids: b, score: scoreB, won: done && !aWon }];
  const body = (
    <>
      {left != null && <div className="w-10 shrink-0 text-center text-[10px] font-bold leading-[1.25] tracking-[.02em] text-dim">{left}</div>}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {teams.map((t, i) => (
          <div key={i} className="flex items-center gap-[9px]">
            <div className="flex shrink-0">
              {t.ids.map((id, j) => <span key={id} className="rounded-full ring-2 ring-surface" style={{ marginLeft: j ? -7 : 0 }}><Avatar p={people[id]} size={20} /></span>)}
            </div>
            <span className={`min-w-0 flex-1 truncate text-[13.5px] ${t.won ? "font-bold text-accent" : "font-semibold text-fg"}`}>{t.ids.map((id) => people[id]?.name ?? "Someone").join(" & ")}</span>
            {done
              ? <span className={`min-w-[26px] shrink-0 text-right font-mono text-[18px] font-extrabold leading-none ${t.won ? "text-accent" : "text-fg"}`}>{t.score}</span>
              : i === 0 && <span className="shrink-0 rounded-md border border-dashed border-white/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-dim">score</span>}
          </div>
        ))}
      </div>
      {aside}
    </>
  );
  const cls = `flex w-full items-center gap-[11px] rounded-[14px] border border-white/[.06] bg-surface px-[13px] py-[11px] text-left ${dim ? "opacity-40" : ""}`;
  return onClick
    ? <button onClick={onClick} className={`spk-press ${cls}`} aria-label={label}>{body}</button>
    : <div className={cls}>{body}</div>;
}

/** A collapsed row that opens in place. The teaser is the point: closed, the page still says
 *  something at a glance, and you only go deeper on what you care about. */
export function Disclosure({ title, teaser, defaultOpen = false, children, tone }: { title: React.ReactNode; teaser?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode; tone?: "plain" | "quiet" }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`overflow-hidden rounded-[14px] border ${tone === "quiet" ? "border-dashed border-white/[.1] bg-panel" : "border-white/[.06] bg-surface"}`}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="spk-press flex w-full items-center gap-2.5 px-3.5 py-[13px] text-left">
        <span className="min-w-0 flex-1 text-[13.5px] font-bold text-fg">{title}</span>
        {teaser != null && <span className="shrink-0 font-mono text-[12px] text-dim">{teaser}</span>}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-dimmer transition-transform duration-200 ${open ? "rotate-90" : ""}`} aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
      </button>
      {open && <div className="spk-up px-3.5 pt-0.5 pb-3.5">{children}</div>}
    </div>
  );
}

/** A tight label/value pair: a profile's unit of information. */
export function StatLine({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[.04] py-[7px] last:border-0">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="shrink-0 font-mono text-[13.5px] font-bold" style={{ color }}>{value}</span>
    </div>
  );
}
