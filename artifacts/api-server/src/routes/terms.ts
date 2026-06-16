import { Router, type IRouter, type Request } from "express";
import { db, termsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateTermBody, UpdateTermBody, GetTermParams, UpdateTermParams, DeleteTermParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { appLog } from "../lib/appLog";

type AuthRequest = Request & { user: typeof usersTable.$inferSelect };

const router: IRouter = Router();

// GET /terms
router.get("/terms", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  const showAll = req.query["all"] === "1";

  // Admins get all terms, regular users/guests get only actual
  let terms;
  if (showAll && userId) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (user?.role === "admin") {
      terms = await db.select().from(termsTable).orderBy(termsTable.id);
    } else {
      terms = await db.select().from(termsTable).where(eq(termsTable.status, "actual"));
    }
  } else {
    terms = await db.select().from(termsTable).where(eq(termsTable.status, "actual"));
  }

  res.json(terms.map(t => ({
    id: t.id,
    term: t.term,
    description: t.description,
    status: t.status,
    termLength: t.term.length,
    createdAt: t.createdAt?.toISOString() ?? null,
  })));
});

// POST /terms (admin only)
router.post("/terms", requireAuth, async (req: Request, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.role !== "admin") {
    res.status(403).json({ error: "Доступ запрещён" });
    return;
  }

  const parsed = CreateTermBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [term] = await db
    .insert(termsTable)
    .values({
      term: parsed.data.term,
      description: parsed.data.description,
      status: parsed.data.status ?? "moderation",
    })
    .returning();

  await appLog("info", `Термин "${term.term}" добавлен администратором "${user.username}".`);

  res.status(201).json({
    id: term.id,
    term: term.term,
    description: term.description,
    status: term.status,
    termLength: term.term.length,
    createdAt: term.createdAt?.toISOString() ?? null,
  });
});

// GET /terms/:id
router.get("/terms/:id", async (req, res): Promise<void> => {
  const params = GetTermParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [term] = await db.select().from(termsTable).where(eq(termsTable.id, params.data.id));
  if (!term) {
    res.status(404).json({ error: "Термин не найден" });
    return;
  }

  res.json({
    id: term.id,
    term: term.term,
    description: term.description,
    status: term.status,
    termLength: term.term.length,
    createdAt: term.createdAt?.toISOString() ?? null,
  });
});

// PATCH /terms/:id (admin only)
router.patch("/terms/:id", requireAuth, async (req: Request, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.role !== "admin") {
    res.status(403).json({ error: "Доступ запрещён" });
    return;
  }

  const params = UpdateTermParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTermBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.term !== undefined) updateData["term"] = parsed.data.term;
  if (parsed.data.description !== undefined) updateData["description"] = parsed.data.description;
  if (parsed.data.status !== undefined) updateData["status"] = parsed.data.status;

  const [term] = await db
    .update(termsTable)
    .set(updateData)
    .where(eq(termsTable.id, params.data.id))
    .returning();

  if (!term) {
    res.status(404).json({ error: "Термин не найден" });
    return;
  }

  await appLog("info", `Термин ID=${term.id} обновлён администратором "${user.username}".`);

  res.json({
    id: term.id,
    term: term.term,
    description: term.description,
    status: term.status,
    termLength: term.term.length,
    createdAt: term.createdAt?.toISOString() ?? null,
  });
});

// DELETE /terms/:id (admin only)
router.delete("/terms/:id", requireAuth, async (req: Request, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.role !== "admin") {
    res.status(403).json({ error: "Доступ запрещён" });
    return;
  }

  const params = DeleteTermParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [term] = await db
    .delete(termsTable)
    .where(eq(termsTable.id, params.data.id))
    .returning();

  if (!term) {
    res.status(404).json({ error: "Термин не найден" });
    return;
  }

  await appLog("info", `Термин "${term.term}" удалён администратором "${user.username}".`);

  res.sendStatus(204);
});

export default router;
