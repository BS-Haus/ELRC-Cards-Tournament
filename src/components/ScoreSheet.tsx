"use client";

import { pingMoments } from "@/components/LevelMoments";
import { useState } from "react";
import Link from "next/link";
import { enterScore, clearScore, setSkipped, subIn } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { Avatar, btnPrimary, btnGhost, btnQuiet } from "@/components/ui";
import { isDone, gameLabel, type Game } from "@/lib/cards";
import { ScoreEntry, scoresOf, type Pick } from "@/components/ScoreEntry";
import type { PlayerLite } from "@/lib/data";

/**
 * Tap the team that won, then slide the losers' score: the winners' score follows from the game
 * length (win by two), the ranked app's way (ScoreEntry). Also where subs and skips are sorted.
 */
export function ScoreSheet({ game, people, to, canScore, org, candidates, out, onClose }: {
  game: Game; people: Record<string, PlayerLite>; to: number; canScore: boolean; org: boolean;
  candidates: string[]; out: Set<string>; onClose: () => void;
}) {
  const { run, pending, toast } = useAction();
  const done = isDone(game);
  const [pick, setPick] = useState<Pick>(done ? { winner: game.scoreA! > game.scoreB! ? "a" : "b", loser: Math.min(game.scoreA!, game.scoreB!) } : { winner: null, loser: 0 });
  const [subFor, setSubFor] = useState<string | null>(null);
  const [subAll, setSubAll] = useState(true);
  const name = (id: string) => people[id]?.name ?? "?";
  const team = (ids: string[]) => ids.map(name).join(" & ");
  const sc = scoresOf(pick, to);
  const [scoreA, scoreB] = sc ?? [null, null];
  const label = gameLabel(game);
  const save = () => {
    if (scoreA == null || scoreB == null) return;
    run(() => enterScore(game.id, scoreA, scoreB), "Score saved", (r) => { if (r.ok) { onClose(); pingMoments(); } });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={onClose}>
      {toast}
      <div role="dialog" aria-label={`${label}, game ${game.seq}`} className="spk-sheet mx-auto max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl border-t border-white/[.08] bg-surface p-5 pb-[calc(20px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <div className="flex items-baseline justify-between">
          <div className="text-[12px] font-bold uppercase tracking-[.12em] text-accent">{label} · game {game.seq}</div>
          <div className="text-[12px] text-dim">to {to}, win by 2</div>
        </div>

        {game.status === "void" ? (
          <div className="mt-4 grid gap-3">
            <p className="text-[15px]">This game was skipped.</p>
            <button disabled={pending} onClick={() => run(() => setSkipped(game.id, false), "Game is back on", (r) => r.ok && onClose())} className={btnGhost}>Put it back on</button>
          </div>
        ) : !canScore ? (
          <div className="mt-4 grid gap-3">
            <p className="text-[15px] font-bold">{team(game.a)} vs {team(game.b)}</p>
            <p className="text-[14px] text-muted">Sign in to enter scores. It takes ten seconds: your name and a 4-digit code.</p>
            <Link href="/me" className={btnPrimary}>Sign in or join</Link>
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-[18px] border border-white/[.06] bg-panel p-4">
              <ScoreEntry a={game.a} b={game.b} people={people} to={to} value={pick} onChange={setPick} />
            </div>

            <button disabled={pending || scoreA == null} onClick={save} className={`${btnPrimary} mt-5 h-14 w-full text-[16px]`}>
              {sc == null ? "Tap the winning team" : `Save ${sc[0]}–${sc[1]}`}
            </button>

            {done && org && <button disabled={pending} onClick={() => run(() => clearScore(game.id), "Score cleared", (r) => r.ok && onClose())} className={`${btnQuiet} mt-2 w-full`}>Clear this score</button>}

            {game.status === "todo" && (
              <div className="mt-5 border-t border-white/[.06] pt-4">
                <div className="text-[15px] font-extrabold">Someone can&apos;t play?</div>
                <p className="mt-1 text-[13px] text-muted">Swap in a sub. It counts in everyone's rating, sub included, but the sub isn't added to this group's table.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[...game.a, ...game.b].map((id) => (
                    <button key={id} onClick={() => setSubFor(subFor === id ? null : id)} aria-pressed={subFor === id} className={`spk-press rounded-full px-3 py-1.5 text-[13.5px] font-bold ${subFor === id ? "bg-loss text-ink" : out.has(id) ? "border border-loss/50 text-loss" : "border border-white/[.08] bg-raised"}`}>
                      {name(id)}{out.has(id) ? " (left)" : ""}
                    </button>
                  ))}
                </div>
                {subFor && (
                  <div className="mt-3">
                    <div className="text-[13px] font-semibold text-muted">Who&apos;s going on for {name(subFor)}?</div>
                    {out.has(subFor) && (
                      <label className="mt-2 flex items-center gap-2 text-[13px] text-muted">
                        <input type="checkbox" checked={subAll} onChange={(e) => setSubAll(e.target.checked)} className="h-4 w-4 accent-[#cbfb4f]" />
                        Also for {name(subFor)}&apos;s other games left in this stage
                      </label>
                    )}
                    {candidates.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {candidates.map((id) => (
                          <button key={id} disabled={pending} onClick={() => run(() => subIn(game.id, subFor, id, out.has(subFor) && subAll), `${name(id)} is subbing in`, (r) => r.ok && onClose())} className="spk-press inline-flex items-center gap-2 rounded-full border border-white/[.08] bg-raised py-1 pl-1 pr-3 text-[13.5px] font-semibold">
                            <Avatar p={people[id]} size={24} />{name(id)}
                          </button>
                        ))}
                      </div>
                    ) : <p className="mt-2 text-[13px] text-dim">Nobody else is checked in right now.</p>}
                  </div>
                )}
                <button disabled={pending} onClick={() => run(() => setSkipped(game.id, true), "Game skipped", (r) => r.ok && onClose())} className={`${btnQuiet} mt-3 px-0`}>Skip this game instead</button>
              </div>
            )}
          </>
        )}
        <button onClick={onClose} className={`${btnGhost} mt-4 w-full`}>Close</button>
      </div>
    </div>
  );
}
