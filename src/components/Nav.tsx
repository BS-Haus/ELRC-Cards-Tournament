"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Events", match: (p: string) => p === "/" || p.startsWith("/e/"), icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/players", label: "Players", match: (p: string) => p.startsWith("/players") || p.startsWith("/p/"), icon: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8" },
  { href: "/me", label: "Me", match: (p: string) => p.startsWith("/me"), icon: "M20 21v-1a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[.06] bg-bg/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto flex max-w-[480px]">
        {items.map((it) => {
          const on = it.match(path);
          return (
            <Link key={it.href} href={it.href} className={`spk-press flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-bold ${on ? "text-accent" : "text-dim"}`} aria-current={on ? "page" : undefined}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={it.icon} /></svg>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
