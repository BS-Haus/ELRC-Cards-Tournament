import { Avatar, tierColor } from "@/components/ui";
import type { PlayerLite } from "@/lib/data";
import { finalLabel } from "@/lib/cards";

type P = PlayerLite | undefined;

/** The A final's podium, the way game results screens do it: 2nd, 1st, 3rd side by side, 1st
 *  tallest with the trophy over them, each on a block with their place. Numbers and the app's own
 *  colours, never medals: gold, silver and bronze are rank names. */
export function PodiumStand({ first, second, third, size = "md" }: { first: P; second: P; third: P; size?: "md" | "lg" }) {
  const lg = size === "lg";
  const H = lg ? 112 : 84; // 1st's block; 2nd and 3rd step down from it
  const cols: { p: P; place: 1 | 2 | 3 }[] = [{ p: second, place: 2 }, { p: first, place: 1 }, { p: third, place: 3 }];
  return (
    <div className="grid grid-cols-3 items-end gap-2">
      {cols.map(({ p, place }) => (
        <div key={place} className="flex min-w-0 flex-col items-center">
          {place === 1 && <span className={`spk-crown leading-none ${lg ? "text-[34px]" : "text-[26px]"}`} aria-hidden="true">🏆</span>}
          <span className={`mt-1 rounded-full ${place === 1 ? "p-[3px]" : ""}`} style={place === 1 ? { background: "#CBFB4F" } : undefined}>
            {p ? <Avatar p={p} size={place === 1 ? (lg ? 76 : 60) : lg ? 56 : 44} /> : <span className="block rounded-full bg-white/10" style={{ width: lg ? 56 : 44, height: lg ? 56 : 44 }} />}
          </span>
          <span className={`mt-1.5 w-full truncate text-center font-black ${place === 1 ? (lg ? "text-[19px]" : "text-[15px]") : lg ? "text-[16px]" : "text-[13.5px]"}`}>{p?.name ?? "–"}</span>
          <div
            className={`mt-2 flex w-full items-start justify-center rounded-t-2xl pt-2 font-black ${place === 1 ? "bg-gold text-ink" : place === 2 ? "bg-white/[.14] text-fg" : "bg-white/[.08] text-fg/80"}`}
            style={{ height: H * (place === 1 ? 1 : place === 2 ? 0.74 : 0.58), fontSize: lg ? 30 : 24 }}
          >
            {place}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Every other final's winner, small and side by side under the podium. */
export function FinalWinners({ finals }: { finals: { name: string; winner: P; tied?: string }[] }) {
  if (!finals.length) return null;
  return (
    <div className={`grid gap-2 ${finals.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {finals.map((f) => {
        const c = tierColor(f.name);
        return (
          <div key={f.name} className="flex min-w-0 items-center gap-2.5 rounded-2xl p-3" style={{ background: `${c}14`, border: `1px solid ${c}40` }}>
            {f.winner ? <Avatar p={f.winner} size={32} /> : <span className="text-[20px]">🤝</span>}
            <div className="min-w-0">
              <div className="spk-label" style={{ color: c }}>{finalLabel(f.name)} final winner</div>
              <div className="truncate text-[15px] font-black">{f.winner?.name ?? f.tied ?? "Still playing"}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
