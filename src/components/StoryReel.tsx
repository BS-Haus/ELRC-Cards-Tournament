"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// The story-reel shell both recaps share: full screen, a progress bar per slide, tap the right to
// move on and the left to go back, hold to pause, an end screen to save or share. Slides are
// props in; what they say is the tournament story's or the personal review's business.

const SLIDE_MS = 6000;

/** Counts a number up from 0 when its slide appears. */
export function CountUp({ to, digits = 0, prefix = "" }: { to: number; digits?: number; prefix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(to); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setV(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{prefix}{v.toFixed(digits)}</>;
}

export function Confetti() {
  const colors = ["#CBFB4F", "#FFCF5C", "#5EEAD4", "#F9A8D4", "#93C5FD"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <span key={i} className="spk-confetti absolute top-[-12px] h-3 w-1.5 rounded-sm"
          style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 9) * 0.12}s`, animationDuration: `${2.2 + (i % 5) * 0.3}s` }} />
      ))}
    </div>
  );
}

/** `image`: a photo filling the screen behind the slide, darkened so the words read over it. */
export type Slide = { key: string; bg: string; body: React.ReactNode; confetti?: boolean; image?: string };

/** `endVisual`: what the saved image shows, drawn above the end screen's buttons. */
export function StoryReel({ slides, label, backHref, imageUrl, shareUrl, title, endTitle, endNote, endExtra, endVisual }: {
  slides: Slide[]; label: string; backHref: string; imageUrl: string; shareUrl: string; title: string;
  endTitle: string; endNote: string; endExtra?: React.ReactNode; endVisual?: React.ReactNode;
}) {
  const router = useRouter();
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const done = at >= slides.length;
  const go = useCallback((i: number) => { setAt(Math.max(0, Math.min(slides.length, i))); setElapsed(0); }, [slides.length]);

  // Advance on a timer, paused while held.
  useEffect(() => {
    if (paused || done) return;
    const t0 = performance.now() - elapsed;
    let raf = 0;
    const tick = (t: number) => {
      const e = t - t0;
      if (e >= SLIDE_MS) { go(at + 1); return; }
      setElapsed(e);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, paused, done]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") go(at + 1);
      if (e.key === "ArrowLeft") go(at - 1);
      if (e.key === "Escape") router.push(backHref);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [at, go, router, backHref]);

  const down = useRef(0);
  const onDown = () => { down.current = performance.now(); setPaused(true); };
  const onUp = (e: React.PointerEvent) => {
    setPaused(false);
    if (performance.now() - down.current > 300) return; // a hold, not a tap
    const x = e.clientX / (e.currentTarget as HTMLElement).clientWidth;
    go(x < 0.33 ? at - 1 : at + 1);
  };

  const save = async () => {
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], `${title.replace(/[^\w]+/g, "-").toLowerCase()}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title }); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch { window.open(imageUrl, "_blank"); }
  };
  const share = async () => {
    const url = `${location.origin}${shareUrl}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else await navigator.clipboard.writeText(url);
    } catch {}
  };

  const s = slides[Math.min(at, slides.length - 1)];
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col bg-[#0c0e10] text-fg">
      <div className={`absolute inset-0 bg-gradient-to-b ${done ? "from-[#1b2410] to-[#0c0e10]" : s.bg}`} />
      {!done && s.image && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={s.key} src={s.image} alt="" className="spk-fade absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e10] via-[#0c0e10]/35 to-[#0c0e10]/70" />
        </>
      )}
      {!done && s.confetti && <Confetti key={s.key} />}
      <div className="relative z-10 flex gap-1 px-3 pt-[calc(10px+env(safe-area-inset-top))]">
        {slides.map((x, i) => (
          <div key={x.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-white" style={{ width: i < at ? "100%" : i === at ? `${(elapsed / SLIDE_MS) * 100}%` : "0%" }} />
          </div>
        ))}
      </div>
      <div className="relative z-10 flex items-center justify-between px-4 pt-3">
        <span className="text-[12px] font-bold uppercase tracking-[.16em] text-white/50">{label}</span>
        <button onClick={() => router.push(backHref)} className="spk-press -mr-2 p-2 text-white/70" aria-label="Close">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {done ? (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto px-7 pb-[calc(32px+env(safe-area-inset-bottom))]">
          {endVisual && <div className="spk-up mb-3">{endVisual}</div>}
          <div className="text-[34px] font-black leading-tight">{endTitle}</div>
          <p className="mb-4 text-[16px] text-white/60">{endNote}</p>
          {endExtra}
          <button onClick={save} className="spk-press h-14 rounded-2xl bg-accent text-[16px] font-black text-ink">Save as image</button>
          <button onClick={share} className="spk-press h-14 rounded-2xl border border-white/15 bg-white/5 text-[16px] font-bold">Share link</button>
          <button onClick={() => go(0)} className="spk-press h-12 text-[15px] font-bold text-white/60">Watch again</button>
        </div>
      ) : (
        <div
          className="spk-noselect relative z-10 flex flex-1 touch-manipulation select-none items-center px-7 pb-[calc(40px+env(safe-area-inset-bottom))]"
          onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => setPaused(false)} onContextMenu={(e) => e.preventDefault()}
        >
          <div key={s.key} className="spk-up w-full">{s.body}</div>
        </div>
      )}
    </div>
  );
}
