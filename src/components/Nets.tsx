"use client";

import { motion } from "motion/react";
import { SOFT } from "@/components/kit";
import { Avatar, btnPrimary } from "@/components/ui";
import { PROV_N } from "@/lib/standings";
import type { PlayerLite, Moments } from "@/lib/data";
import type { ResultLine } from "@/lib/moments";

// The pieces every tournament format shares: a net drawn as a little court (two faces either
// side of the net, a ring to tap and score), a bottom sheet, and a game's result in that sheet
// (who won, and each player's rating change). Kept small on purpose: the result is the reward,
// with no full-screen stories.

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;

/** A face; `layoutId` lets it slide between courts when the draw changes. */
export function Face({ id, p, size = 46, dim = false }: { id: string; p?: PlayerLite; size?: number; dim?: boolean }) {
  return (
    <motion.div layoutId={`face-${id}`} transition={SOFT} className="flex">
      <Avatar p={p} size={size} dim={dim} />
    </motion.div>
  );
}

/** A net as a court: its name centred on top, one pair either side, and a ring to tap and score
 *  (or the score, once it's in). `note` is a line under it: what's next, or a warning. */
export function Court({ title, tag, a, b, scoreA, scoreB, people, live, highlight = false, note, warn, onTap, orbit = false }: {
  title: string; tag?: string; a: string[]; b: string[]; scoreA: number | null; scoreB: number | null;
  people: Record<string, PlayerLite>; live: boolean; highlight?: boolean; note?: React.ReactNode; warn?: string; onTap: () => void;
  /** A slow green light circling the edge: this net's game is on. */
  orbit?: boolean;
}) {
  const done = scoreA != null && scoreB != null;
  const aWon = done && scoreA! > scoreB!;
  const side = (ids: string[], won: boolean) => (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <div className="flex -space-x-1.5">{ids.map((id) => <Face key={id} id={id} p={people[id]} dim={done && !won} />)}</div>
      <span className={`w-full truncate text-center text-[13.5px] font-bold ${done ? (won ? "text-fg" : "text-dim") : "text-fg/90"}`}>{ids.map((id) => people[id]?.name ?? "?").join(" & ")}</span>
    </div>
  );
  return (
    <motion.button
      layout transition={SOFT} whileTap={{ scale: 0.98 }} onClick={onTap}
      className={`${orbit ? "spk-orbit " : ""}flex w-full flex-col items-center overflow-hidden rounded-3xl border pt-3 ${note || warn ? "pb-0" : "pb-4"} ${highlight ? "border-accent/30 bg-accent/[.06]" : "border-white/[.07] bg-surface"}`}
      aria-label={`${title}${done ? `, ${scoreA}–${scoreB}` : ", tap to score"}`}
    >
      <div className="mb-3 flex items-center gap-2 px-3">
        <span className={`text-[15px] font-black ${highlight ? "text-accent" : "text-fg"}`}>{title}</span>
        {tag && <span className="rounded-full bg-white/[.06] px-2 py-0.5 spk-label text-dim">{tag}</span>}
      </div>
      <div className="flex w-full items-center gap-2 px-3">
        {side(a, aWon)}
        <div className="flex w-16 shrink-0 flex-col items-center">
          {done ? (
            <span className="tnum font-mono text-[20px] font-black"><span className={aWon ? "text-accent" : "text-dim"}>{scoreA}</span><span className="text-dimmer">–</span><span className={!aWon ? "text-accent" : "text-dim"}>{scoreB}</span></span>
          ) : (
            <span className={`flex h-14 w-14 items-center justify-center rounded-full border-2 ${live ? "spk-live border-accent/70 text-accent" : "border-white/15 text-dim"}`} aria-hidden="true">
              <span className="h-7 w-7 rounded-full border border-current" />
            </span>
          )}
          {!done && live && <span className="mt-1.5 spk-label text-accent">Score</span>}
        </div>
        {side(b, done && !aWon)}
      </div>
      {warn && <div className="mt-3 w-full bg-loss/10 px-4 py-2 text-left text-[12.5px] font-semibold text-loss">{warn}</div>}
      {note && <div className={`${warn ? "" : "mt-3"} w-full border-t border-white/[.05] bg-panel px-4 py-2 text-left text-[12.5px] text-muted`}>{note}</div>}
    </motion.button>
  );
}

/** A bottom sheet over the page; tapping outside closes it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div className="fixed inset-0 z-[70] flex items-end bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={SOFT}
        className="mx-auto max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl border-t border-white/[.08] bg-surface p-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[13px] font-black uppercase tracking-[.16em] text-accent">{title}</span>
          <button onClick={onClose} className="spk-press -mr-2 p-2 text-muted" aria-label="Close">✕</button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

/** A game's result: who won, then each player with their rating change (still placing: how far
 *  through). `move` adds a line per player, e.g. where they go next on a ladder. */
export function MatchResult({ res, people, move, onDone, doneLabel = "Done" }: { res: Moments; people: Record<string, PlayerLite>; move?: (l: ResultLine) => string; onDone: () => void; doneLabel?: string }) {
  const slide = res.slides[0];
  const match = slide && (slide.kind === "game" || slide.kind === "match") ? slide.match : null;
  if (!match) return null;
  const name = (id: string) => people[id]?.name ?? res.names[id]?.name ?? "?";
  return (
    <div>
      <div className="text-[22px] font-black leading-tight">
        {(match.scoreA > match.scoreB ? match.a : match.b).map(name).join(" & ")} win{" "}
        <span className="tnum font-mono text-accent">{Math.max(match.scoreA, match.scoreB)}–{Math.min(match.scoreA, match.scoreB)}</span>
      </div>
      <div className="mt-4 grid gap-2">
        {[...match.lines].sort((x, y) => Number(y.won) - Number(x.won)).map((l) => (
          <motion.div key={l.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={SOFT} className="flex items-center gap-3 rounded-xl bg-panel px-3 py-2.5">
            <Avatar p={people[l.id] ?? res.names[l.id]} size={32} dim={!l.won} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-bold">{name(l.id)}</span>
              <span className={`block text-[12px] font-bold ${l.won ? "text-win" : "text-loss"}`}>{move ? `${l.won ? "↑" : "↓"} ${move(l)}` : l.won ? "Win" : "Loss"}</span>
            </span>
            {l.placingGame != null
              ? <span className="shrink-0 text-[12px] font-bold text-dim">🐣 {l.placingGame}/{PROV_N}</span>
              : <span className={`tnum shrink-0 font-mono text-[17px] font-black ${l.delta >= 0 ? "text-win" : "text-loss"}`}>{signed(l.delta)}</span>}
          </motion.div>
        ))}
      </div>
      <button onClick={onDone} className={`${btnPrimary} mt-4 h-12 w-full`}>{doneLabel}</button>
    </div>
  );
}
