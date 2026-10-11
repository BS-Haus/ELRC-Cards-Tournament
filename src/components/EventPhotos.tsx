"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { addEventPhoto, deleteEventPhoto } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { Section, card } from "@/components/ui";
import type { EventPhoto } from "@/lib/data";

const MAX_SIDE = 1440;

/** Shrink a photo on the phone (longest side 1440px, JPEG) so only a few hundred KB is sent. */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  for (const q of [0.82, 0.72, 0.6, 0.5]) {
    const url = c.toDataURL("image/jpeg", q);
    if (url.length < 440_000) return url;
  }
  throw new Error("too big");
}

/** Photos from the day: a strip anyone can add to; the first one leads the tournament story. */
export function EventPhotos({ eventId, photos, me, org }: { eventId: string; photos: EventPhoto[]; me: string | null; org: boolean }) {
  const { run, pending, toast } = useAction();
  const file = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<EventPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    for (const f of Array.from(files).slice(0, 6)) {
      try {
        const url = await shrink(f);
        await new Promise<void>((done) => run(() => addEventPhoto(eventId, url), files.length > 1 ? undefined : "Photo added", () => done()));
      } catch { run(async () => ({ ok: false, error: "That photo couldn't be read. Try another." })); }
    }
    setBusy(false);
  };

  if (!photos.length && !me) return null;
  return (
    <Section title="Photos from the day" aside={photos.length ? `${photos.length}` : undefined}>
      {toast}
      <div className="grid grid-cols-3 gap-1.5">
        {photos.map((p, i) => (
          <button key={p.id} onClick={() => setOpen(p)} className={`spk-press relative overflow-hidden rounded-xl bg-raised ${i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`} aria-label="Open photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            {i === 0 && <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-bold text-white">Cover</span>}
          </button>
        ))}
        {me ? (
          <button onClick={() => file.current?.click()} disabled={pending || busy} className={`spk-press flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/20 text-muted ${photos.length ? "" : "col-span-3 aspect-auto py-6"}`}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
            <span className="text-[12px] font-bold">{busy ? "Adding…" : photos.length ? "Add" : "Add a photo from today"}</span>
          </button>
        ) : null}
      </div>
      {!photos.length && me && <p className="mt-2 px-1 text-[12.5px] text-dim">The first photo becomes the cover of the tournament story and the card people share.</p>}
      {!me && photos.length > 0 && <p className="mt-2 px-1 text-[12.5px] text-dim"><Link href={`/me?next=/e/${eventId}`} className="font-bold text-accent">Sign in</Link> to add yours.</p>}
      <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={() => setOpen(null)}>
          <div className="flex justify-end p-3 pt-[calc(12px+env(safe-area-inset-top))]">
            <button className="p-2 text-white/80" aria-label="Close"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open.url} alt="" className="mx-auto max-h-[78dvh] w-full max-w-[480px] object-contain" />
          {(org || (me && open.by === me)) && (
            <div className="mx-auto mt-4 w-full max-w-[480px] px-4" onClick={(e) => e.stopPropagation()}>
              <button disabled={pending} onClick={() => run(() => deleteEventPhoto(open.id), "Photo removed", (r) => r.ok && setOpen(null))} className={`${card} w-full py-3 text-[14px] font-bold text-loss`}>Remove this photo</button>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
