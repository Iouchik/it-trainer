import { Router, type IRouter, type Request } from "express";
import { db, feedbackTable, termsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SubmitFeedbackBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { appLog } from "../lib/appLog";

type AuthRequest = Request & { user: typeof usersTable.$inferSelect };

const router: IRouter = Router();

// POST /feedback
router.post("/feedback", requireAuth, async (req: Request, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const parsed = SubmitFeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { termId, message } = parsed.data;

  // Проверяем, что термин существует
  const [term] = await db.select().from(termsTable).where(eq(termsTable.id, termId));
  if (!term) {
    res.status(404).json({ error: "Термин не найден" });
    return;
  }

  await db.insert(feedbackTable).values({
    userId: user.id,
    termId,
    message,
  });

  await appLog("info", `Получен отзыв о термине "${term.term}" от пользователя "${user.username}".`);

  res.status(201).json({ ok: true });
});

export default router;
