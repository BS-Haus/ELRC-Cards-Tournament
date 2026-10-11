import { ImageResponse } from "next/og";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { players, eventPhotos } from "@/db/schema";
import { getRecap, getStory } from "@/lib/data";
import { finalWinTitle } from "@/lib/cards";
import { tierColor } from "@/components/ui";

// A story-sized (1080×1920) card of someone's day, to save or post. Same numbers as the reel:
// both come from buildRecap.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
const when = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = new URL(req.url).searchParams.get("p");
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });
  if (!p || !UUID_RE.test(p)) return storyCard(id);
  const r = await getRecap(id, p);
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
                <div style={{ fontSize: 80, fontWeight: 900, marginTop: 8, color: f.won ? c : "#F4F5F6" }}>{f.won ? `🏆 ${finalWinTitle(f.tier)}` : `${ordinal(f.position)} of ${f.of}`}</div>
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
              <span style={{ color: tierColor(w.name), fontWeight: 800, width: 240 }}>{`${w.name} final`}</span>
              <span style={{ fontWeight: 700 }}>{w.winner ? name(w.winner) : w.tied.length ? `Tie: ${w.tied.map(name).join(" / ")}` : "Still playing"}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}

/** The tournament's card: the champion big, then every final's winner and the records broken. */
async function storyCard(id: string) {
  const r = await getStory(id);
  if (!r) return new Response("Not found", { status: 404 });
  const { story, names } = r;
  const name = (pid: string) => names[pid]?.name ?? "Someone";
  const champ = story.champion;
  const [row] = champ ? await db.select({ avatar: players.avatar }).from(players).where(eq(players.id, champ.id)) : [];
  const [cover] = await db.select({ data: eventPhotos.data }).from(eventPhotos).where(eq(eventPhotos.eventId, id)).orderBy(asc(eventPhotos.createdAt)).limit(1);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: 96, background: "linear-gradient(180deg, #3a2c06 0%, #120f05 45%, #0c0e10 100%)", color: "#F4F5F6", fontFamily: "sans-serif", position: "relative" }}>
        {cover?.data && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.data} width={1080} height={1920} style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, objectFit: "cover" }} alt="" />
        )}
        {cover?.data && <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, background: "linear-gradient(180deg, rgba(12,14,16,.55) 0%, rgba(12,14,16,.35) 35%, rgba(12,14,16,.92) 70%, #0c0e10 100%)" }} />}
        <div style={{ fontSize: 34, letterSpacing: 6, color: "#FFCF5C", textTransform: "uppercase" }}>{`${story.event.title} · ${when(story.event.startsAt)}`}</div>
        {champ ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 110 }}>
            <div style={{ fontSize: 110 }}>👑</div>
            {row?.avatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={row.avatar} width={360} height={360} style={{ borderRadius: 180, border: "14px solid #FFCF5C", objectFit: "cover" }} alt="" />
              : <div style={{ width: 360, height: 360, borderRadius: 180, border: "14px solid #FFCF5C", background: names[champ.id]?.color ?? "#CBFB4F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 170, color: "#0c0e10" }}>{name(champ.id)[0]}</div>}
            <div style={{ fontSize: 40, letterSpacing: 14, color: "#FFCF5C", marginTop: 56 }}>CHAMPION</div>
            <div style={{ fontSize: 120, marginTop: 8 }}>{name(champ.id)}</div>
            <div style={{ fontSize: 42, color: "#C9CED2", marginTop: 12 }}>{`${champ.line.w}–${champ.line.l} on the day · ${champ.titles === 1 ? "first title" : `${ordinal(champ.titles)} title`}`}</div>
          </div>
        ) : <div style={{ fontSize: 96, marginTop: 200 }}>{story.event.title}</div>}
        <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 18, marginTop: "auto" }}>
          {story.records.slice(0, 3).map((rec) => (
            <div key={rec.kind} style={{ display: "flex", justifyContent: "space-between", fontSize: 36, padding: "20px 32px", borderRadius: 28, background: "rgba(192,132,252,.14)", border: "2px solid rgba(192,132,252,.4)" }}>
              <span style={{ color: "#E9D5FF" }}>{`Record · ${rec.label}`}</span>
              <span>{rec.value}</span>
            </div>
          ))}
          {story.podium.slice(1).map((pd) => (
            <div key={pd.name} style={{ display: "flex", fontSize: 40 }}>
              <span style={{ color: tierColor(pd.name), width: 240 }}>{`${pd.name} final`}</span>
              <span>{pd.winner ? name(pd.winner) : "—"}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}
