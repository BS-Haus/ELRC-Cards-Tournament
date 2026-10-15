"use client";

import { TIERS } from "@/lib/levels";

/** Rating after each placed game as a path through the tiers: each tier a band, labelled inside
 *  on the left, the band they're in tinted in its colour, and the latest rating tagged at the end.
 *  Only the tiers the path has been through, plus the next one up and down, so it reads at a glance. */
export function Climb({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="flex h-[110px] items-center justify-center text-[13px] text-dim">Play a few more games to see the trend.</div>;
  const W = 340, H = 140, T = 12, B = 6, G = 44;
  const lo0 = Math.min(...values), hi0 = Math.max(...values);
  const at = (r: number) => Math.max(0, TIERS.findLastIndex((t) => r >= t.min));
  const iLo = at(lo0), iHi = Math.min(TIERS.length - 1, at(hi0) + 1);
  // Room for the next tier's line above, without letting a far-off tier squash the path.
  const top = Math.max(hi0 + 10, iHi > at(hi0) ? Math.min(TIERS[iHi].min + 15, hi0 + 120) : hi0 + 40);
  const bottom = Math.min(lo0 - 10, Math.max(TIERS[iLo].min, lo0 - 80));
  const bands = TIERS.slice(iLo, iHi + 1).map((t, i, all) => ({ ...t, to: all[i + 1]?.min ?? top }));
  const now = TIERS[at(values.at(-1)!)];
  const x = (i: number) => G + 8 + (i * (W - G - 22)) / (values.length - 1);
  const y = (v: number) => T + (1 - (v - bottom) / (top - bottom)) * (H - T - B);
  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L${x(values.length - 1).toFixed(1)} ${H - B} L${x(0).toFixed(1)} ${H - B} Z`;
  const last = { x: x(values.length - 1), y: y(values.at(-1)!) };
  const tag = String(values.at(-1));
  const tagW = tag.length * 6.6 + 14;
  const tagX = Math.min(W - tagW - 2, Math.max(2, last.x - tagW / 2));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" role="img" aria-label={`Rating ${values.at(-1)} after ${values.length} games, ${now.name}`}>
      <defs>
        <linearGradient id="climbFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#CBFB4F" stopOpacity=".28" /><stop offset="1" stopColor="#CBFB4F" stopOpacity="0" /></linearGradient>
        <clipPath id="climbClip"><rect x="0" y={T} width={W} height={H - T - B} rx="10" /></clipPath>
      </defs>
      <g clipPath="url(#climbClip)">
        {bands.map((b, i) => {
          const y0 = y(Math.min(b.to, top)), y1 = y(Math.max(b.min, bottom)), mine = b.level === now.level;
          return (
            <g key={b.level}>
              <rect x="0" y={y0} width={W} height={Math.max(0, y1 - y0)} fill={mine ? b.color : "#ffffff"} fillOpacity={mine ? 0.12 : i % 2 ? 0.035 : 0.015} />
              <line x1="0" x2={W} y1={y1} y2={y1} stroke="#ffffff" strokeOpacity=".07" />
              {y1 - y0 >= 13 && <text x="8" y={y1 - 5} fill={mine ? b.color : "#8A9196"} fillOpacity={mine ? 1 : 0.8} fontSize="9" fontWeight="800">{b.icon} {b.min}</text>}
            </g>
          );
        })}
        <path d={area} fill="url(#climbFill)" />
      </g>
      <path d={path} fill="none" stroke="#CBFB4F" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r="4.5" fill="#CBFB4F" stroke="#15181b" strokeWidth="2" />
      <g transform={`translate(${tagX} ${Math.max(0, last.y - 24)})`}>
        <rect width={tagW} height="16" rx="8" fill="#CBFB4F" />
        <text x={tagW / 2} y="11.5" textAnchor="middle" fill="#0c0e10" fontSize="10" fontWeight="800">{tag}</text>
      </g>
    </svg>
  );
}
