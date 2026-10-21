"use client";

import Link from "next/link";
import { Avatar, tierColor, fmtDate } from "@/components/ui";
import { StoryReel, CountUp, type Slide } from "@/components/StoryReel";
import { PodiumStand, FinalWinners } from "@/components/Podium";
import type { Story, Tale } from "@/lib/story";
import type { PlayerLite, EventPhoto } from "@/lib/data";
import { finalLabel } from "@/lib/cards";

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
const TALE_BG: Record<Tale["kind"], string> = {
  unbeaten: "from-[#16260c] to-[#0c0e10]", firstTitle: "from-[#2e2408] to-[#0c0e10]", climber: "from-[#0f1a2a] to-[#0c0e10]",
  streak: "from-[#2a1408] to-[#0c0e10]", partnership: "from-[#251626] to-[#0c0e10]", blowout: "from-[#2a1212] to-[#0c0e10]",
  deuce: "from-[#0f2420] to-[#0c0e10]", points: "from-[#1c1a0b] to-[#0c0e10]",
};
const TALE_ICON: Record<Tale["kind"], string> = { unbeaten: "💯", firstTitle: "✨", climber: "🧗", streak: "🔥", partnership: "🤝", blowout: "💥", deuce: "😮‍💨", points: "🎯" };

/** The tournament as a story: the champion first, every final's table, then the day's stories,
 *  records and numbers; it ends on the podium, which is also the image you save. */
export function TournamentStory({ story, names, photos, viewerPlayed, viewer }: { story: Story; names: Record<string, PlayerLite>; photos: EventPhoto[]; viewerPlayed: boolean; viewer: string | null }) {
  const n = (id: string) => names[id]?.name ?? "Someone";
  const both = (ids: string[]) => ids.map(n).join(" & ");
  const slides: Slide[] = [];
  const ev = story.event;
  const champ = story.champion;

  // 0. The cover: the day's first photo, full screen, with the title over it.
  if (photos.length) {
    slides.push({
      key: "cover", bg: "from-[#0c0e10] to-[#0c0e10]", image: photos[0].url,
      body: (
        <div className="mt-[38vh]">
          <div className="text-[13px] font-bold uppercase tracking-[.22em] text-accent">{fmtDate(ev.startsAt, false)} · {story.numbers.players} players</div>
          <div className="mt-2 text-[48px] font-black leading-[1] tracking-[-.02em] drop-shadow-lg">{ev.title}</div>
          <div className="mt-2 text-[17px] text-white/80">{champ ? "Here's how it went." : "The story so far."}</div>
        </div>
      ),
    });
  }

  // 1. The hero: who won.
  slides.push(champ ? {
    key: "hero", bg: "from-[#3a2c06] via-[#1a1505] to-[#0c0e10]", confetti: true,
    body: (
      <div className="flex flex-col items-center text-center">
        <div className="text-[13px] font-bold uppercase tracking-[.22em] text-gold">{ev.title} · {fmtDate(ev.startsAt, false)}</div>
        <div className="relative mt-7">
          <div className="rounded-full p-1.5" style={{ background: "conic-gradient(#FFCF5C, #fff3c4, #FFCF5C, #b8860b, #FFCF5C)" }}>
            <div className="rounded-full bg-[#0c0e10] p-1"><Avatar p={names[champ.id]} size={148} /></div>
          </div>
          <span className="spk-crown absolute -top-7 left-1/2 -translate-x-1/2 text-[44px]" aria-hidden="true">👑</span>
        </div>
        <div className="mt-6 text-[14px] font-black uppercase tracking-[.3em] text-gold">Champion</div>
        <div className="mt-1 text-[46px] font-black leading-[1.02] tracking-[-.02em]">{n(champ.id)}</div>
        <div className="tnum mt-3 text-[17px] text-white/70">
          {champ.line.w}–{champ.line.l} on the day · {champ.titles === 1 ? "first title" : `${ordinal(champ.titles)} title`}
        </div>
      </div>
    ),
  } : {
    key: "hero", bg: "from-[#1b2410] to-[#0c0e10]",
    body: (
      <div className="grid gap-3">
        <div className="text-[13px] font-bold uppercase tracking-[.2em] text-accent">{fmtDate(ev.startsAt, false)}</div>
        <div className="text-[44px] font-black leading-[1.02]">{ev.title}</div>
        <div className="text-[19px] text-white/70">{ev.done ? "The story of the day." : "The story so far. No champion yet."}</div>
      </div>
    ),
  });

  // 2. The tables: one slide per final (or per group, before finals), in finishing order, the
  //    winner's row lit in the final's colour. The podium is kept for the end and the saved image.
  for (const p of story.podium) {
    if (!p.table.length) continue;
    const c = tierColor(p.name.replace(/^Group /, ""));
    const isFinal = !p.name.startsWith("Group ");
    slides.push({
      key: `table-${p.name}`, bg: "from-[#141a1f] to-[#0c0e10]",
      body: (
        <div className="grid gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[12px] font-bold uppercase tracking-[.2em] text-white/45">{isFinal ? "Final table" : "Group table"}</div>
              <div className="mt-1 text-[40px] font-black leading-none tracking-[-.02em]" style={{ color: c }}>{isFinal ? `${finalLabel(p.name)} final` : p.name}</div>
            </div>
            <div className="flex gap-4 pb-1 text-[11px] font-bold uppercase tracking-[.12em] text-white/40"><span className="w-10 text-right">W–L</span><span className="w-9 text-right">+/−</span></div>
          </div>
          <div className="grid gap-1.5">
            {p.table.map((r, i) => {
              const top = i === 0 && p.winner === r.id;
              return (
                <div key={r.id} className="spk-up flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ animationDelay: `${150 + i * 110}ms`, background: top ? `${c}22` : "rgba(255,255,255,.04)", border: `1px solid ${top ? `${c}66` : "transparent"}` }}>
                  <span className="tnum w-5 shrink-0 text-center text-[16px] font-black" style={{ color: top ? c : "rgba(255,255,255,.45)" }}>{i + 1}</span>
                  <Avatar p={names[r.id]} size={top ? 40 : 34} />
                  <span className={`min-w-0 flex-1 truncate font-black ${top ? "text-[19px]" : "text-[16px]"}`}>{n(r.id)}{top && <span aria-hidden="true"> 🏆</span>}</span>
                  <span className="tnum w-10 shrink-0 text-right font-mono text-[15px] font-bold">{r.w}–{r.l}</span>
                  <span className={`tnum w-9 shrink-0 text-right text-[14px] font-bold ${r.diff > 0 ? "text-win" : r.diff < 0 ? "text-loss" : "text-white/50"}`}>{r.diff > 0 ? "+" : ""}{r.diff}</span>
                </div>
              );
            })}
          </div>
          {p.tied.length > 0 && !p.winner && <div className="text-[14px] font-bold text-white/60">Level at the top: {both(p.tied)}</div>}
        </div>
      ),
    });
  }

  // 3. One slide per story: the stat big, who it's about, one line of why.
  for (const t of story.stories) {
    slides.push({
      key: `tale-${t.kind}`, bg: TALE_BG[t.kind],
      body: (
        <div className="grid gap-4">
          <div className="text-[13px] font-bold uppercase tracking-[.2em] text-white/55"><span aria-hidden="true">{TALE_ICON[t.kind]}</span> {t.title}</div>
          <div className="tnum text-[64px] font-black leading-none tracking-[-.03em] text-accent">{t.stat}</div>
          <div className="mt-2 flex flex-wrap gap-3">
            {t.ids.map((id) => (
              <div key={id} className="flex items-center gap-2.5"><Avatar p={names[id]} size={t.ids.length > 2 ? 34 : 48} /><span className={`${t.ids.length > 2 ? "text-[16px]" : "text-[22px]"} font-black`}>{n(id)}</span></div>
            ))}
          </div>
          <div className="text-[17px] text-white/70">{t.detail}</div>
        </div>
      ),
    });
  }

  // 4. Records broken: today against every earlier weekend.
  if (story.records.length) {
    slides.push({
      key: "records", bg: "from-[#1a0f2e] to-[#0c0e10]", confetti: true,
      body: (
        <div className="grid gap-4">
          <div className="text-[13px] font-bold uppercase tracking-[.2em] text-[#C084FC]">📈 Records broken</div>
          {story.records.map((r) => (
            <div key={r.kind} className="rounded-2xl border border-[#C084FC]/30 bg-[#C084FC]/10 p-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12px] font-bold uppercase tracking-[.12em] text-white/55">{r.label}</span>
                <span className="tnum shrink-0 text-[20px] font-black text-[#E9D5FF]">{r.value}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-[14px]">
                <span className="truncate font-bold">{both(r.ids)}</span>
                <span className="shrink-0 text-white/45">{r.previous ? `was ${r.previous}` : "first ever"}</span>
              </div>
            </div>
          ))}
        </div>
      ),
    });
  }

  // 4b. More photos, if the day has them.
  if (photos.length > 1) {
    slides.push({
      key: "photos", bg: "from-[#0c0e10] to-[#0c0e10]",
      body: (
        <div className="grid gap-3">
          <div className="text-[13px] font-bold uppercase tracking-[.2em] text-white/55">📸 From the day</div>
          <div className="grid grid-cols-2 gap-2">
            {photos.slice(1, 7).map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt="" className={`w-full rounded-xl object-cover ${i === 0 && photos.length > 3 ? "col-span-2 aspect-[16/10]" : "aspect-square"}`} />
            ))}
          </div>
        </div>
      ),
    });
  }

  // 5. The day in numbers.
  const num = story.numbers;
  slides.push({
    key: "numbers", bg: "from-[#10202a] to-[#0c0e10]",
    body: (
      <div className="grid gap-5">
        <div className="text-[13px] font-bold uppercase tracking-[.2em] text-white/55">The day in numbers</div>
        <div className="grid grid-cols-2 gap-3">
          {([[num.players, "players"], [num.games, "games"], [num.points, "points scored"], [num.deuces, num.deuces === 1 ? "deuce" : "deuces"]] as const).map(([v, l]) => (
            <div key={l} className="rounded-2xl bg-white/[.06] p-4">
              <div className="tnum text-[44px] font-black leading-none"><CountUp to={v} /></div>
              <div className="mt-1.5 text-[12px] font-bold uppercase tracking-[.12em] text-white/50">{l}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  });

  return (
    <StoryReel
      slides={slides}
      label="Tournament story"
      backHref={`/e/${ev.id}`}
      imageUrl={`/e/${ev.id}/recap/image`}
      shareUrl={`/e/${ev.id}/recap`}
      title={`${ev.title} story`}
      endTitle={champ ? `${n(champ.id)} takes it.` : "That's the story so far."}
      endNote={viewerPlayed ? "Now watch your own day: your games, your points, your rank." : "Save the card or send it to the group."}
      endVisual={story.podium[0]?.winner ? (
        <div className="grid gap-3">
          <div className="text-center text-[12px] font-bold uppercase tracking-[.2em] text-gold">{ev.title} · Gold final</div>
          <PodiumStand first={names[story.podium[0].winner]} second={story.podium[0].runnerUp ? names[story.podium[0].runnerUp] : undefined} third={story.podium[0].third ? names[story.podium[0].third] : undefined} />
          {story.podium.length > 1 && <FinalWinners finals={story.podium.slice(1).map((p) => ({ name: p.name, winner: p.winner ? names[p.winner] : undefined, tied: p.tied.length ? `Tied: ${both(p.tied)}` : undefined }))} />}
        </div>
      ) : undefined}
      endExtra={viewerPlayed && viewer ? (
        <Link href={`/e/${ev.id}/recap?p=${viewer}`} className="spk-press flex h-14 items-center justify-center rounded-2xl border-2 border-accent text-[16px] font-black text-accent">▶ Watch your review</Link>
      ) : undefined}
    />
  );
}
