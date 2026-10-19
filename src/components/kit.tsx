"use client";

// The pieces borrowed from the club's ranked app (spike-east, src/components/spike/ui.tsx) so the
// two look and move as one: its springs, form dots, a sparkline per player, the ladder rows that fan
// in and slide to their new place, broadcast-style result cards and a Disclosure that keeps a page
// short until you want more.

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup, useReducedMotion, useMotionValue, animate, type Transition } from "motion/react";
import { Avatar, LevelPill } from "@/components/ui";
import { tierFor } from "@/lib/levels";
import type { LadderRow, PlacingRow, Form } from "@/lib/ladder";
import type { PlayerLite } from "@/lib/data";
import { PROV_N } from "@/lib/standings";

const WIN = "#5CD37D", LOSS = "#FF6B6B", SURFACE = "#15181b";

// ===== motion language (the ranked app's) =====
export const SPRING: Transition = { type: "spring", stiffness: 520, damping: 30, mass: 0.7 };
export const SOFT: Transition = { type: "spring", stiffness: 320, damping: 34 };
export const BOUNCE: Transition = { type: "spring", stiffness: 420, damping: 17, mass: 0.8 };
/** A list whose children fan in one after another, then animate to new slots on reorder. */
export const listV = { animate: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } } };
export const rowV = {
  initial: { opacity: 0, y: 14, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1, transition: SOFT },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15 } },
};

/** Counts a number up to its target, so figures feel earned. */
export function AnimatedNumber({ value, from, format = (n) => String(n), duration = 0.55, className }: { value: number; from?: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(from ?? value);
  const [shown, setShown] = useState(from ?? value);
  useEffect(() => {
    if (reduce) return;
    const c = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);
  return <span className={className}>{format(reduce ? value : shown)}</span>;
}

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
  const reduce = useReducedMotion();
  const pts = points.slice(-10);
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
      <motion.path d={line} fill="none" stroke={col} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={reduce ? undefined : { pathLength: 1, opacity: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
      <circle cx={lx} cy={ly} r={3.4} fill={col} opacity={0.16} />
      <motion.circle cx={lx} cy={ly} r={1.9} fill={col} initial={reduce ? false : { opacity: 0 }} animate={reduce ? undefined : { opacity: 1 }} transition={{ delay: 0.55, duration: 0.3 }} />
    </svg>
  );
}

/** Places moved today: ▲ climbed, ▼ slipped, NEW just placed, – held. */
export function RankDelta({ d }: { d: number | "new" | null }) {
  if (d === null) return null;
  if (d === "new") return <span className="text-[7.5px] font-extrabold leading-none tracking-[.02em] text-accent">NEW</span>;
  if (d === 0) return <span className="text-[10px] font-bold leading-none text-dimmer">–</span>;
  return <span className={`flex items-center gap-px text-[8.5px] font-extrabold leading-none ${d > 0 ? "text-win" : "text-loss"}`}><span className="text-[7px]">{d > 0 ? "▲" : "▼"}</span>{Math.abs(d)}</span>;
}

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n)}`;
const medal = (r: number) => (r === 1 ? "#CBFB4F" : r === 2 ? "#C4CDD6" : r === 3 ? "#E0935A" : "#6B7177");

/**
 * The ladder, the ranked app's: a card per placed player with rank (and places moved today),
 * photo, name, last results as dots with W–L, a sparkline of their rating and the rating itself,
 * their tier on a footer line. Rows fan in on arrival and slide to their new place when a result
 * reorders them. Then everyone still placing, with how far through they are.
 */
export function Ladder({ rows, placing, people }: { rows: LadderRow[]; placing: PlacingRow[]; people: Record<string, PlayerLite> }) {
  return (
    <LayoutGroup id="ladder">
      <motion.div variants={listV} initial="initial" animate="animate" className="flex flex-col gap-[7px]">
        {rows.map((r) => {
          const p = people[r.id];
          const top = r.rank === 1;
          return (
            <motion.div key={r.id} layout="position" variants={rowV} whileTap={{ scale: 0.97 }}>
              <Link href={`/p/${r.id}`} className={`flex flex-col gap-2 rounded-[14px] border px-3 py-[11px] ${top ? "border-accent/[.28] bg-accent/[.05]" : "border-white/[.06] bg-surface"}`}>
                <div className="flex items-center gap-[11px]">
                  <div className="flex w-[22px] shrink-0 flex-col items-center gap-0.5">
                    <span className="font-mono text-[15px] font-extrabold leading-none" style={{ color: medal(r.rank) }}>{r.rank}</span>
                    <RankDelta d={r.move} />
                  </div>
                  <span className="rounded-full" style={{ boxShadow: r.rank <= 3 ? `0 0 0 2px ${SURFACE}, 0 0 0 3.5px ${medal(r.rank)}` : undefined }}><Avatar p={p} size={36} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-bold">{p?.name ?? "Someone"}</span>
                      {top && <svg width="13" height="13" viewBox="0 0 24 24" fill="#FFCF5C" aria-hidden="true"><path d="M5 16L3 5l5.5 4L12 4l3.5 5L21 5l-2 11H5z" /></svg>}
                    </div>
                    <div className="mt-[5px] flex flex-wrap items-center gap-1">
                      <FormDots form={r.form} />
                      <span className="ml-1 shrink-0 whitespace-nowrap font-mono text-[11px] text-dim">{r.w}–{r.l}</span>
                    </div>
                  </div>
                  <Sparkline points={r.spark} />
                  <div className="shrink-0 text-right">
                    <AnimatedNumber value={r.rating} className={`block font-mono text-[19px] font-extrabold ${top ? "text-accent" : "text-fg"}`} />
                    <span className="mt-px block text-[8.5px] font-bold tracking-[.06em] text-dimmer">RATING</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-[33px]">
                  <LevelPill level={tierFor({ rating: r.rating, games: PROV_N }).level} />
                  {r.today !== null && <span className={`ml-auto whitespace-nowrap font-mono text-[10.5px] font-bold ${r.today >= 0 ? "text-win" : "text-loss"}`}>{signed(r.today)} today</span>}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {placing.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 pl-0.5 spk-label text-dim">Getting placed · {PROV_N} games</div>
          <motion.div variants={listV} initial="initial" animate="animate" className="flex flex-col gap-[7px]">
            {placing.map((r) => (
              <motion.div key={r.id} layout="position" variants={rowV} whileTap={{ scale: 0.97 }}>
                <Link href={`/p/${r.id}`} className="flex items-center gap-3 rounded-[14px] border border-dashed border-white/10 bg-panel px-3 py-2.5">
                  <span className="w-[22px] shrink-0 text-center text-[15px]" aria-hidden="true">🐣</span>
                  <Avatar p={people[r.id]} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-bold">{people[r.id]?.name ?? "Someone"}</div>
                    <div className="mt-1 flex items-center gap-1"><FormDots form={r.form} /><span className="ml-1 font-mono text-[11px] text-dim">{r.w}–{r.l}</span></div>
                  </div>
                  <div className="flex shrink-0 items-center gap-[3px]" aria-label={`${r.games} of ${PROV_N} placement games`}>
                    {Array.from({ length: PROV_N }, (_, i) => <span key={i} className={`h-1.5 w-3 rounded-full ${i < r.games ? "bg-accent" : "bg-white/10"}`} />)}
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </LayoutGroup>
  );
}

/**
 * The ranked app's broadcast-style result: a small column on the left, both pairs stacked with
 * their faces overlapping, and the scores lined up on the right. Winner in lime, loser in white.
 * An unplayed game shows a dashed score box instead.
 */
export function ResultCard({ a, b, scoreA, scoreB, people, left, aside, onClick, dim, label, flat }: {
  a: string[]; b: string[]; scoreA: number | null; scoreB: number | null; people: Record<string, PlayerLite>;
  left?: React.ReactNode; aside?: React.ReactNode; onClick?: () => void; dim?: boolean; label?: string;
  /** Inside another card: no border of its own, a hairline between rows instead. */
  flat?: boolean;
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
              {t.ids.map((id, j) => <span key={id} className="flex" style={{ marginLeft: j ? -7 : 0 }}><Avatar p={people[id]} size={20} ring={SURFACE} /></span>)}
            </div>
            <span className={`min-w-0 flex-1 truncate text-[13.5px] ${t.won ? "font-bold text-accent" : "font-semibold text-fg"}`}>{t.ids.map((id) => people[id]?.name ?? "Someone").join(" & ")}</span>
            {done
              ? <span className={`min-w-[26px] shrink-0 text-right font-mono text-[18px] font-extrabold leading-none ${t.won ? "text-accent" : "text-fg"}`}>{t.score}</span>
              : i === 0 && aside == null && <span className="shrink-0 rounded-md border border-dashed border-white/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-dim">score</span>}
          </div>
        ))}
      </div>
      {aside}
    </>
  );
  const cls = `flex w-full items-center gap-[11px] text-left ${flat ? "border-t border-white/[.05] first:border-t-0 px-4 py-[11px]" : "rounded-[14px] border border-white/[.06] bg-surface px-[13px] py-[11px]"} ${dim ? "opacity-40" : ""}`;
  return onClick
    ? <motion.button whileTap={{ scale: 0.98 }} onClick={onClick} className={cls} aria-label={label}>{body}</motion.button>
    : <div className={cls}>{body}</div>;
}

/** A collapsed row that opens in place. The teaser is the point: closed, the page still says
 *  something at a glance, and you only go deeper on what you care about. */
export function Disclosure({ title, teaser, defaultOpen = false, children }: { title: React.ReactNode; teaser?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-[14px] border border-white/[.06] bg-surface">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="spk-press flex w-full items-center gap-2.5 px-3.5 py-[13px] text-left">
        <span className="min-w-0 flex-1 text-[13.5px] font-bold text-fg">{title}</span>
        {teaser != null && <span className="shrink-0 font-mono text-[12px] text-dim">{teaser}</span>}
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={SPRING} className="flex shrink-0 text-dimmer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: SOFT, opacity: { duration: 0.15 } }} className="overflow-hidden">
            <div className="px-3.5 pt-0.5 pb-3.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
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
