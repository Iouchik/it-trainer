import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const termsTable = pgTable("terms", {
  id: serial("id").primaryKey(),
  term: text("term").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("moderation"), // "actual" | "moderation" | "deprecated"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTermSchema = createInsertSchema(termsTable).omit({ id: true, createdAt: true });
export type InsertTerm = z.infer<typeof insertTermSchema>;
export type Term = typeof termsTable.$inferSelect;
