import { ImageResponse } from "next/og";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { players, eventPhotos } from "@/db/schema";
import { getRecap, getStory, getLadderStory } from "@/lib/data";
import { finalLabel, finalWinTitle } from "@/lib/cards";
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
                <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 4, color: c, textTransform: "uppercase" }}>{`${finalLabel(f.tier)} final`}</div>
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
              <span style={{ color: tierColor(w.name), fontWeight: 800, width: 240 }}>{`${finalLabel(w.name)} final`}</span>
              <span style={{ fontWeight: 700 }}>{w.winner ? name(w.winner) : w.tied.length ? `Tie: ${w.tied.map(name).join(" / ")}` : "Still playing"}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}

/** The tournament's card, a podium: the A final's top three on their blocks (2nd, 1st, 3rd), the
 *  champion tallest with the crown, then every other final's winner and any records broken. */
/** A ladder day's card: the date and numbers, then the biggest climbers. */
async function ladderCard(l: NonNullable<Awaited<ReturnType<typeof getLadderStory>>>) {
  const { event, story, names } = l;
  const name = (pid: string) => names[pid]?.name ?? "Someone";
  const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 96, background: "linear-gradient(180deg, #1b2410 0%, #0c0e10 60%)", color: "#F4F5F6", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 32, fontWeight: 700, letterSpacing: 6, color: "#CBFB4F", textTransform: "uppercase" }}>East London Roundnet</div>
        <div style={{ display: "flex", fontSize: 104, fontWeight: 900, marginTop: 18, lineHeight: 1 }}>{event.title}</div>
        <div style={{ display: "flex", fontSize: 40, color: "#C9CED2", marginTop: 14 }}>{`${when(event.startsAt)} · ${story.players} players · ${story.rounds} rounds`}</div>
        <div style={{ display: "flex", fontSize: 36, letterSpacing: 6, color: "#CBFB4F", marginTop: "auto", textTransform: "uppercase" }}>Biggest climbers</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 28 }}>
          {story.earners.map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", padding: "28px 36px", borderRadius: 32, background: i === 0 ? "rgba(203,251,79,.16)" : "rgba(255,255,255,.06)" }}>
              <span style={{ display: "flex", width: 70, fontSize: 52, fontWeight: 900, color: i === 0 ? "#CBFB4F" : "#8A9196" }}>{String(i + 1)}</span>
              <span style={{ display: "flex", flex: 1, fontSize: i === 0 ? 72 : 58, fontWeight: 900 }}>{name(e.id)}</span>
              <span style={{ display: "flex", fontSize: i === 0 ? 72 : 58, fontWeight: 900, color: e.today >= 0 ? "#CBFB4F" : "#C9CED2" }}>{signed(e.today)}</span>
            </div>
          ))}
        </div>
        {story.king && <div style={{ display: "flex", fontSize: 40, color: "#FFCF5C", marginTop: 48 }}>{`👑 ${name(story.king.id)}: ${story.king.topWins} wins on the top net`}</div>}
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}

async function storyCard(id: string) {
  const l = await getLadderStory(id, null);
  if (l) return ladderCard(l);
  const r = await getStory(id);
  if (!r) return new Response("Not found", { status: 404 });
  const { story, names } = r;
  const name = (pid: string) => names[pid]?.name ?? "Someone";
  const top = story.podium[0];
  const three = top?.winner ? [top.runnerUp, top.winner, top.third] : [null, null, null];
  const ids = three.filter((x): x is string => !!x);
  const rows = ids.length ? await db.select({ id: players.id, avatar: players.avatar }).from(players).where(inArray(players.id, ids)) : [];
  const avatar = new Map(rows.map((x) => [x.id, x.avatar]));
  const [cover] = await db.select({ data: eventPhotos.data }).from(eventPhotos).where(eq(eventPhotos.eventId, id)).orderBy(asc(eventPhotos.createdAt)).limit(1);
  const line = (pid: string) => top?.table.find((t) => t.id === pid);

  const face = (pid: string, size: number, ring: string) =>
    avatar.get(pid)
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={avatar.get(pid)!} width={size} height={size} style={{ borderRadius: size / 2, border: `10px solid ${ring}`, objectFit: "cover" }} alt="" />
      : <div style={{ width: size, height: size, borderRadius: size / 2, border: `10px solid ${ring}`, background: names[pid]?.color ?? "#CBFB4F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45, fontWeight: 900, color: "#0c0e10" }}>{name(pid)[0]}</div>;

  // Column order on the podium: 2nd, 1st, 3rd.
  const cols = [
    { pid: three[0], place: 2, size: 200, block: 420, ring: "rgba(255,255,255,.35)", fill: "rgba(255,255,255,.14)", ink: "#F4F5F6" },
    { pid: three[1], place: 1, size: 270, block: 560, ring: "#CBFB4F", fill: "#CBFB4F", ink: "#0c0e10" },
    { pid: three[2], place: 3, size: 180, block: 330, ring: "rgba(255,255,255,.22)", fill: "rgba(255,255,255,.08)", ink: "rgba(244,245,246,.8)" },
  ];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "96px 72px 0", background: "linear-gradient(180deg, #23300c 0%, #10140a 45%, #0c0e10 100%)", color: "#F4F5F6", fontFamily: "sans-serif", position: "relative" }}>
        {cover?.data && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.data} width={1080} height={1920} style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, objectFit: "cover" }} alt="" />
        )}
        {cover?.data && <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, background: "linear-gradient(180deg, rgba(12,14,16,.75) 0%, rgba(12,14,16,.55) 30%, rgba(12,14,16,.94) 55%, #0c0e10 100%)" }} />}

        <div style={{ display: "flex", fontSize: 32, fontWeight: 700, letterSpacing: 6, color: "#CBFB4F", textTransform: "uppercase" }}>East London Roundnet</div>
        <div style={{ display: "flex", fontSize: 104, fontWeight: 900, marginTop: 18, lineHeight: 1 }}>{story.event.title}</div>
        <div style={{ display: "flex", fontSize: 40, color: "#C9CED2", marginTop: 14 }}>{`${when(story.event.startsAt)} · ${story.numbers.players} players · ${story.numbers.games} games`}</div>

        {top?.winner ? (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginTop: "auto" }}>
            {cols.map((c) => (
              <div key={c.place} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                {c.place === 1 && <div style={{ display: "flex", fontSize: 110, marginBottom: 6 }}>🏆</div>}
                {c.pid ? face(c.pid, c.size, c.ring) : <div style={{ width: c.size, height: c.size, borderRadius: c.size / 2, background: "rgba(255,255,255,.08)", display: "flex" }} />}
                <div style={{ display: "flex", fontSize: c.place === 1 ? 58 : 46, fontWeight: 900, marginTop: 20, textAlign: "center" }}>{c.pid ? name(c.pid) : "–"}</div>
                <div style={{ display: "flex", fontSize: 32, color: "#8A9196", marginTop: 6 }}>{c.pid && line(c.pid) ? `${line(c.pid)!.w}–${line(c.pid)!.l}` : " "}</div>
                <div style={{ display: "flex", justifyContent: "center", width: "100%", height: c.block, marginTop: 24, borderRadius: "40px 40px 0 0", background: c.fill, color: c.ink, fontSize: c.place === 1 ? 150 : 110, fontWeight: 900, paddingTop: 30 }}>{String(c.place)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, marginTop: "auto", marginBottom: 200, color: "#C9CED2" }}>{top?.tied.length ? `Gold final tied: ${top.tied.map(name).join(" / ")}` : "Finals still to play"}</div>
        )}

        {(story.podium.length > 1 || story.records.length > 0) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, margin: "0 -72px", padding: "40px 72px 72px", background: "#0c0e10" }}>
            {story.podium.slice(1).map((pd) => (
              <div key={pd.name} style={{ display: "flex", alignItems: "center", fontSize: 40 }}>
                <span style={{ display: "flex", color: tierColor(pd.name), fontWeight: 800, width: 260 }}>{`${finalLabel(pd.name)} final`}</span>
                <span style={{ display: "flex", fontWeight: 700 }}>{pd.winner ? `🏆 ${name(pd.winner)}` : pd.tied.length ? `Tied: ${pd.tied.map(name).join(" / ")}` : "–"}</span>
              </div>
            ))}
            {story.records.slice(0, 2).map((rec) => (
              <div key={rec.kind} style={{ display: "flex", justifyContent: "space-between", fontSize: 34, color: "#E9D5FF", marginTop: 6 }}>
                <span style={{ display: "flex" }}>{`Record · ${rec.label}`}</span>
                <span style={{ display: "flex", fontWeight: 800 }}>{rec.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}
