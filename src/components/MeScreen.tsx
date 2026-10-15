"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, unlockOrganiser, lockOrganiser } from "@/app/actions";
import { JoinFlow } from "@/components/JoinFlow";
import { useAction } from "@/components/useAction";
import { Header, Section, card, btnPrimary, btnGhost, btnQuiet, input, fmtTime } from "@/components/ui";
import { AvatarPicker } from "@/components/AvatarPicker";
import { CheckIn } from "@/components/CheckIn";
import { PlayerBody } from "@/components/PlayerBody";
import type { Profile, Season } from "@/lib/data";
import { levelFor } from "@/lib/levels";
import type { EntryState, EventPhoto } from "@/lib/data";
import { EventPhotos } from "@/components/EventPhotos";

export function MeScreen({ me, org, orgUntil, next, today, season, profile }: {
  me: { id: string; name: string; color: string; photo: string | null } | null; org: boolean; orgUntil: number | null; next: string | null;
  today: { id: string; title: string; state: EntryState | null; started: boolean; photos: EventPhoto[] } | null; season: Season | null;
  profile: Pick<Profile, "player" | "tierWins" | "bestPartner" | "recent" | "names" | "form" | "trail" | "biggestWin" | "bestRun"> | null;
}) {
  const router = useRouter();
  const { run, pending, toast } = useAction();
  const go = () => { if (next) router.push(next); };

  return (
    <main>
      {toast}
      {me ? (
        <header className="flex flex-col items-center px-5 pt-[calc(22px+env(safe-area-inset-top))] pb-5 text-center">
          <AvatarPicker me={me} rank={season ? levelFor(season.xp).level : undefined} />
          <h1 className="mt-5 text-[26px] font-black leading-tight tracking-[-.02em]">{me.name}</h1>
          <div className="text-[11px] font-bold uppercase tracking-[.14em] text-accent">East London Roundnet</div>
          {next && <Link href={next} className="mt-3 text-[13px] font-bold text-accent">← Back to the event</Link>}
        </header>
      ) : (
        <Header eyebrow="East London Roundnet" title="Join in" />
      )}

      <OrganiserRow org={org} orgUntil={orgUntil} run={run} pending={pending} />

      {!me ? (
        <JoinFlow onDone={go} />
      ) : (
        <>
        {today && (
          <>
            <h2 className="px-5 pb-2.5 text-[12px] font-bold uppercase tracking-[.12em] text-muted">Today</h2>
            <CheckIn me={me.id} state={today.state} eventId={today.id} started={today.started} title={today.title}>
              <EventPhotos bare eventId={today.id} photos={today.photos} me={me.id} org={org} />
            </CheckIn>
          </>
        )}
        {season && profile && <PlayerBody season={season} pr={profile} mine />}
        </>
      )}

      {me && (
        <div className="px-4 pt-2 pb-8">
          <button disabled={pending} onClick={() => run(() => signOut(), "Signed out")} className="spk-press h-14 w-full rounded-2xl border border-loss/40 bg-loss/10 text-[16px] font-black text-loss disabled:opacity-40">Sign out</button>
        </div>
      )}
    </main>
  );
}

/** Organiser tools in one line: locked, a tap opens the code field; unlocked, when it ends and Lock. */
function OrganiserRow({ org, orgUntil, run, pending }: { org: boolean; orgUntil: number | null; run: ReturnType<typeof useAction>["run"]; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  return (
    <div className="px-4 pb-5">
      <div className={`${card} px-4 py-2`}>
        <div className="flex min-h-10 items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[14px] font-bold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={org ? "text-accent" : "text-dim"} aria-hidden="true">
              <rect x="4" y="11" width="16" height="10" rx="2" /><path d={org ? "M8 11V7a4 4 0 0 1 7.8-1.2" : "M8 11V7a4 4 0 0 1 8 0v4"} />
            </svg>
            Organiser tools
            {org && <span className="text-[12.5px] font-semibold text-muted">on until {fmtTime(orgUntil!)}</span>}
          </span>
          {org
            ? <button disabled={pending} onClick={() => run(() => lockOrganiser(), "Locked")} className="spk-press text-[13px] font-bold text-muted">Lock</button>
            : <button onClick={() => setOpen(!open)} className="spk-press text-[13px] font-bold text-accent">{open ? "Cancel" : "Unlock"}</button>}
        </div>
        {!org && open && (
          <form className="flex gap-2 pt-1 pb-2" onSubmit={(e) => { e.preventDefault(); run(() => unlockOrganiser(code), "Organiser tools unlocked", (r) => { if (r.ok) { setCode(""); setOpen(false); } }); }}>
            <input className={input} type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Organiser code" aria-label="Organiser code" autoComplete="off" autoFocus />
            <button disabled={pending || !code} className={`${btnPrimary} shrink-0`}>Go</button>
          </form>
        )}
      </div>
    </div>
  );
}
