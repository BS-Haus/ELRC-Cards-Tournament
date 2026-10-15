"use client";

import { fmtDate } from "@/components/ui";
import { levelFor, LEVELS } from "@/lib/levels";
import type { ProfileEvent } from "@/lib/data";

/** XP after each weekend as a path up through the levels: each level a band, labelled inside on
 *  the left, the band you're in tinted in its colour, and your latest XP tagged at the end. Only the
 *  levels the path has been through, plus the next one up, so it reads at a glance. */
export function Climb({ events }: { events: ProfileEvent[] }) {
  const rated = events.filter((e) => e.after != null);
  const values = rated.map((e) => e.after!);
  if (!values.length) return null;
  const W = 340, H = 132, T = 16, B = 6;
  const first = levelFor(Math.min(...values)).level, now = levelFor(values.at(-1)!), top = levelFor(Math.max(...values));
  const lo = first.min, hi = (top.next ?? top.level).min + (top.next ? 0 : 60);
  const bands = LEVELS.filter((l) => l.min >= lo && l.min < hi).map((l, i, all) => ({ ...l, to: all[i + 1]?.min ?? hi }));
  const G = 44; // label gutter on the left, so the path never sits on a level's name
  const x = (i: number) => (values.length === 1 ? (G + W) / 2 : G + 8 + (i * (W - G - 22)) / (values.length - 1));
  const y = (v: number) => T + (1 - (Math.min(v, hi) - lo) / (hi - lo)) * (H - T - B);
  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = values.length > 1 ? `${path} L${x(values.length - 1).toFixed(1)} ${H - B} L${x(0).toFixed(1)} ${H - B} Z` : "";
  const last = { x: x(values.length - 1), y: y(values.at(-1)!) };
  const tag = `${values.at(-1)} XP`;
  const tagW = tag.length * 6.2 + 12;
  const tagX = Math.min(W - tagW - 2, Math.max(2, last.x - tagW / 2));
  const dates = rated.map((e) => fmtDate(e.startsAt, false).split(" ").slice(1).join(" "));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" role="img" aria-label={`${values.at(-1)} XP after ${values.length} weekends, Level ${now.level.level}`}>
        <defs>
          <linearGradient id="climbFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#CBFB4F" stopOpacity=".3" />
            <stop offset="1" stopColor="#CBFB4F" stopOpacity="0" />
          </linearGradient>
          <clipPath id="climbClip"><rect x="0" y={T} width={W} height={H - T - B} rx="10" /></clipPath>
        </defs>
        <g clipPath="url(#climbClip)">
          {bands.map((b, i) => {
            const y0 = y(b.to), y1 = y(b.min), mine = b.level === now.level.level;
            return (
              <g key={b.level}>
                <rect x="0" y={y0} width={W} height={y1 - y0} fill={mine ? b.color : "#ffffff"} fillOpacity={mine ? 0.12 : i % 2 ? 0.035 : 0.015} />
                <line x1="0" x2={W} y1={y1} y2={y1} stroke="#ffffff" strokeOpacity=".07" />
                {y1 - y0 >= 13 && (
                  <text x="8" y={y1 - 5} fill={mine ? b.color : "#8A9196"} fillOpacity={mine ? 1 : 0.8} fontSize="9" fontWeight="800">Lv {b.level} {b.icon}</text>
                )}
              </g>
            );
          })}
          {area && <path d={area} fill="url(#climbFill)" />}
        </g>
        {top.next && (
          <g>
            <line x1={G} x2={W} y1={T} y2={T} stroke={top.next.color} strokeOpacity=".7" strokeDasharray="3 4" />
            <text x="8" y={T + 3.5} fill={top.next.color} fontSize="9" fontWeight="800">Lv {top.next.level} {top.next.icon}</text>
          </g>
        )}
        <path d={path} fill="none" stroke="#CBFB4F" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 5 : 3} fill={i === values.length - 1 ? "#CBFB4F" : "#15181b"} stroke="#CBFB4F" strokeWidth="2" />
        ))}
        <g transform={`translate(${tagX} ${Math.max(0, last.y - 24)})`}>
          <rect width={tagW} height="16" rx="8" fill="#CBFB4F" />
          <text x={tagW / 2} y="11.5" textAnchor="middle" fill="#0c0e10" fontSize="10" fontWeight="800">{tag}</text>
        </g>
      </svg>
      <div className="relative mt-1 h-4 text-[10px] text-dim">
        {(dates.length <= 6 ? dates.map((d, i) => [d, i] as const) : [[dates[0], 0] as const, [dates.at(-1)!, dates.length - 1] as const]).map(([d, i]) => (
          <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(x(i) / W) * 100}%` }}>{d}</span>
        ))}
      </div>
    </div>
  );
}
