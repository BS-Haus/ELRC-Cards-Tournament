"use client";

import { useRef, useState } from "react";
import { setAvatar } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { RankAvatar } from "@/components/ui";

const SIZE = 320;

/** Square-crop and shrink a photo on the phone, so only a small JPEG ever leaves it. */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bmp.close();
  for (const q of [0.82, 0.7, 0.55]) {
    const url = c.toDataURL("image/jpeg", q);
    if (url.length < 110_000) return url;
  }
  throw new Error("too big");
}

/** Your photo, big: tap it to add one, or (once you have one) to change or remove it. No buttons
 *  on the page; the choices only appear when you ask for them. With `rank` it wears the rank ring
 *  and division banner (RankAvatar), as your profile does for everyone else. */
export function AvatarPicker({ me, size = 104, rank, tag }: { me: { name: string; color: string; photo: string | null }; size?: number; rank?: { name: string; icon: string; color: string; level?: number }; tag?: string }) {
  const { run, pending, toast } = useAction();
  const file = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const choose = () => { setMenu(false); file.current?.click(); };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    let url: string;
    try { url = await shrink(f); } catch { run(async () => ({ ok: false, error: "That photo couldn't be read. Try another." })); return; }
    run(() => setAvatar(url), "Looking good");
  };
  return (
    <>
      {toast}
      <button type="button" disabled={pending} onClick={() => (me.photo ? setMenu(true) : choose())} className="spk-press relative rounded-full disabled:opacity-60" aria-label={me.photo ? "Change or remove your photo" : "Add a photo"}>
        <RankAvatar p={me} size={size} rank={rank} tag={tag} />
        <span className="absolute top-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-bg bg-accent text-ink" aria-hidden="true">
          {me.photo
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
        </span>
      </button>
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      {menu && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => setMenu(false)}>
          <div role="dialog" aria-label="Your photo" className="spk-sheet mx-auto grid w-full max-w-[480px] gap-2 rounded-t-3xl border-t border-white/[.08] bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15" />
            <button type="button" onClick={choose} className="spk-press rounded-2xl bg-raised py-3.5 text-[16px] font-bold">Change photo</button>
            <button type="button" onClick={() => { setMenu(false); run(() => setAvatar(null), "Photo removed"); }} className="spk-press rounded-2xl bg-raised py-3.5 text-[16px] font-bold text-loss">Remove photo</button>
            <button type="button" onClick={() => setMenu(false)} className="spk-press rounded-2xl py-3.5 text-[16px] font-bold text-muted">Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
