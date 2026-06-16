import { Router, type IRouter, type Request } from "express";
import { db, termsTable, gameRoundsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { SubmitAnswerBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { appLog } from "../lib/appLog";

type AuthRequest = Request & { user: typeof usersTable.$inferSelect };

const router: IRouter = Router();

// Вычисляет количество попыток на основе длины термина (мин 3, макс 8)
function calcAttempts(term: string): number {
  return Math.max(3, Math.min(8, term.length));
}

// POST /game/start
router.post("/game/start", requireAuth, async (req: Request, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  // Завершаем любой активный раунд перед стартом нового
  await db
    .update(gameRoundsTable)
    .set({ status: "forfeited", finishedAt: new Date() })
    .where(and(eq(gameRoundsTable.userId, user.id), eq(gameRoundsTable.status, "active")));

  // Получаем все актуальные термины
  const terms = await db
    .select()
    .from(termsTable)
    .where(eq(termsTable.status, "actual"));

  if (terms.length === 0) {
    res.status(400).json({ error: "Нет доступных терминов для игры" });
    return;
  }

  const randomTerm = terms[Math.floor(Math.random() * terms.length)];
  const attemptsTotal = calcAttempts(randomTerm.term);

  const [round] = await db
    .insert(gameRoundsTable)
    .values({
      userId: user.id,
      termId: randomTerm.id,
      status: "active",
      attemptsTotal,
      attemptsUsed: 0,
      hintUsed: false,
    })
    .returning();

  await appLog("info", `Пользователь "${user.username}" начал новый раунд (термин ID=${randomTerm.id}).`);

  res.json({
    roundId: round.id,
    description: randomTerm.description,
    attemptsLeft: attemptsTotal,
    attemptsTotal,
    hintUsed: false,
    hintAvailable: false,
    hint: null,
  });
});

// POST /game/answer
router.post("/game/answer", requireAuth, async (req: Request, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const parsed = SubmitAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [round] = await db
    .select()
    .from(gameRoundsTable)
    .where(and(eq(gameRoundsTable.userId, user.id), eq(gameRoundsTable.status, "active")));

  if (!round) {
    res.status(400).json({ error: "Нет активного раунда" });
    return;
  }

  const [term] = await db.select().from(termsTable).where(eq(termsTable.id, round.termId));
  if (!term) {
    res.status(400).json({ error: "Термин не найден" });
    return;
  }

  const answer = parsed.data.answer.trim().toLowerCase();
  const correct = term.term.trim().toLowerCase();
  const isCorrect = answer === correct;

  const newAttemptsUsed = round.attemptsUsed + 1;
  const attemptsLeft = round.attemptsTotal - newAttemptsUsed;
  const hintAvailable = newAttemptsUsed >= 2 && !round.hintUsed;

  if (isCorrect) {
    await db
      .update(gameRoundsTable)
      .set({ status: "won", attemptsUsed: newAttemptsUsed, finishedAt: new Date() })
      .where(eq(gameRoundsTable.id, round.id));

    await appLog("info", `Пользователь "${user.username}" угадал термин "${term.term}" за ${newAttemptsUsed} попыток.`);

    res.json({
      correct: true,
      attemptsLeft,
      finished: true,
      success: true,
      correctTerm: term.term,
      description: term.description,
      hintAvailable: false,
    });
    return;
  }

  // Неверный ответ
  if (attemptsLeft <= 0) {
    await db
      .update(gameRoundsTable)
      .set({ status: "lost", attemptsUsed: newAttemptsUsed, finishedAt: new Date() })
      .where(eq(gameRoundsTable.id, round.id));

    await appLog("warn", `Пользователь "${user.username}" не угадал термин "${term.term}".`);

    res.json({
      correct: false,
      attemptsLeft: 0,
      finished: true,
      success: false,
      correctTerm: term.term,
      description: term.description,
      hintAvailable: false,
    });
    return;
  }

  await db
    .update(gameRoundsTable)
    .set({ attemptsUsed: newAttemptsUsed })
    .where(eq(gameRoundsTable.id, round.id));

  res.json({
    correct: false,
    attemptsLeft,
    finished: false,
    success: false,
    correctTerm: null,
    description: null,
    hintAvailable,
  });
});

// POST /game/hint
router.post("/game/hint", requireAuth, async (req: Request, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const [round] = await db
    .select()
    .from(gameRoundsTable)
    .where(and(eq(gameRoundsTable.userId, user.id), eq(gameRoundsTable.status, "active")));

  if (!round) {
    res.status(400).json({ error: "Нет активного раунда" });
    return;
  }

  if (round.attemptsUsed < 2) {
    res.status(400).json({ error: "Подсказка доступна только после 2-х неверных попыток" });
    return;
  }

  const [term] = await db.select().from(termsTable).where(eq(termsTable.id, round.termId));
  if (!term) {
    res.status(400).json({ error: "Термин не найден" });
    return;
  }

  await db
    .update(gameRoundsTable)
    .set({ hintUsed: true })
    .where(eq(gameRoundsTable.id, round.id));

  const hint = `Термин начинается на букву «${term.term[0]}» и содержит ${term.term.length} символов.`;
  const attemptsLeft = round.attemptsTotal - round.attemptsUsed;

  res.json({ hint, attemptsLeft });
});

// POST /game/forfeit
router.post("/game/forfeit", requireAuth, async (req: Request, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const [round] = await db
    .select()
    .from(gameRoundsTable)
    .where(and(eq(gameRoundsTable.userId, user.id), eq(gameRoundsTable.status, "active")));

  if (!round) {
    res.status(400).json({ error: "Нет активного раунда" });
    return;
  }

  const [term] = await db.select().from(termsTable).where(eq(termsTable.id, round.termId));
  if (!term) {
    res.status(400).json({ error: "Термин не найден" });
    return;
  }

  await db
    .update(gameRoundsTable)
    .set({ status: "forfeited", finishedAt: new Date() })
    .where(eq(gameRoundsTable.id, round.id));

  await appLog("info", `Пользователь "${user.username}" сдался (термин "${term.term}").`);

  res.json({
    success: false,
    correctTerm: term.term,
    description: term.description,
  });
});

// GET /game/current
router.get("/game/current", requireAuth, async (req: Request, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const [round] = await db
    .select()
    .from(gameRoundsTable)
    .where(and(eq(gameRoundsTable.userId, user.id), eq(gameRoundsTable.status, "active")));

  if (!round) {
    // Нет активного раунда — возвращаем пустой объект с roundId=0
    res.json({
      roundId: 0,
      description: "",
      attemptsLeft: 0,
      attemptsTotal: 0,
      hintUsed: false,
      hintAvailable: false,
      hint: null,
    });
    return;
  }

  const [term] = await db.select().from(termsTable).where(eq(termsTable.id, round.termId));
  if (!term) {
    res.json({
      roundId: 0,
      description: "",
      attemptsLeft: 0,
      attemptsTotal: 0,
      hintUsed: false,
      hintAvailable: false,
      hint: null,
    });
    return;
  }

  const attemptsLeft = round.attemptsTotal - round.attemptsUsed;
  const hintAvailable = round.attemptsUsed >= 2 && !round.hintUsed;

  res.json({
    roundId: round.id,
    description: term.description,
    attemptsLeft,
    attemptsTotal: round.attemptsTotal,
    hintUsed: round.hintUsed,
    hintAvailable,
    hint: round.hintUsed
      ? `Термин начинается на букву «${term.term[0]}» и содержит ${term.term.length} символов.`
      : null,
  });
});

export default router;
