import Link from "next/link";
import type { PlayerLite } from "@/lib/data";

export const initial = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

export function Avatar({ p, size = 32, dim = false }: { p?: Pick<PlayerLite, "name" | "color"> & { photo?: string | null }; size?: number; dim?: boolean }) {
  if (p?.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.photo} alt="" aria-hidden="true" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size, opacity: dim ? 0.45 : 1, background: p.color }} />;
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-ink"
      style={{ width: size, height: size, background: p?.color ?? "#5A6168", fontSize: Math.round(size * 0.42), opacity: dim ? 0.45 : 1 }}
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
        {eyebrow && <div className="text-[11px] font-bold uppercase tracking-[.14em] text-accent">{eyebrow}</div>}
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
        <h2 className="text-[12px] font-bold uppercase tracking-[.12em] text-muted">{title}</h2>
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

export const tierColor = (name: string) => (name === "Gold" ? "#FFCF5C" : name === "Silver" ? "#C4CDD6" : name === "Bronze" ? "#E0935A" : "#CBFB4F");

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
