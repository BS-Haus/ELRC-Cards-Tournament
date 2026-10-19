"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NowBar } from "@/components/NowBar";

const items = [
  // "/" opens today's live event if there is one, else the list (src/app/page.tsx).
  { href: "/", label: "Tournament", match: (p: string) => p === "/" || p.startsWith("/e/"), icon: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" },
  { href: "/players", label: "Players", match: (p: string) => p.startsWith("/players") || p.startsWith("/p/"), icon: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8" },
  { href: "/me", label: "Me", match: (p: string) => p.startsWith("/me"), icon: "M20 21v-1a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[.06] bg-bg/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <NowBar />
      <div className="mx-auto flex max-w-[480px]">
        {items.map((it) => {
          const on = it.match(path);
          return (
            <Link key={it.href} href={it.href} className={`spk-press flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-bold ${on ? "text-fg" : "text-dim"}`} aria-current={on ? "page" : undefined}>
              <span className="relative">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={it.icon} /></svg>
              </span>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
