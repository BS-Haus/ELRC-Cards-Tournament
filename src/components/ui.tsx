import Link from "next/link";
import type { PlayerLite } from "@/lib/data";

export const initial = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

/** `ring`: a border in that colour, so overlapping avatars read as separate faces (the ranked
 *  app's pairs in a result card). */
export function Avatar({ p, size = 32, dim = false, ring }: { p?: Pick<PlayerLite, "name" | "color"> & { photo?: string | null }; size?: number; dim?: boolean; ring?: string }) {
  const edge = ring ? `0 0 0 2px ${ring}` : undefined;
  if (p?.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.photo} alt="" aria-hidden="true" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size, opacity: dim ? 0.45 : 1, background: p.color, boxShadow: edge }} />;
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-ink"
      style={{ width: size, height: size, background: p?.color ?? "#5A6168", fontSize: Math.round(size * 0.42), opacity: dim ? 0.45 : 1, boxShadow: edge }}
    >
      {initial(p?.name ?? "?")}
    </span>
  );
}

export function PlayerLink({ p, className = "" }: { p?: PlayerLite; className?: string }) {
  if (!p) return <span className={className}>Someone</span>;
  return <Link href={`/p/${p.id}`} className={`hover:underline ${className}`}>{p.name}</Link>;
}

export function Header({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: React.ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-5 pt-[calc(18px+env(safe-area-inset-top))] pb-4">
      <div className="min-w-0">
        {eyebrow && <div className="spk-label text-accent">{eyebrow}</div>}
        <h1 className="mt-1 text-[28px] font-black leading-[1.05] tracking-[-.02em] text-balance">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="px-4 pb-6">
      <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
        <h2 className="spk-label text-muted">{title}</h2>
        {aside && <div className="text-[12px] text-dim">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export const card = "rounded-2xl border border-white/[.06] bg-surface";
export const btn = "spk-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-bold disabled:opacity-40";
export const btnPrimary = `${btn} bg-accent text-ink`;
export const btnGhost = `${btn} border border-white/[.08] bg-raised text-fg`;
export const btnQuiet = `${btn} text-muted`;
export const input = "min-h-12 w-full rounded-xl border border-white/[.08] bg-panel px-3.5 text-[16px] text-fg placeholder:text-dimmer focus:border-accent/60 focus:outline-none";

// Finals are lettered and coloured off the app's own palette, not metals, so they can't be
// mistaken for the ranks (src/lib/levels.ts).
export const tierColor = (name: string) => ({ A: "#FFCF5C", B: "#C4CDD6", C: "#D9965F", D: "#B97355" } as Record<string, string>)[name] ?? "#CBFB4F";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** London wall-clock parts. Built by hand so server and phone render the exact same text. */
function london(ms: number | Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date(ms));
  const n = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? 0);
  const y = n("year"), mo = n("month"), d = n("day");
  return { y, mo, d, h: n("hour"), mi: n("minute"), wd: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() };
}

export function fmtTime(ms: number | Date) {
  const t = london(ms);
  return `${String(t.h).padStart(2, "0")}:${String(t.mi).padStart(2, "0")}`;
}

export function fmtDate(ms: number | Date, withTime = true) {
  const t = london(ms);
  return `${DAYS[t.wd]} ${t.d} ${MONTHS[t.mo - 1]}${withTime ? `, ${fmtTime(ms)}` : ""}`;
}

/** A rank's icon (src/lib/levels.ts), the way the ladder app shows its tiers. */
export function RankBadge({ level, size = 16 }: { level: { icon: string; name: string }; size?: number }) {
  return <span aria-label={level.name} className="shrink-0 leading-none" style={{ fontSize: size }}>{level.icon}</span>;
}

/** A player's rank as a small coloured pill: icon, name, division. */
export function LevelPill({ level, size = "sm" }: { level: { name: string; icon: string; color: string }; size?: "sm" | "md" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border font-bold ${size === "md" ? "px-2 py-1 text-[12.5px]" : "px-1.5 py-0.5 text-[11px]"}`} style={{ color: level.color, background: `${level.color}1F`, borderColor: `${level.color}59` }}>
      <RankBadge level={level} size={size === "md" ? 14 : 11} />{level.name}
    </span>
  );
}

/** A player's photo in a ring of their tier's colour, with the tier (and `tag`, their rating or
 *  placement) as a banner across the bottom: the top of the Me page and of every profile. Elsewhere avatars stay plain. The higher
 *  the level, the more it does: a coloured ring (3+), a glow (5+), a slowly turning ring and a
 *  shine across the banner (7+), a halo and sparkles (9+), and a crown at the very top (11). */
export function RankAvatar({ p, size = 104, rank, tag }: { p: Pick<PlayerLite, "name" | "color"> & { photo?: string | null }; size?: number; rank?: { name: string; icon: string; color: string; level?: number }; tag?: string }) {
  if (!rank) return <Avatar p={p} size={size} />;
  const lv = rank.level ?? 1, c = rank.color;
  const ring = lv >= 7
    ? `conic-gradient(from 0deg, ${c}, #ffffff, ${c}, ${c}55, ${c}, #ffffff, ${c})`
    : lv >= 5 ? `conic-gradient(from 200deg, ${c}, ${c}55, ${c}, ${c}99, ${c})`
    : lv >= 3 ? c : "#3a3f45";
  const pad = lv >= 5 ? 5 : lv >= 3 ? 4 : 3;
  const glow = lv >= 9 ? `0 0 0 6px ${c}22, 0 0 44px ${c}80` : lv >= 7 ? `0 0 36px ${c}66` : lv >= 5 ? `0 0 24px ${c}40` : "none";
  return (
    <span className="relative inline-flex flex-col items-center">
      <span className="relative flex items-center justify-center rounded-full" style={{ width: size + 6 + pad * 2, height: size + 6 + pad * 2, boxShadow: glow }}>
        {/* The ring sits behind the photo so it can turn without turning the photo. Its size is set
            outright: taken from the layout it came out wider than tall, and a turning oval shows. */}
        <span className={`absolute inset-0 rounded-full ${lv >= 7 ? "spk-spin" : ""}`} style={{ background: ring }} aria-hidden="true" />
        {lv >= 11 && <span className="spk-crown absolute -top-7 left-1/2 z-10 -translate-x-1/2 text-[34px]" aria-hidden="true">👑</span>}
        {lv >= 9 && [[-6, 18], [92, 8], [100, 70], [-10, 78], [46, -8]].map(([x, y], i) => (
          <span key={i} className="spk-twinkle absolute z-10 h-2 w-2 rounded-full" style={{ left: `${x}%`, top: `${y}%`, background: i % 2 ? "#fff" : c, animationDelay: `${i * 0.35}s` }} aria-hidden="true" />
        ))}
        <span className="relative flex rounded-full bg-bg p-[3px]"><Avatar p={p} size={size} /></span>
      </span>
      <span
        className={`absolute -bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1 overflow-hidden whitespace-nowrap rounded-full border-[3px] border-bg px-2.5 py-0.5 text-[12px] font-black ${lv >= 3 ? "text-ink" : "text-fg"} ${lv >= 7 ? "spk-shine" : ""}`}
        style={{ background: lv >= 3 ? c : "#2a2f35" }}
      >
        {tag && <span className="tnum opacity-60">{tag}</span>}<span aria-hidden="true">{rank.icon}</span>{rank.name}
      </span>
    </span>
  );
}
