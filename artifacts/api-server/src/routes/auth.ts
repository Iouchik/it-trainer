import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { appLog } from "../lib/appLog";

const router: IRouter = Router();

// POST /auth/register
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, email, password } = parsed.data;

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (existing.length > 0) {
    res.status(409).json({ error: "Логин уже занят" });
    return;
  }

  const existingEmail = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existingEmail.length > 0) {
    res.status(409).json({ error: "Email уже используется" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ username, email, passwordHash, role: "user" })
    .returning();

  req.session.userId = user.id;
  await appLog("info", `Пользователь "${username}" зарегистрировался.`);

  res.status(201).json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });
});

// POST /auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (!user) {
    res.status(401).json({ error: "Неверный логин или пароль" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Неверный логин или пароль" });
    await appLog("warn", `Неудачная попытка входа для пользователя "${username}".`);
    return;
  }

  req.session.userId = user.id;
  await appLog("info", `Пользователь "${username}" вошёл в систему.`);

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });
});

// POST /auth/logout
router.post("/auth/logout", (req, res): void => {
  const userId = req.session?.userId;
  req.session.destroy(() => {
    if (userId) {
      appLog("info", `Пользователь ID=${userId} вышел из системы.`).catch(() => {});
    }
    res.json({ ok: true });
  });
});

// GET /auth/me
router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Не авторизован" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Пользователь не найден" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });
});

export default router;
