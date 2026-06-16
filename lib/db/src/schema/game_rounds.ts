import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gameRoundsTable = pgTable("game_rounds", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  termId: integer("term_id").notNull(),
  status: text("status").notNull().default("active"), // "active" | "won" | "lost" | "forfeited"
  attemptsTotal: integer("attempts_total").notNull(),
  attemptsUsed: integer("attempts_used").notNull().default(0),
  hintUsed: boolean("hint_used").notNull().default(false),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const insertGameRoundSchema = createInsertSchema(gameRoundsTable).omit({ id: true, startedAt: true });
export type InsertGameRound = z.infer<typeof insertGameRoundSchema>;
export type GameRound = typeof gameRoundsTable.$inferSelect;
