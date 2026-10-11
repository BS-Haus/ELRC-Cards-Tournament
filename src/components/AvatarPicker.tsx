"use client";

import { useRef } from "react";
import { setAvatar } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { Avatar, btnGhost, btnQuiet } from "@/components/ui";

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

export function AvatarPicker({ me }: { me: { name: string; color: string; photo: string | null } }) {
  const { run, pending, toast } = useAction();
  const file = useRef<HTMLInputElement>(null);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    let url: string;
    try { url = await shrink(f); } catch { run(async () => ({ ok: false, error: "That photo couldn't be read. Try another." })); return; }
    run(() => setAvatar(url), "Looking good");
  };
  return (
    <div className="flex items-center gap-4">
      {toast}
      <button type="button" onClick={() => file.current?.click()} className="spk-press relative shrink-0 rounded-full" aria-label={me.photo ? "Change your photo" : "Add a photo"}>
        <Avatar p={me} size={72} />
        <span className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-accent text-ink" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
        </span>
      </button>
      <div className="grid gap-1.5">
        <button type="button" disabled={pending} onClick={() => file.current?.click()} className={`${btnGhost} min-h-10`}>{pending ? "Saving…" : me.photo ? "Change photo" : "Add a photo"}</button>
        {me.photo && <button type="button" disabled={pending} onClick={() => run(() => setAvatar(null), "Photo removed")} className={`${btnQuiet} min-h-8 px-0 text-[13px]`}>Remove photo</button>}
      </div>
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
