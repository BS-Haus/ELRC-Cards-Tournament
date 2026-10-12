"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp, signIn, signOut, unlockOrganiser, lockOrganiser } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { Header, Section, card, btnPrimary, btnGhost, btnQuiet, input, fmtTime } from "@/components/ui";
import { AvatarPicker } from "@/components/AvatarPicker";
import { CheckIn } from "@/components/CheckIn";
import type { EntryState } from "@/lib/data";

export function MeScreen({ me, org, orgUntil, next, today }: {
  me: { id: string; name: string; color: string; photo: string | null } | null; org: boolean; orgUntil: number | null; next: string | null;
  today: { id: string; title: string; state: EntryState | null; started: boolean } | null;
}) {
  const router = useRouter();
  const { run, pending, toast } = useAction();
  const [mode, setMode] = useState<"join" | "in">("join");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const go = () => { if (next) router.push(next); };

  return (
    <main>
      {toast}
      <Header eyebrow="East London Roundnet" title={me ? `Hi, ${me.name}` : "Join in"} />
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
            <CheckIn me={me.id} state={today.state} eventId={today.id} started={today.started} title={today.title} />
          </>
        )}
        <Section title="Your profile">
          <div className={`${card} grid gap-2 p-4`}>
            <div className="pb-2"><AvatarPicker me={me} /></div>
            <Link href={`/p/${me.id}`} className={btnPrimary}>See my stats and history</Link>
            {next && <Link href={next} className={btnGhost}>Back to the event</Link>}
            <button disabled={pending} onClick={() => run(() => signOut(), "Signed out")} className={btnQuiet}>Sign out</button>
          </div>
        </Section>
        </>
      )}

      <Section title="Organisers">
        <div className={`${card} grid gap-3 p-4`}>
          {org ? (
            <>
              <p className="text-[14px] text-muted">Organiser tools are unlocked on this phone until {fmtTime(orgUntil!)}. You&apos;ll see them on the Tournament tab and on each event.</p>
              <button disabled={pending} onClick={() => run(() => lockOrganiser(), "Locked")} className={btnGhost}>Lock organiser tools</button>
            </>
          ) : (
            <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); run(() => unlockOrganiser(code), "Organiser tools unlocked", (r) => r.ok && setCode("")); }}>
              <p className="text-[14px] text-muted">Running a session? Enter the organiser code to post events, check people in and draw groups.</p>
              <input className={input} type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Organiser code" aria-label="Organiser code" autoComplete="off" />
              <button disabled={pending || !code} className={btnGhost}>Unlock</button>
            </form>
          )}
        </div>
      </Section>
    </main>
  );
}
