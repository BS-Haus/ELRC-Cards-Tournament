"use client";

import Link from "next/link";
import { Avatar, tierColor, fmtDate } from "@/components/ui";
import { StoryReel, CountUp, type Slide } from "@/components/StoryReel";
import type { Story, Tale } from "@/lib/story";
import type { PlayerLite } from "@/lib/data";

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
const TALE_BG: Record<Tale["kind"], string> = {
  unbeaten: "from-[#16260c] to-[#0c0e10]", firstTitle: "from-[#2e2408] to-[#0c0e10]", climber: "from-[#0f1a2a] to-[#0c0e10]",
  streak: "from-[#2a1408] to-[#0c0e10]", partnership: "from-[#251626] to-[#0c0e10]", blowout: "from-[#2a1212] to-[#0c0e10]",
  deuce: "from-[#0f2420] to-[#0c0e10]", points: "from-[#1c1a0b] to-[#0c0e10]",
};
const TALE_ICON: Record<Tale["kind"], string> = { unbeaten: "💯", firstTitle: "✨", climber: "🧗", streak: "🔥", partnership: "🤝", blowout: "💥", deuce: "😮‍💨", points: "🎯" };

/** The tournament as a story: the champion first, then the day's stories, its records and its numbers. */
export function TournamentStory({ story, names, viewerPlayed, viewer }: { story: Story; names: Record<string, PlayerLite>; viewerPlayed: boolean; viewer: string | null }) {
  const n = (id: string) => names[id]?.name ?? "Someone";
  const both = (ids: string[]) => ids.map(n).join(" & ");
  const slides: Slide[] = [];
  const ev = story.event;
  const champ = story.champion;

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
          {champ.line.w}–{champ.line.l} on the day · {champ.titles === 1 ? "first Gold title" : `${ordinal(champ.titles)} Gold title`}
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

  // 2. The podium: every final's winner and runner-up.
  if (story.podium.length) {
    slides.push({
      key: "podium", bg: "from-[#2e2408] to-[#0c0e10]",
      body: (
        <div className="grid gap-3">
          <div className="text-[13px] font-bold uppercase tracking-[.2em] text-gold">The finals</div>
          {story.podium.map((p) => {
            const c = tierColor(p.name);
            return (
              <div key={p.name} className="rounded-2xl p-4" style={{ background: `${c}18`, border: `1px solid ${c}45` }}>
                <div className="text-[12px] font-black uppercase tracking-[.16em]" style={{ color: c }}>{p.name}</div>
                {p.winner ? (
                  <div className="mt-2 grid gap-2">
                    <div className="flex items-center gap-3"><span className="w-6 text-center text-[20px]">🏆</span><Avatar p={names[p.winner]} size={38} /><span className="text-[21px] font-black">{n(p.winner)}</span></div>
                    {p.runnerUp && <div className="flex items-center gap-3 text-white/70"><span className="w-6 text-center text-[15px] font-black">2</span><Avatar p={names[p.runnerUp]} size={28} /><span className="text-[16px] font-bold">{n(p.runnerUp)}</span></div>}
                  </div>
                ) : <div className="mt-1 text-[18px] font-bold">{p.tied.length ? `Tied: ${both(p.tied)}` : "Still playing"}</div>}
              </div>
            );
          })}
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
      endExtra={viewerPlayed && viewer ? (
        <Link href={`/e/${ev.id}/recap?p=${viewer}`} className="spk-press flex h-14 items-center justify-center rounded-2xl border-2 border-accent text-[16px] font-black text-accent">▶ Watch your review</Link>
      ) : undefined}
    />
  );
}
