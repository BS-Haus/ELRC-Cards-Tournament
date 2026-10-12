"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { addEventPhoto, deleteEventPhoto } from "@/app/actions";
import { useAction } from "@/components/useAction";
import { card } from "@/components/ui";
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
export function EventPhotos({ eventId, photos, me, org, bare = false }: { eventId: string; photos: EventPhoto[]; me: string | null; org: boolean; bare?: boolean }) {
  // `bare`: just the row, for sitting inside another card (Me's Today card).
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
  const at = open ? photos.findIndex((p) => p.id === open.id) : -1;
  const step = (d: number) => photos.length && setOpen(photos[(at + d + photos.length) % photos.length]);
  return (
    <div className={bare ? "" : "px-4 pb-5"}>
      {toast}
      {/* One compact row: a little stack of the photos (tap to browse), and Add. */}
      <div className={`${bare ? "" : `${card} p-3`} flex items-center gap-3.5`}>
        <button onClick={() => photos.length && setOpen(photos[0])} disabled={!photos.length} className="spk-press relative h-14 w-16 shrink-0" aria-label={photos.length ? `Browse ${photos.length} photos` : "No photos yet"}>
          {photos.length ? photos.slice(0, 3).reverse().map((p, i, arr) => {
            const depth = arr.length - 1 - i; // 0 = top of the stack
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt="" className="absolute inset-0 h-14 w-14 rounded-lg border-2 border-surface object-cover shadow-md"
                style={{ transform: `translateX(${depth * 5}px) rotate(${[-2, 6, -8][depth]}deg)`, zIndex: 3 - depth }} />
            );
          }) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-white/20 text-muted" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
            </span>
          )}
        </button>
        <button onClick={() => photos.length && setOpen(photos[0])} disabled={!photos.length} className="min-w-0 flex-1 text-left">
          <div className="text-[14.5px] font-extrabold">Photos from the day</div>
          <div className="truncate text-[12.5px] text-muted">{photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"} · tap to browse` : "The first one becomes the story's cover"}</div>
        </button>
        {me ? (
          <button onClick={() => file.current?.click()} disabled={pending || busy} className="spk-press shrink-0 rounded-full bg-accent px-3.5 py-2 text-[13px] font-black text-ink">{busy ? "Adding…" : "+ Add"}</button>
        ) : (
          <Link href={`/me?next=/e/${eventId}`} className="shrink-0 text-[12.5px] font-bold text-accent">Sign in to add</Link>
        )}
      </div>
      <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between p-3 pt-[calc(12px+env(safe-area-inset-top))] text-white/80">
            <span className="tnum px-2 text-[13px] font-bold">{at + 1} / {photos.length}{at === 0 ? " · cover" : ""}</span>
            <button className="p-2" aria-label="Close"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
          </div>
          <div className="relative flex flex-1 items-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={open.id} src={open.url} alt="" className="spk-up mx-auto max-h-[74dvh] w-full max-w-[480px] object-contain" />
            {photos.length > 1 && (
              <>
                <button onClick={() => step(-1)} className="absolute inset-y-0 left-0 w-1/3" aria-label="Previous photo" />
                <button onClick={() => step(1)} className="absolute inset-y-0 right-0 w-1/3" aria-label="Next photo" />
              </>
            )}
          </div>
          {(org || (me && open.by === me)) && (
            <div className="mx-auto mb-[calc(16px+env(safe-area-inset-bottom))] w-full max-w-[480px] px-4" onClick={(e) => e.stopPropagation()}>
              <button disabled={pending} onClick={() => run(() => deleteEventPhoto(open.id), "Photo removed", (r) => r.ok && setOpen(null))} className="w-full py-3 text-[14px] font-bold text-loss">Remove this photo</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
