import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";
import { getRecap } from "@/lib/data";
import { tierColor } from "@/components/ui";

// A story-sized (1080×1920) card of someone's day, to save or post. Same numbers as the reel:
// both come from buildRecap.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
const when = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = new URL(req.url).searchParams.get("p");
  const r = UUID_RE.test(id) ? await getRecap(id, p && UUID_RE.test(p) ? p : null) : null;
  if (!r) return new Response("Not found", { status: 404 });
  const { recap, names } = r;
  const me = recap.me;
  const f = me?.finish;
  const c = f ? tierColor(f.tier) : "#CBFB4F";
  const name = (pid: string) => names[pid]?.name ?? "Someone";
  const [row] = me ? await db.select({ avatar: players.avatar }).from(players).where(eq(players.id, me.id)) : [];
  const photo = row?.avatar ?? null;
  const swing = me ? Math.max(1, ...me.timeline.map((g) => Math.abs(g.mine - g.theirs))) : 1;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 96, background: "linear-gradient(180deg, #1b2410 0%, #0c0e10 60%)", color: "#F4F5F6", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 6, color: "#CBFB4F", textTransform: "uppercase" }}>East London Roundnet</div>
        <div style={{ fontSize: 96, fontWeight: 900, marginTop: 24, lineHeight: 1.02 }}>{recap.event.title}</div>
        <div style={{ fontSize: 40, color: "#8A9196", marginTop: 16 }}>{when(recap.event.startsAt)}</div>

        {me ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 110 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
              {photo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={photo} width={132} height={132} style={{ borderRadius: 66, objectFit: "cover" }} alt="" />
                : <div style={{ width: 132, height: 132, borderRadius: 66, background: names[me.id]?.color ?? "#CBFB4F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64, fontWeight: 900, color: "#0c0e10" }}>{name(me.id)[0]}</div>}
              <div style={{ fontSize: 56, fontWeight: 800 }}>{name(me.id)}</div>
            </div>
            <div style={{ display: "flex", fontSize: 260, fontWeight: 900, lineHeight: 1, marginTop: 20 }}>{`${me.line.w}–${me.line.l}`}</div>
            <div style={{ display: "flex", gap: 56, fontSize: 40, color: "#C9CED2", marginTop: 24 }}>
              <span>{`${me.line.gp ? Math.round((100 * me.line.w) / me.line.gp) : 0}% wins`}</span>
              <span>{`${me.line.pf} points`}</span>
              <span>{`${me.line.pf - me.line.pa > 0 ? "+" : ""}${me.line.pf - me.line.pa}`}</span>
            </div>
            {me.timeline.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, height: 180, marginTop: 56, position: "relative" }}>
                {me.timeline.map((g, i) => {
                  const h = Math.round((Math.abs(g.mine - g.theirs) / swing) * 84);
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", flex: 1, height: 180 }}>
                      <div style={{ display: "flex", height: 90, alignItems: "flex-end" }}>{g.won && <div style={{ width: "100%", height: h, background: "#5CD37D", borderRadius: 6 }} />}</div>
                      <div style={{ display: "flex", height: 90, alignItems: "flex-start" }}>{!g.won && <div style={{ width: "100%", height: h, background: "#FF6B6B", borderRadius: 6 }} />}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {f && (
              <div style={{ display: "flex", flexDirection: "column", marginTop: 90, padding: 48, borderRadius: 40, background: `${c}22`, border: `3px solid ${c}66` }}>
                <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 4, color: c, textTransform: "uppercase" }}>{`${f.tier} final`}</div>
                <div style={{ fontSize: 80, fontWeight: 900, marginTop: 8, color: f.won ? c : "#F4F5F6" }}>{f.won ? `🏆 ${f.tier} champion` : `${ordinal(f.position)} of ${f.of}`}</div>
              </div>
            )}
            {me.bestPartner && <div style={{ fontSize: 40, color: "#C9CED2", marginTop: 56 }}>{`Best partner: ${name(me.bestPartner.id)} (${me.bestPartner.w}/${me.bestPartner.gp})`}</div>}
            {me.vsLast && (
              <div style={{ fontSize: 40, marginTop: 20, color: me.vsLast.winPctDelta >= 0 ? "#5CD37D" : "#FF6B6B" }}>
                {`${me.vsLast.winPctDelta >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(100 * me.vsLast.winPctDelta))} pts win rate since ${me.vsLast.title}`}
              </div>
            )}
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", gap: 18 }}>
          {recap.winners.map((w) => (
            <div key={w.name} style={{ display: "flex", fontSize: 40 }}>
              <span style={{ color: tierColor(w.name), fontWeight: 800, width: 240 }}>{w.name}</span>
              <span style={{ fontWeight: 700 }}>{w.winner ? name(w.winner) : w.tied.length ? `Tie: ${w.tied.map(name).join(" / ")}` : "Still playing"}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}
