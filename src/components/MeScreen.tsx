"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp, signIn, signOut, unlockOrganiser, lockOrganiser } from "@/app/actions";
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
  profile: Pick<Profile, "tierWins" | "bestPartner" | "recent" | "names"> | null;
}) {
  const router = useRouter();
  const { run, pending, toast } = useAction();
  const [mode, setMode] = useState<"join" | "in">("join");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const go = () => { if (next) router.push(next); };

  return (
    <main>
      {toast}
      {me ? (
        <header className="flex flex-col items-center px-5 pt-[calc(22px+env(safe-area-inset-top))] pb-5 text-center">
          <AvatarPicker me={me} rank={season ? levelFor(season.points).level : undefined} />
          <h1 className="mt-5 text-[26px] font-black leading-tight tracking-[-.02em]">{me.name}</h1>
          <div className="text-[11px] font-bold uppercase tracking-[.14em] text-accent">East London Roundnet</div>
          {next && <Link href={next} className="mt-3 text-[13px] font-bold text-accent">← Back to the event</Link>}
        </header>
      ) : (
        <Header eyebrow="East London Roundnet" title="Join in" />
      )}

      <OrganiserRow org={org} orgUntil={orgUntil} run={run} pending={pending} />

      {!me ? (
        <Section title={mode === "join" ? "Make a profile" : "Sign in"}>
          <form
            className={`${card} grid gap-3 p-4`}
            onSubmit={(e) => {
              e.preventDefault();
              run(() => (mode === "join" ? signUp(name, pin) : signIn(name, pin)), mode === "join" ? "Welcome! You're all set" : "Signed in", (r) => r.ok && go());
            }}
          >
            <p className="text-[14px] leading-relaxed text-muted">
              {mode === "join"
                ? "No email, no password rules. Your name and a 4-digit code you'll remember, so your games and stats follow you from week to week."
                : "Your name and the 4-digit code you picked when you joined."}
            </p>
            <label className="grid gap-1 text-[12.5px] font-semibold text-muted">
              Your name
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="e.g. Sam K" maxLength={24} required />
            </label>
            <label className="grid gap-1 text-[12.5px] font-semibold text-muted">
              {mode === "join" ? "Pick a 4-digit code" : "Your 4-digit code"}
              <input className={`${input} tnum font-mono tracking-[.5em]`} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" autoComplete={mode === "join" ? "new-password" : "current-password"} placeholder="••••" required />
            </label>
            <button disabled={pending || name.trim().length < 2 || pin.length !== 4} className={`${btnPrimary} h-12`}>{pending ? "…" : mode === "join" ? "Join" : "Sign in"}</button>
            <button type="button" onClick={() => setMode(mode === "join" ? "in" : "join")} className={btnQuiet}>
              {mode === "join" ? "Already joined? Sign in" : "New here? Make a profile"}
            </button>
            {mode === "join" && <p className="text-[12.5px] text-dim">If an organiser added you on the day, join with the same name and your games carry over.</p>}
          </form>
        </Section>
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
        {season && profile && <PlayerBody season={season} pr={profile} />}
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
