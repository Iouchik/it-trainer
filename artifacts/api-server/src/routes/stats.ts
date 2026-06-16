import { Router, type IRouter, type Request } from "express";
import { db, gameRoundsTable, termsTable, usersTable } from "@workspace/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

type AuthRequest = Request & { user: typeof usersTable.$inferSelect };

const router: IRouter = Router();

// GET /stats/me
router.get("/stats/me", requireAuth, async (req: Request, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const rounds = await db
    .select()
    .from(gameRoundsTable)
    .where(and(
      eq(gameRoundsTable.userId, user.id),
      sql`${gameRoundsTable.status} != 'active'`,
    ));

  const totalRounds = rounds.length;
  const successRounds = rounds.filter(r => r.status === "won").length;
  const successPercent = totalRounds > 0 ? Math.round((successRounds / totalRounds) * 100) : 0;
  const hintsUsed = rounds.filter(r => r.hintUsed).length;
  const totalAttempts = rounds.reduce((sum, r) => sum + r.attemptsUsed, 0);
  const avgAttempts = totalRounds > 0 ? Math.round((totalAttempts / totalRounds) * 10) / 10 : 0;

  res.json({ totalRounds, successRounds, successPercent, hintsUsed, avgAttempts });
});

// GET /stats/me/history
router.get("/stats/me/history", requireAuth, async (req: Request, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const rounds = await db
    .select({
      id: gameRoundsTable.id,
      termId: gameRoundsTable.termId,
      status: gameRoundsTable.status,
      attemptsUsed: gameRoundsTable.attemptsUsed,
      hintUsed: gameRoundsTable.hintUsed,
      finishedAt: gameRoundsTable.finishedAt,
      term: termsTable.term,
    })
    .from(gameRoundsTable)
    .leftJoin(termsTable, eq(gameRoundsTable.termId, termsTable.id))
    .where(and(
      eq(gameRoundsTable.userId, user.id),
      sql`${gameRoundsTable.status} != 'active'`,
    ))
    .orderBy(desc(gameRoundsTable.finishedAt))
    .limit(10);

  res.json(rounds.map(r => ({
    id: r.id,
    playedAt: r.finishedAt?.toISOString() ?? new Date().toISOString(),
    term: r.term ?? "—",
    termId: r.termId,
    success: r.status === "won",
    attempts: r.attemptsUsed,
    hintUsed: r.hintUsed,
  })));
});

// GET /stats/me/chart
router.get("/stats/me/chart", requireAuth, async (req: Request, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  // Последние 7 дней
  const labels: string[] = [];
  const values: number[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const dayRounds = await db
      .select()
      .from(gameRoundsTable)
      .where(and(
        eq(gameRoundsTable.userId, user.id),
        sql`${gameRoundsTable.status} != 'active'`,
        gte(gameRoundsTable.finishedAt, date),
        sql`${gameRoundsTable.finishedAt} < ${nextDate.toISOString()}`,
      ));

    const total = dayRounds.length;
    const won = dayRounds.filter(r => r.status === "won").length;
    const percent = total > 0 ? Math.round((won / total) * 100) : 0;

    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    labels.push(`${day}.${month}`);
    values.push(percent);
  }

  res.json({ labels, values });
});

export default router;
