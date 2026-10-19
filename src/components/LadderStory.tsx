"use client";

import { Avatar, fmtDate } from "@/components/ui";
import { StoryReel, CountUp, type Slide } from "@/components/StoryReel";
import { PROV_N } from "@/lib/standings";
import type { LadderStoryData } from "@/lib/netLadder";
import type { PlayerLite } from "@/lib/data";

// A ladder day, played back once it's over: one story, a few slides. The day for everyone (who
// earned the most, who ruled the top net, the biggest upset), then your own day if you played.

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;

export function LadderStory({ event, story: s, names, viewer }: { event: { id: string; title: string; startsAt: number }; story: LadderStoryData; names: Record<string, PlayerLite>; viewer: string | null }) {
  const n = (id: string) => names[id]?.name ?? "Someone";
  const both = (ids: string[]) => ids.map(n).join(" & ");
  const slides: Slide[] = [];

  slides.push({
    key: "cover", bg: "from-[#1b2410] to-[#0c0e10]",
    body: (
      <div className="grid gap-3">
        <div className="text-[13px] font-bold uppercase tracking-[.22em] text-accent">{fmtDate(event.startsAt, false)}</div>
        <div className="text-[46px] font-black leading-[1.02] tracking-[-.02em]">{event.title}</div>
        <div className="tnum mt-2 grid grid-cols-3 gap-2">
          {([[s.players, "players"], [s.rounds, "rounds"], [s.games, "games"]] as const).map(([v, l]) => (
            <div key={l} className="rounded-2xl bg-white/[.06] p-3">
              <div className="text-[34px] font-black leading-none"><CountUp to={v} /></div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-[.12em] text-white/50">{l}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  });

  if (s.earners.length) {
    slides.push({
      key: "earners", bg: "from-[#16260f] to-[#0c0e10]", confetti: true,
      body: (
        <div className="grid gap-4">
          <div className="text-[13px] font-bold uppercase tracking-[.2em] text-accent">Biggest climbers</div>
          {s.earners.map((e, i) => (
            <div key={e.id} className={`flex items-center gap-3.5 rounded-2xl p-3.5 ${i === 0 ? "bg-accent/15" : "bg-white/[.05]"}`}>
              <span className={`w-6 text-center font-mono text-[18px] font-black ${i === 0 ? "text-accent" : "text-white/50"}`}>{i + 1}</span>
              <Avatar p={names[e.id]} size={i === 0 ? 48 : 38} />
              <span className={`min-w-0 flex-1 truncate font-black ${i === 0 ? "text-[22px]" : "text-[18px]"}`}>{n(e.id)}</span>
              <span className={`tnum font-mono font-black ${i === 0 ? "text-[26px]" : "text-[20px]"} ${e.today >= 0 ? "text-accent" : "text-white/70"}`}>{signed(e.today)}</span>
            </div>
          ))}
          <div className="text-[14px] text-white/55">Rating gained on the day.</div>
        </div>
      ),
    });
  }

  if (s.king || s.upset) {
    slides.push({
      key: "moments", bg: "from-[#2a2208] to-[#0c0e10]",
      body: (
        <div className="grid gap-5">
          {s.king && (
            <div>
              <div className="text-[13px] font-bold uppercase tracking-[.2em] text-gold">👑 King of the top net</div>
              <div className="mt-3 flex items-center gap-3"><Avatar p={names[s.king.id]} size={52} /><span className="text-[30px] font-black leading-tight">{n(s.king.id)}</span></div>
              <div className="mt-1.5 text-[15px] text-white/65">{s.king.topWins} {s.king.topWins === 1 ? "win" : "wins"} on Net 1.</div>
            </div>
          )}
          {s.upset && (
            <div className="rounded-2xl bg-white/[.06] p-4">
              <div className="text-[12px] font-black uppercase tracking-[.16em] text-gold">Upset of the day</div>
              <div className="mt-2 text-[20px] font-black leading-snug">{both(s.upset.winners)} beat {both(s.upset.losers)}</div>
              <div className="tnum mt-1 text-[14px] text-white/60">{s.upset.score[0]}–{s.upset.score[1]} on Net {s.upset.net}, with a {Math.round(s.upset.chance * 100)}% chance going in.</div>
            </div>
          )}
        </div>
      ),
    });
  }

  const me = s.me;
  if (me) {
    slides.push({
      key: "you", bg: "from-[#10202a] to-[#0c0e10]",
      body: (
        <div className="grid gap-5">
          <div className="flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-[.2em] text-accent"><Avatar p={names[me.id]} size={26} />Your day</div>
          <div className="flex items-end gap-5">
            <div className="tnum text-[68px] font-black leading-none tracking-[-.04em]"><CountUp to={me.w} /><span className="text-white/30">–</span><CountUp to={me.l} /></div>
            {me.today != null
              ? <div className={`tnum pb-2 text-[30px] font-black ${me.today >= 0 ? "text-accent" : "text-white/70"}`}>{signed(me.today)}</div>
              : <div className="pb-3 text-[15px] font-bold text-white/60">🐣 Still placing ({PROV_N} games)</div>}
          </div>
          <div className="grid gap-2 text-[16px]">
            {me.bestNet != null && <div className="rounded-xl bg-white/[.06] px-4 py-3">Highest net: <b>Net {me.bestNet}</b>{me.topRounds > 0 ? `, ${me.topRounds} ${me.topRounds === 1 ? "round" : "rounds"} on top` : ""}</div>}
            {me.partner && <div className="rounded-xl bg-white/[.06] px-4 py-3">Best partner: <b>{n(me.partner.id)}</b>, {me.partner.w} from {me.partner.gp}</div>}
          </div>
        </div>
      ),
    });
  }

  const top = s.earners[0];
  return (
    <StoryReel
      slides={slides}
      label="The day"
      backHref={`/e/${event.id}`}
      imageUrl={`/e/${event.id}/recap/image`}
      shareUrl={`/e/${event.id}/recap`}
      title={`${event.title} story`}
      endTitle={me ? "That's your day." : "That's the day."}
      endNote={viewer && !me ? "Play next time and you'll get your own part of the story." : "Save the card or send it to the group."}
      endVisual={top ? (
        <div className="flex items-center gap-3 rounded-2xl bg-accent/15 p-4">
          <Avatar p={names[top.id]} size={44} />
          <div className="min-w-0 flex-1"><div className="text-[11px] font-black uppercase tracking-[.16em] text-accent">Biggest climber</div><div className="truncate text-[20px] font-black">{n(top.id)}</div></div>
          <div className="tnum font-mono text-[24px] font-black text-accent">{signed(top.today)}</div>
        </div>
      ) : undefined}
    />
  );
}
