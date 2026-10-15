"use client";

// Score entry, the ranked app's way (spike-east, renderLog and ScoreRail in src/components/spike/
// ui.tsx): tap the team that won and they get the game's points; slide the losers' score along a
// dial and the winners follow (win by two). Nothing to type, and an invalid score can't be made.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/ui";
import { AnimatedNumber, SPRING, SOFT, BOUNCE } from "@/components/kit";
import { winnerScore } from "@/lib/cards";
import type { PlayerLite } from "@/lib/data";

/** Highest losing score on the dial; px per tick (the dial reads its value from scrollLeft). */
const RAIL_MAX = 34;
const RAIL_TICK = 44;
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type Pick = { winner: "a" | "b" | null; loser: number };

/** The scores a pick makes: [team A, team B], or null until a winner's tapped. */
export const scoresOf = (p: Pick, to: number): [number, number] | null =>
  p.winner === null ? null : p.winner === "a" ? [winnerScore(p.loser, to), p.loser] : [p.loser, winnerScore(p.loser, to)];

/**
 * Both teams side by side, each a big number to tap for the win; once there's a winner, a dial
 * for the losers' score. `tint` is the colour the winner lights up in (lime, or ink on a lime card).
 */
export function ScoreEntry({ a, b, people, to, value, onChange, onAccent = false }: {
  a: string[]; b: string[]; people: Record<string, PlayerLite>; to: number; value: Pick; onChange: (p: Pick) => void; onAccent?: boolean;
}) {
  const s = scoresOf(value, to);
  const loserSide = value.winner === "a" ? "b" : value.winner === "b" ? "a" : null;
  // One row: each team's faces and names on the outside, their scores meeting in the middle.
  // Tapping either half (faces, names or number) makes that team the winner.
  const half = (side: "a" | "b") => {
    const ids = side === "a" ? a : b;
    const won = value.winner === side;
    const n = s ? (side === "a" ? s[0] : s[1]) : 0;
    const hi = onAccent ? "text-ink" : "text-accent";
    const right = side === "b";
    return (
      <motion.button
        type="button" onClick={() => onChange({ winner: side, loser: value.winner ? value.loser : Math.max(0, to - 6) })}
        whileTap={{ scale: 0.94 }} transition={SPRING}
        aria-pressed={won} aria-label={`${ids.map((id) => people[id]?.name).join(" & ")} won`}
        className={`spk-noselect flex min-w-0 flex-1 items-center gap-2.5 ${right ? "flex-row-reverse text-right" : "text-left"}`}
      >
        <span className={`flex min-w-0 flex-1 flex-col ${right ? "items-end" : "items-start"}`}>
          <span className={`flex ${right ? "flex-row-reverse" : ""}`}>{ids.map((id, j) => <span key={id} className="flex" style={{ [right ? "marginRight" : "marginLeft"]: j ? -7 : 0 }}><Avatar p={people[id]} size={26} ring={onAccent ? "#CBFB4F" : "#15181b"} /></span>)}</span>
          <span className={`mt-1 w-full truncate text-[12.5px] font-bold leading-tight ${won ? hi : onAccent ? "text-ink/80" : "text-fg"}`}>{ids.map((id) => people[id]?.name ?? "?").join(" & ")}</span>
          <span className="block h-3">
            <AnimatePresence mode="wait" initial={false}>
              {won ? (
                <motion.span key="w" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={BOUNCE} className={`block text-[9.5px] font-extrabold tracking-[.06em] ${hi}`}>WINNER</motion.span>
              ) : value.winner === null ? (
                <motion.span key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`block text-[9.5px] font-bold tracking-[.06em] ${onAccent ? "text-ink/50" : "text-dimmer"}`}>TAP TO WIN</motion.span>
              ) : null}
            </AnimatePresence>
          </span>
        </span>
        <motion.span animate={{ scale: won ? 1.08 : 1 }} transition={SPRING} className="shrink-0">
          <AnimatedNumber value={n} duration={0.35} className={`block w-[54px] font-mono text-[40px] font-extrabold leading-none transition-colors ${right ? "text-left" : "text-right"} ${s ? (won ? hi : onAccent ? "text-ink/60" : "text-fg") : onAccent ? "text-ink/25" : "text-white/15"}`} />
        </motion.span>
      </motion.button>
    );
  };
  // min-w-0 all the way down: the dial is far wider than the screen, and inside a grid or flex
  // item it would otherwise push the whole card (and page) out to its full width.
  return (
    <div className="w-full min-w-0">
      <div className="flex items-center gap-1.5">
        {half("a")}
        <span className={`font-mono text-[20px] font-bold ${onAccent ? "text-ink/30" : "text-[#3A4046]"}`}>:</span>
        {half("b")}
      </div>
      <AnimatePresence initial={false}>
        {loserSide && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SOFT} className="overflow-hidden">
            <div className={`mt-3 border-t pt-3 ${onAccent ? "border-ink/10" : "border-white/[.06]"}`}>
              <div className={`mb-1 text-center text-[10px] font-bold tracking-[.06em] ${onAccent ? "text-ink/55" : "text-dimmer"}`}>SLIDE {(loserSide === "a" ? a : b).map((id) => people[id]?.name?.toUpperCase() ?? "?").join(" & ")}&apos;S SCORE</div>
              <ScoreRail value={value.loser} onChange={(v) => onChange({ ...value, loser: v })} onAccent={onAccent} />
              <div className={`mt-1.5 text-center text-[11px] leading-snug ${onAccent ? "text-ink/60" : "text-dim"}`}>
                {s && Math.max(...s) > to ? <>Deuce: <b>{Math.max(...s)}–{Math.min(...s)}</b></> : `Went past ${to}? Keep sliding, the winners follow.`}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * A horizontal dial of numbers: flick it and the browser's own momentum does the work; it reads
 * its value back from scrollLeft. Every tick is also a button, so a tap, a mouse or a screen reader
 * works too. Programmatic scrolls are fenced off (`settling`) so they aren't read back as a flick.
 */
function ScoreRail({ value, onChange, onAccent }: { value: number; onChange: (v: number) => void; onAccent: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const settling = useRef(false);
  const lastSent = useRef(value);
  // A mouse drag only takes over once it's moved a few px: capturing on pointerdown would steal
  // the click from the tick under it, so tapping a number with a mouse did nothing.
  const drag = useRef<{ id: number; x: number; from: number; moving: boolean } | null>(null);
  const commit = (v: number) => { if (v === lastSent.current) return; lastSent.current = v; navigator.vibrate?.(8); onChange(v); };
  const nearest = () => { const el = ref.current; return el ? Math.max(0, Math.min(RAIL_MAX, Math.round(el.scrollLeft / RAIL_TICK))) : value; };
  const scrollTo = (v: number, smooth: boolean) => {
    const el = ref.current;
    if (!el) return;
    settling.current = true;
    lastSent.current = v;
    el.scrollTo({ left: v * RAIL_TICK, behavior: smooth && !reduce ? "smooth" : "auto" });
    window.setTimeout(() => { settling.current = false; }, smooth && !reduce ? 380 : 60);
  };
  // A deliberate pick tells the parent first, then animates there.
  const pick = (v: number) => { if (v !== value) onChange(v); scrollTo(v, true); };
  useEffect(() => { if (value !== lastSent.current) scrollTo(value, true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value]);
  useIsoLayoutEffect(() => { scrollTo(value, false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    e.preventDefault();
    drag.current = { id: e.pointerId, x: e.clientX, from: ref.current.scrollLeft, moving: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !ref.current) return;
    if (!d.moving) {
      if (Math.abs(e.clientX - d.x) < 5) return;
      d.moving = true;
      ref.current.setPointerCapture(e.pointerId);
    }
    ref.current.scrollLeft = d.from - (e.clientX - d.x);
    commit(nearest());
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => { const d = drag.current; if (!d || d.id !== e.pointerId) return; drag.current = null; if (d.moving) pick(nearest()); };
  return (
    <div className="relative w-full min-w-0">
      <div className={`absolute left-1/2 top-[-2px] z-[2] h-1.5 w-0.5 -translate-x-1/2 rounded ${onAccent ? "bg-ink" : "bg-accent"}`} />
      <div
        ref={ref} onScroll={() => { if (!settling.current) commit(nearest()); }} onTouchStart={() => { settling.current = false; }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        className="spk-rail spk-noselect flex w-full min-w-0 cursor-grab overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory", touchAction: "pan-x", padding: `6px calc(50% - ${RAIL_TICK / 2}px)`, maskImage: "linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)" }}
      >
        {Array.from({ length: RAIL_MAX + 1 }, (_, n) => {
          const on = n === value;
          return (
            <button key={n} type="button" onClick={() => pick(n)} aria-label={`Set ${n}`}
              className="h-10 shrink-0 font-mono transition-[color,font-size] duration-150"
              style={{ flex: `0 0 ${RAIL_TICK}px`, scrollSnapAlign: "center", fontSize: on ? 20 : 15, fontWeight: on ? 800 : 600, color: on ? (onAccent ? "#0c0e10" : "#F4F5F6") : onAccent ? "rgba(12,14,16,.35)" : "#4A5056" }}>
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
