import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { LevelMoments } from "@/components/LevelMoments";
import { GameResult } from "@/components/GameResult";
import { getSession, isOrganiser } from "@/lib/auth/session";

const geistSans = localFont({ src: "./fonts/geist-latin.woff2", variable: "--font-geist-sans", weight: "400 900", display: "swap" });
const geistMono = localFont({ src: "./fonts/geist-mono-latin.woff2", variable: "--font-geist-mono", weight: "400 700", display: "swap" });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Cards · East London Roundnet",
  description: "Weekend cards tournaments at Victoria Park. Sign up, play every level, see your stats.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Cards" },
  openGraph: { type: "website", siteName: "East London Roundnet", title: "Cards · East London Roundnet", description: "Weekend cards tournaments at Victoria Park. Add yourself and come play." },
};

export const viewport: Viewport = { themeColor: "#0c0e10", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const org = isOrganiser(await getSession());
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <div className="mx-auto min-h-dvh max-w-[480px] bg-bg pb-[calc(84px+env(safe-area-inset-bottom))]">{children}</div>
        <Nav org={org} />
        <LevelMoments />
        <GameResult />
      </body>
    </html>
  );
}
