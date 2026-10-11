import { pgTable, uuid, text, integer, timestamp, jsonb, primaryKey, index } from "drizzle-orm/pg-core";

// A person. `handle` is the lower-cased name used to sign in. A walk-in added by the organiser
// has no PIN yet; whoever signs up with that name later claims the profile and its history.
export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  pinHash: text("pin_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A weekend session people sign up for: "Sunday cards, Victoria Park".
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  location: text("location").notNull().default(""),
  notes: text("notes").notNull().default(""),
  nets: integer("nets").notNull().default(2),
  groupTo: integer("group_to").notNull().default(15),
  finalTo: integer("final_to").notNull().default(15),
  status: text("status").notNull().default("upcoming"), // upcoming | live | done
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Who's in. going = signed up, here = checked in on the day, out = can't make it / left.
export const entries = pgTable(
  "entries",
  {
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
    state: text("state").notNull().default("going"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.playerId] })],
);

// One round of groups: random, seeded, or the Gold/Silver/Bronze finals.
export const stages = pgTable("stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  no: integer("no").notNull(),
  kind: text("kind").notNull(), // random | seeded | final
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A 2v2 game. Drawn games never change shape, except that a sub can take a dropped player's
// place: the sub's id goes in `subs`, and the result doesn't count for them.
export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id").notNull().references(() => stages.id, { onDelete: "cascade" }),
    groupNo: integer("group_no").notNull(),
    groupName: text("group_name").notNull(),
    seq: integer("seq").notNull(),
    ord: integer("ord").notNull(),
    net: integer("net").notNull(),
    a1: uuid("a1").notNull().references(() => players.id),
    a2: uuid("a2").notNull().references(() => players.id),
    b1: uuid("b1").notNull().references(() => players.id),
    b2: uuid("b2").notNull().references(() => players.id),
    subs: jsonb("subs").$type<string[]>().notNull().default([]),
    scoreA: integer("score_a"),
    scoreB: integer("score_b"),
    status: text("status").notNull().default("todo"), // todo | done | void
    enteredById: uuid("entered_by_id").references(() => players.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("games_event_idx").on(t.eventId)],
);

// Sign-in attempt counting, shared across serverless instances (same approach as Spike).
export const rateLimits = pgTable("rate_limits", {
  bucket: text("bucket").primaryKey(),
  hits: integer("hits").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});
