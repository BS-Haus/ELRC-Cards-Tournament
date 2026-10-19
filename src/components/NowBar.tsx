"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { myNow, type NowFeed } from "@/app/actions";
import { pingMoments } from "@/components/LevelMoments";

// The "now" bar: a slim strip above the bottom nav, on every screen, saying where you are at
// today's tournament: on now (lime: go), next up, how many games before yours, your games done
// while the stage plays out, or waiting for the next draw. Tap it to go to your net. Nothing
// when there's no tournament on or you're not in it.

const POLL_MS = 8000;

export function NowBar() {
  const [now, setNow] = useState<NowFeed | null>(null);
  const path = usePathname();
  const router = useRouter();
  const ref = useRef<HTMLButtonElement>(null);
  const check = useCallback(async () => { if (!document.hidden) setNow(await myNow().catch(() => null)); }, []);

  useEffect(() => {
    check();
    const t = setInterval(check, POLL_MS);
    const soon = () => setTimeout(check, 900); // a score just saved, or a draw story watched
    const vis = () => { if (!document.hidden) check(); };
    window.addEventListener("cards:result", soon);
    window.addEventListener("cards:drawseen", soon);
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); window.removeEventListener("cards:result", soon); window.removeEventListener("cards:drawseen", soon); document.removeEventListener("visibilitychange", vis); };
  }, [check, path]);

  // The page leaves room for the bar while it's up (the layout's bottom padding reads --now-h).
  useLayoutEffect(() => {
    const h = now ? (ref.current?.offsetHeight ?? 0) + 8 : 0;
    document.documentElement.style.setProperty("--now-h", `${h}px`);
  }, [now]);

  if (!now) return null;
  const s = now.state;
  const name = (id: string) => now.names[id] ?? "Someone";
  const on = s.kind === "game" && s.ahead === 0;
  const go = () => {
    if (s.kind === "veiled") pingMoments();
    else router.push(s.kind === "game" ? `/e/${now.eventId}?net=${s.net}` : `/e/${now.eventId}`);
  };
  const [head, sub] =
    s.kind === "veiled" ? [`The ${s.final ? "finals are" : "groups are"} drawn`, "Watch the draw to see where you are"]
    : s.kind === "game" ? [
        `${on ? "You're on" : s.ahead === 1 ? "You're next" : `${s.ahead} games before yours`} · Net ${s.net}`,
        `With ${name(s.partner)} vs ${s.opponents.map(name).join(" & ")}${s.sub ? " (subbing)" : ""}`,
      ]
    : s.kind === "waiting" ? ["Your games are done for this stage", `About ${s.rounds} more ${s.rounds === 1 ? "game" : "games"} on the nets, then the next stage`]
    : ["This stage is done", "Waiting for the organiser to draw the next one"];

  return (
    <div className="mx-auto max-w-[480px] px-3 pt-2">
      <button
        ref={ref} onClick={go}
        className={`spk-press flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left ${on || s.kind === "veiled" ? "bg-accent text-ink" : "border border-white/[.08] bg-raised text-fg"}`}
      >
        {(on || s.kind === "veiled") && <span className="spk-ping h-2.5 w-2.5 shrink-0 rounded-full bg-ink" aria-hidden="true" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-black">{head}</span>
          <span className={`block truncate text-[12.5px] font-semibold ${on || s.kind === "veiled" ? "opacity-70" : "text-muted"}`}>{sub}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 opacity-60"><path d="M9 18l6-6-6-6" /></svg>
      </button>
    </div>
  );
}
