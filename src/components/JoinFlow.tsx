"use client";

import { useEffect, useState } from "react";
import { whoIs, signIn, signUp } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { Section, card, btnPrimary, input, initial } from "@/components/ui";

type Who = { kind: "back" | "claim" | "new"; name: string };

/** Joining and signing in are one flow: your name, Continue, then your code on a small number pad.
 *  The app works out which it is: someone coming back enters their code, a walk-in an organiser
 *  added on the day picks one to claim their history, and someone new picks one. */
export function JoinFlow({ onDone }: { onDone: () => void }) {
  const { run, pending, toast } = useAction();
  const [name, setName] = useState("");
  const [who, setWho] = useState<Who | null>(null);
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  const look = async () => {
    const r = await whoIs(name);
    if (r.ok) setWho({ kind: r.kind, name: r.name });
    else run(async () => r);
  };

  // The fourth digit sends it: no button to find.
  useEffect(() => {
    if (!who || pin.length !== 4) return;
    run(() => (who.kind === "back" ? signIn(who.name, pin) : signUp(who.name, pin)), who.kind === "back" ? `Welcome back, ${who.name}` : "You're all set", (r) => {
      if (r.ok) onDone();
      else { setShake(true); setTimeout(() => { setShake(false); setPin(""); }, 450); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  if (!who) {
    return (
      <Section title="Join in or sign in">
        {toast}
        <form className={`${card} grid gap-3 p-4`} onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) look(); }}>
          <p className="text-[14px] leading-relaxed text-muted">Your name is your profile. New here or coming back, start the same way.</p>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your name, e.g. Sam K" maxLength={24} aria-label="Your name" autoFocus />
          <button disabled={pending || name.trim().length < 2} className={`${btnPrimary} h-12`}>Continue</button>
        </form>
      </Section>
    );
  }

  const title = who.kind === "back" ? `Welcome back, ${who.name}` : who.kind === "claim" ? `${who.name}, this is you` : `Nice to meet you, ${who.name}`;
  const sub = who.kind === "back" ? "Enter your 4-digit code." : who.kind === "claim" ? "An organiser added you on the day. Pick a 4-digit code and your games are yours." : "Pick a 4-digit code. It's how you'll sign in next time.";
  const press = (d: string) => { if (!pending && pin.length < 4) setPin(pin + d); };
  return (
    <Section title={who.kind === "back" ? "Sign in" : "Pick your code"}>
      {toast}
      <div className={`${card} flex flex-col items-center p-5 text-center`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-raised text-[18px] font-black">{initial(who.name)}</span>
        <div className="mt-3 text-[18px] font-black">{title}</div>
        <p className="mt-1 max-w-[30ch] text-[13.5px] leading-relaxed text-muted">{sub}</p>
        <div className={`mt-4 flex gap-3 ${shake ? "spk-shake" : ""}`} aria-label={`${pin.length} of 4 digits`}>
          {[0, 1, 2, 3].map((i) => <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? "bg-accent" : "bg-white/15"}`} />)}
        </div>
        <div className="spk-noselect mt-4 grid w-full max-w-[264px] grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} type="button" onClick={() => press(d)} className="spk-press h-12 rounded-xl bg-raised text-[20px] font-bold">{d}</button>
          ))}
          <span />
          <button type="button" onClick={() => press("0")} className="spk-press h-12 rounded-xl bg-raised text-[20px] font-bold">0</button>
          <button type="button" onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete" className="spk-press flex h-12 items-center justify-center rounded-xl text-muted">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2ZM18 9l-6 6M12 9l6 6" /></svg>
          </button>
        </div>
        <button type="button" onClick={() => { setWho(null); setPin(""); }} className="spk-press mt-4 text-[13px] font-bold text-muted">← Not {who.name}? Change name</button>
      </div>
    </Section>
  );
}
