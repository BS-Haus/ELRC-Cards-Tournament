"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, card, tierColor } from "@/components/ui";
import { MySeason, ShowAll } from "@/components/MySeason";
import type { Profile, Season } from "@/lib/data";

const RECENT = 6;

/** Everything about one player, the same for you on Me and for anyone you tap in Players: at a
 *  glance, highlights three across, and their latest games (six, the rest a tap away). */
export function PlayerBody({ season, pr }: { season: Season; pr: Pick<Profile, "tierWins" | "bestPartner" | "recent" | "names"> }) {
  const [allGames, setAllGames] = useState(false);
  const { names } = pr;
  const titles = Object.entries(pr.tierWins).sort(([x], [y]) => x.localeCompare(y));
  const bp = pr.bestPartner;
  return (
    <>
      <MySeason s={season} />

      {(titles.length > 0 || bp) && (
        <section className="px-4 pb-6">
          <h2 className="mb-2.5 px-1 text-[12px] font-bold uppercase tracking-[.12em] text-muted">Highlights</h2>
          <div className="grid grid-cols-3 gap-2">
            {titles.map(([t, n]) => (
              <div key={t} className="flex flex-col items-center gap-1 rounded-2xl p-3 text-center" style={{ background: `${tierColor(t)}14`, border: `1px solid ${tierColor(t)}40` }}>
                <span className="text-[20px] leading-none" style={{ color: tierColor(t) }} aria-hidden="true">★</span>
                <span className="tnum text-[18px] font-black leading-none">×{n}</span>
                <span className="text-[11px] font-bold leading-tight text-muted">{t === "A" ? "Champion" : `${t} final won`}</span>
              </div>
            ))}
            {bp && (
              <Link href={`/p/${bp.id}`} className={`${card} spk-press flex flex-col items-center gap-1 p-3 text-center`}>
                <Avatar p={names[bp.id]} size={26} />
                <span className="w-full truncate text-[13.5px] font-black leading-tight">{names[bp.id]?.name}</span>
                <span className="text-[11px] font-bold leading-tight text-muted">Best partner · {bp.w}/{bp.gp}</span>
              </Link>
            )}
          </div>
        </section>
      )}

      {pr.recent.length > 0 && (
        <section className="px-4 pb-6">
          <h2 className="mb-2.5 px-1 text-[12px] font-bold uppercase tracking-[.12em] text-muted">Recent games</h2>
          <div className={`${card} overflow-hidden`}>
            {(allGames ? pr.recent : pr.recent.slice(0, RECENT)).map((g) => (
              <div key={g.id} className="flex items-center gap-3 border-b border-white/[.04] px-4 py-2.5 last:border-0">
                <span className={`w-6 shrink-0 text-center text-[12px] font-black ${g.won ? "text-win" : "text-loss"}`}>{g.won ? "W" : "L"}</span>
                <div className="min-w-0 flex-1 text-[13.5px]">
                  <div className="truncate">with <b>{names[g.partner]?.name}</b> vs {g.opponents.map((o) => names[o]?.name).join(" & ")}</div>
                  <div className="truncate text-[12px] text-dim">{g.label} · {g.eventTitle}{g.sub ? " · as a sub, not counted" : ""}</div>
                </div>
                <span className="tnum shrink-0 font-mono text-[13.5px] font-bold">{g.mine}–{g.theirs}</span>
              </div>
            ))}
            {pr.recent.length > RECENT && <ShowAll open={allGames} n={pr.recent.length - RECENT} what={pr.recent.length - RECENT === 1 ? "game" : "games"} onClick={() => setAllGames(!allGames)} />}
          </div>
        </section>
      )}
    </>
  );
}
