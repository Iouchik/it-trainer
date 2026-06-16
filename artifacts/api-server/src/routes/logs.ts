import { Router, type IRouter, type Request } from "express";
import { db, systemLogsTable, usersTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAuth";

type AuthRequest = Request & { user: typeof usersTable.$inferSelect };

const router: IRouter = Router();

// GET /logs (admin only)
router.get("/logs", requireAdmin, async (_req: Request, res): Promise<void> => {
  const logs = await db
    .select()
    .from(systemLogsTable)
    .orderBy(desc(systemLogsTable.createdAt))
    .limit(100);

  res.json(logs.map(l => ({
    id: l.id,
    level: l.level,
    message: l.message,
    createdAt: l.createdAt?.toISOString() ?? new Date().toISOString(),
  })).reverse()); // Показываем в хронологическом порядке
});

// DELETE /logs (admin only)
router.delete("/logs", requireAdmin, async (req: Request, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  await db.delete(systemLogsTable);

  // Добавляем запись об очистке
  await db.insert(systemLogsTable).values({
    level: "warn",
    message: `Системные логи очищены администратором "${user.username}".`,
  });

  res.json({ ok: true });
});

export default router;
