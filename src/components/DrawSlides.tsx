"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CountUp, Confetti } from "@/components/StoryReel";
import { Avatar, tierColor } from "@/components/ui";
import type { DrawFeed, PlayerLite } from "@/lib/data";
import type { DrawGroup } from "@/lib/drawStory";

// The slides of a draw story (src/lib/drawStory.ts). A round is a draw, so it's the shuffle and the
// deal: the groups dealt out like cards, then your group and net. The finals aren't random, so they
// feel different: your points from the day, then each final revealed, Bronze up to Gold, then yours.
// No recap of the tables: everyone watched those happen.

/** One slide: what's on it, its background, whether it throws confetti, and how long it stays. */
export type StorySlide = { key: string; bg: string; body: React.ReactNode; party?: boolean; ms?: number };
const SLIDE_MS = 4500;

/** The draw story's player: full screen, a bar per slide, tap right for next and left for back,
 *  hold to pause; the last slide waits for "Let's play". Same feel as the level moments. */
export function DrawReel({ feed, onClose }: { feed: DrawFeed; onClose: () => void }) {
  const slides = drawSlides(feed);
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const last = at === slides.length - 1;
  const ms = slides[at]?.ms ?? SLIDE_MS;
  const go = useCallback((i: number) => { if (i >= slides.length) return; setAt(Math.max(0, i)); setElapsed(0); }, [slides.length]);

  useEffect(() => {
    if (paused || last) return;
    const t0 = performance.now() - elapsed;
    let raf = 0;
    const tick = (t: number) => {
      const e = t - t0;
      if (e >= ms) { go(at + 1); return; }
      setElapsed(e);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, paused, last]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") (last ? onClose() : go(at + 1));
      if (e.key === "ArrowLeft") go(at - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [at, last, go, onClose]);

  const down = useRef(0);
  const onDown = () => { down.current = performance.now(); setPaused(true); };
  const onUp = (e: React.PointerEvent) => {
    setPaused(false);
    if (performance.now() - down.current > 300) return;
    const x = e.clientX / (e.currentTarget as HTMLElement).clientWidth;
    if (x < 0.33) go(at - 1); else if (!last) go(at + 1);
  };

  const s = slides[at];
  return (
    <div role="dialog" aria-modal="true" aria-label={feed.story.eventTitle} className="fixed inset-0 z-[60] mx-auto flex max-w-[480px] flex-col bg-[#0c0e10] text-fg">
      <div className={`absolute inset-0 bg-gradient-to-b ${s.bg}`} />
      {s.party && <Confetti key={s.key} />}
      <div className="relative z-10 flex gap-1 px-3 pt-[calc(10px+env(safe-area-inset-top))]">
        {slides.map((x, i) => (
          <div key={x.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-white" style={{ width: i < at ? "100%" : i === at ? (last ? "100%" : `${(elapsed / ms) * 100}%`) : "0%" }} />
          </div>
        ))}
      </div>
      <div className="relative z-10 flex items-center justify-between px-4 pt-3">
        <span className="flex min-w-0 items-center gap-2 text-[12px] font-bold uppercase tracking-[.16em] text-white/50"><Avatar p={feed.me} size={20} /><span className="truncate">{feed.story.eventTitle}</span></span>
        <button onClick={onClose} className="spk-press -mr-2 p-2 text-white/70" aria-label="Close">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <div
        className="spk-noselect relative z-10 flex min-h-0 flex-1 touch-manipulation select-none items-center overflow-y-auto px-6"
        onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => setPaused(false)} onContextMenu={(e) => e.preventDefault()}
      >
        <div key={s.key} className="spk-up w-full py-4">{s.body}</div>
      </div>
      <div className="relative z-10 px-7 pb-[calc(28px+env(safe-area-inset-bottom))]">
        {last
          ? <button onClick={onClose} className="spk-press h-14 w-full rounded-2xl bg-accent text-[16px] font-black text-ink">Let&apos;s play</button>
          : <p className="text-center text-[12.5px] text-white/40">Tap to continue</p>}
      </div>
    </div>
  );
}

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
// Labels read "Gold final"; the colours are keyed by the stored letter (A = Gold).
const FINAL_CODE: Record<string, string> = { Gold: "A", Silver: "B", Bronze: "C", Copper: "D" };
const finalTint = (label: string) => (label.endsWith(" final") ? tierColor(FINAL_CODE[label.split(" ")[0]] ?? label.split(" ")[0]) : "#CBFB4F");

export function drawSlides(d: DrawFeed): StorySlide[] {
  const { story: s, names, me } = d;
  const p = (id: string): PlayerLite | undefined => names[id];
  const name = (id: string) => (id === me.id ? "You" : p(id)?.name ?? "Someone");
  const slides: StorySlide[] = [];

  const title = s.kind === "final" ? "Finals time" : s.kind === "seeded" ? `Round ${s.stageNo}` : "The draw is in";
  const sub = s.kind === "final" ? "Everyone plays a final at their level."
    : s.kind === "seeded" ? "Regrouped by level, so every game is a close one."
    : "Random groups. New partner every game.";
  slides.push({
    key: "intro", bg: s.kind === "final" ? "from-[#2a2410] to-[#0c0e10]" : "from-[#1b2410] to-[#0c0e10]",
    body: (
      <div className="grid gap-5">
        <div className="spk-crown text-[84px] leading-none">{s.kind === "final" ? "🏆" : "🃏"}</div>
        <div className="text-[42px] font-black leading-[1.02] tracking-[-.02em]">{title}</div>
        <p className="text-[18px] font-semibold text-white/70">{sub}</p>
        <div className="flex flex-wrap gap-2 text-[14px] font-bold">
          {[`${s.players} players`, `${s.groups.length} ${s.kind === "final" ? (s.groups.length === 1 ? "final" : "finals") : s.groups.length === 1 ? "group" : "groups"}`, `${s.nets} ${s.nets === 1 ? "net" : "nets"}`].map((x) => (
            <span key={x} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">{x}</span>
          ))}
        </div>
      </div>
    ),
  });

  if (s.kind === "final") {
    if (s.day) {
      const d = s.day;
      slides.push({
        key: "day", bg: "from-[#2a2410] to-[#0c0e10]",
        body: (
          <div className="grid gap-6">
            <div className="text-[13px] font-bold uppercase tracking-[.2em] text-gold">Your day</div>
            <div>
              <div className={`tnum text-[84px] font-black leading-none tracking-[-.03em] ${d.points >= 0 ? "text-win" : "text-white/70"}`}>{d.points >= 0 ? "+" : "−"}<CountUp to={Math.abs(d.points)} /></div>
              <div className="mt-2 text-[17px] font-semibold text-white/60">points from both rounds</div>
            </div>
            <div className="text-[30px] font-black leading-tight">{d.rank === 1 ? "Top of the day" : `${ordinal(d.rank)} of ${d.of}`}</div>
            <p className="text-[15px] leading-snug text-white/55">The finals are seeded on points. Top four to Gold.</p>
          </div>
        ),
      });
    }
    // Bronze first, Gold last.
    for (const g of [...s.groups].reverse()) {
      const gold = g.tier === 0;
      slides.push({ key: `final-${g.tier}`, bg: gold ? "from-[#3a2e0c] to-[#0c0e10]" : "from-[#1c1f24] to-[#0c0e10]", party: gold, ms: 4800, body: <FinalReveal g={g} p={p} me={me.id} /> });
    }
  } else {
    slides.push({ key: "shuffle", bg: "from-[#101a24] to-[#0c0e10]", ms: 4200, body: <Shuffle n={s.players} /> });
    slides.push({ key: "deal", bg: "from-[#0f2420] to-[#0c0e10]", ms: 4200 + s.players * 160, body: <Deal groups={s.groups} p={p} me={me.id} final={false} /> });
  }

  if (s.mine) {
    const m = s.mine;
    const tint = finalTint(m.label);
    slides.push({
      key: "mine", bg: "from-[#24300f] to-[#0c0e10]", party: false,
      body: (
        <div className="grid gap-6">
          <div className="text-[13px] font-bold uppercase tracking-[.2em] text-white/55">You&apos;re in</div>
          <div>
            <div className="text-[46px] font-black leading-none tracking-[-.02em]" style={{ color: tint }}>{m.label}</div>
            <div className="mt-2 text-[20px] font-bold text-white/70">Net {m.net}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {m.mates.map((id) => (
              <span key={id} className="inline-flex items-center gap-2 rounded-full bg-white/8 py-1 pl-1 pr-3 text-[15px] font-semibold"><Avatar p={p(id)} size={28} />{name(id)}</span>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[12px] font-bold uppercase tracking-[.16em] text-accent">{m.ahead === 0 ? "You're on first" : `Game ${m.ahead + 1} on Net ${m.net}`}</div>
            <div className="mt-1.5 text-[17px] font-bold">You &amp; {name(m.partner)} <span className="font-semibold text-white/50">vs</span> {name(m.opponents[0])} &amp; {name(m.opponents[1])}</div>
            {m.ahead > 0 && <div className="mt-1 text-[13.5px] text-white/55">{m.ahead === 1 ? "One game" : `${m.ahead} games`} before yours. Grab some water 💧</div>}
          </div>
        </div>
      ),
    });
  }

  const send = s.kind === "final"
    ? (s.mine?.label.startsWith("Gold") ? "The big one. Leave it all on the net 🔥" : "Your final, your trophy. Go get it 💪")
    : s.kind === "seeded" ? "Everyone in your group is at your level. Every point counts." : "New partners, new chances. Have fun out there 🍀";
  slides.push({
    key: "go", bg: "from-[#1b2410] to-[#0c0e10]",
    body: (
      <div className="grid gap-4">
        <div className="text-[44px] font-black leading-[1.02] tracking-[-.02em]">Let&apos;s go</div>
        <p className="text-[19px] font-semibold leading-snug text-white/75">{send}</p>
        {s.mine && <p className="text-[15px] text-white/50">{s.mine.label} · Net {s.mine.net}</p>}
      </div>
    ),
  });
  return slides;
}

/** The back of a card: the club's lime on near-black, a net in the middle. */
export function CardBack({ w = 56, h = 78 }: { w?: number; h?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center overflow-hidden rounded-[10px] border-[1.5px] border-accent/50 bg-[#15181b] shadow-[0_6px_14px_-6px_rgba(0,0,0,.7)]"
      style={{ width: w, height: h, backgroundImage: "repeating-linear-gradient(45deg, rgba(203,251,79,.10) 0 3px, transparent 3px 7px)" }}>
      <span className="grid place-items-center rounded-full border-2 border-accent bg-[#0c0e10]" style={{ width: w * 0.46, height: w * 0.46 }}>
        <span className="rounded-full bg-accent" style={{ width: w * 0.12, height: w * 0.12 }} />
      </span>
    </span>
  );
}

const SHUFFLE_TIMES = [0, 0.16, 0.34, 0.52, 0.66, 0.84, 1];

/** The build-up: a card for every player, face down, fanned, split and riffled together twice,
 *  then squared up, ready to deal. */
export function Shuffle({ n, final = false, compact = false }: { n: number; final?: boolean; compact?: boolean }) {
  const reduce = useReducedMotion();
  const count = Math.max(4, Math.min(n, 20));
  const w = compact ? 34 : 64, h = compact ? 47 : 90;
  const spread = compact ? 70 : 130;
  // Memoised: the reel re-renders every frame for its progress bar, and fresh keyframe arrays
  // each render would restart the animation from the top, so it never got past the first frame.
  const cards = useMemo(() => Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1) - 0.5; // -0.5 … 0.5
    const left = i % 2 === 0;
    const half = (left ? -1 : 1) * spread * 0.55;
    const fanX = t * spread * 2, fanR = t * 70, fanY = Math.abs(t) * 30;
    // fan → split into two halves → riffle in → split again → riffle → square up
    return {
      x: [0, fanX, half, 0, half * 0.8, 0, 0],
      y: [0, fanY, -i * 0.6, -i * 0.8, -i * 0.6, -i * 0.8, -i * 0.5],
      rotate: [0, fanR, left ? -8 : 8, (i % 3) - 1, left ? -6 : 6, (i % 3) - 1, 0],
      delay: (left ? 0 : 0.04) + (i % 5) * 0.012,
    };
  }), [count, spread]);
  return (
    <div className={`grid justify-items-center ${compact ? "gap-3" : "gap-8"}`}>
      {!compact && <div className="text-[13px] font-bold uppercase tracking-[.2em] text-accent">{final ? "Shuffling for the finals" : "Shuffling the deck"}</div>}
      <div className="relative" style={{ width: w, height: h + (compact ? 6 : 14), perspective: 800 }} aria-hidden="true">
        {cards.map((c, i) => (
          <motion.span key={i} className="absolute left-0 top-0" style={{ zIndex: i }}
            initial={{ x: 0, y: -i * 0.5, rotate: 0 }}
            animate={reduce ? { x: 0, y: -i * 0.5 } : { x: c.x, y: c.y, rotate: c.rotate }}
            transition={reduce ? { duration: 0 } : { duration: compact ? 2.6 : 3.8, times: SHUFFLE_TIMES, ease: "easeInOut", delay: c.delay, repeat: compact ? Infinity : 0, repeatDelay: 0.6 }}>
            <CardBack w={w} h={h} />
          </motion.span>
        ))}
      </div>
      {!compact && (
        <div className="grid justify-items-center gap-1 text-center">
          <div className="tnum text-[54px] font-black leading-none tracking-[-.03em]"><CountUp to={n} /></div>
          <div className="text-[15px] font-bold text-white/60">players in the deck</div>
        </div>
      )}
    </div>
  );
}

/** The groups dealt out like cards: each player's card flies off the deck into their group, face
 *  down, then flips over to show who it is. Yours lands last in its group and glows. */
function Deal({ groups, p, me, final }: { groups: DrawGroup[]; p: (id: string) => PlayerLite | undefined; me: string; final: boolean }) {
  const reduce = useReducedMotion();
  // One group per row, full width, so the cards can be a decent size (four across a phone).
  const many = groups.length > 4;
  const w = many ? 46 : 62, h = many ? 64 : 84;
  // Deal round-robin, a card to each group in turn, like a real deal.
  const order: string[] = [];
  const most = Math.max(...groups.map((g) => g.members.length));
  for (let r = 0; r < most; r++) for (const g of groups) if (g.members[r]) order.push(g.members[r]);
  const at = new Map(order.map((id, i) => [id, i]));
  const step = 0.16;
  return (
    <div className="grid gap-4">
      <div className="text-[13px] font-bold uppercase tracking-[.2em] text-accent">{final ? "Dealing the finals" : "Dealing the groups"}</div>
      <div className="grid gap-3">
        {groups.map((g) => {
          const tint = finalTint(g.label);
          return (
            <div key={g.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2.5 flex items-center justify-between text-[14px] font-black"><span style={{ color: tint }}>{g.label}</span><span className="text-[12px] font-bold text-white/45">Net {g.net}</span></div>
              <div className="flex flex-wrap gap-2" style={{ perspective: 600 }}>
                {g.members.map((id) => {
                  const d = 0.2 + at.get(id)! * step;
                  const mine = id === me;
                  return (
                    <motion.span key={id} className="relative block" style={{ width: w, height: h + 16 }}
                      initial={reduce ? false : { x: -60, y: -220, rotate: -25, opacity: 0 }}
                      animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 22, delay: d }}>
                      <motion.span className="relative block" style={{ width: w, height: h, transformStyle: "preserve-3d" }}
                        initial={reduce ? false : { rotateY: 180 }} animate={{ rotateY: 0 }}
                        transition={{ duration: 0.45, ease: "easeOut", delay: d + 0.35 + (mine ? 0.5 : 0) }}>
                        {/* face */}
                        <span className={`absolute inset-0 grid place-items-center content-center gap-1 rounded-[10px] border-[1.5px] px-0.5 text-center ${mine ? "border-accent bg-accent text-ink shadow-[0_0_24px_rgba(203,251,79,.55)]" : "border-white/15 bg-[#1b1f23]"}`} style={{ backfaceVisibility: "hidden" }}>
                          <Avatar p={p(id)} size={many ? 24 : 32} />
                          <span className="w-full truncate text-[11.5px] font-extrabold leading-tight">{mine ? "You" : p(id)?.name}</span>
                        </span>
                        {/* back */}
                        <span className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}><CardBack w={w} h={h} /></span>
                      </motion.span>
                    </motion.span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One final, revealed: its name in its colour, its net, and its players as big cards flipping in
 *  one by one, best seed first. Yours glows. */
function FinalReveal({ g, p, me }: { g: DrawGroup; p: (id: string) => PlayerLite | undefined; me: string }) {
  const reduce = useReducedMotion();
  const tint = finalTint(g.label);
  const has = g.members.includes(me);
  return (
    <div className="grid gap-6">
      <div>
        <div className="text-[13px] font-bold uppercase tracking-[.2em] text-white/50">{has ? "You're in the" : "Net " + g.net}</div>
        <div className="mt-1 text-[48px] font-black leading-none tracking-[-.02em]" style={{ color: tint }}>{g.label}</div>
        {has && <div className="mt-2 text-[17px] font-bold text-white/60">Net {g.net}</div>}
      </div>
      <div className="grid grid-cols-2 gap-3" style={{ perspective: 800 }}>
        {g.members.map((id, i) => {
          const mine = id === me;
          return (
            <motion.div key={id} className="relative h-[132px]" style={{ transformStyle: "preserve-3d" }}
              initial={reduce ? false : { rotateY: 180, y: 24, opacity: 0 }} animate={{ rotateY: 0, y: 0, opacity: 1 }}
              transition={{ duration: 0.55, ease: "easeOut", delay: 0.3 + i * 0.32 }}>
              <div className={`absolute inset-0 grid place-items-center content-center gap-2 rounded-2xl border-2 p-2 text-center ${mine ? "bg-accent text-ink shadow-[0_0_32px_rgba(203,251,79,.5)]" : "bg-[#1b1f23]"}`}
                style={{ backfaceVisibility: "hidden", borderColor: mine ? "#CBFB4F" : `${tint}88` }}>
                <Avatar p={p(id)} size={52} />
                <span className="w-full truncate text-[15px] font-black">{mine ? "You" : p(id)?.name}</span>
              </div>
              <div className="absolute inset-0 grid place-items-center" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}><CardBack w={92} h={128} /></div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
