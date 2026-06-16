# Веб-тренажёр IT-терминологии — Руководство по развёртыванию

## Системные требования

| Компонент | Версия |
|-----------|--------|
| Node.js   | 24+    |
| pnpm      | 9+     |
| PostgreSQL | 15+   |

---

## Структура проекта

```
.
├── artifacts/
│   ├── api-server/        # Express 5 API-сервер (порт 8080)
│   └── trainer/           # React + Vite SPA (порт настраивается)
├── lib/
│   ├── api-client-react/  # Сгенерированные React Query хуки
│   ├── api-spec/          # OpenAPI спецификация
│   ├── api-zod/           # Сгенерированные Zod-схемы
│   └── db/                # Drizzle ORM схема и клиент БД
└── scripts/               # Вспомогательные скрипты
```

---

## Шаг 1. Установка зависимостей

```bash
# Установить pnpm (если не установлен)
npm install -g pnpm

# Установить все зависимости монорепозитория
pnpm install
```

---

## Шаг 2. Переменные окружения

Создайте файл `.env` в корне проекта:

```env
# Строка подключения к PostgreSQL
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE_NAME

# Секрет для шифрования сессий (случайная строка, минимум 32 символа)
SESSION_SECRET=замените_на_случайную_строку_минимум_32_символа
```

> **Важно:** никогда не публикуйте `.env` в репозитории. Он уже добавлен в `.gitignore`.

---

## Шаг 3. Инициализация базы данных

```bash
# Применить схему БД (создать таблицы)
pnpm --filter @workspace/db run push
```

### Заполнение начальными данными

Подключитесь к БД и выполните SQL:

```sql
-- Включить расширение для хеширования паролей
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Создать администратора (логин: admin, пароль: admin123)
INSERT INTO users (username, email, password_hash, role)
VALUES (
  'admin',
  'admin@example.com',
  crypt('admin123', gen_salt('bf')),
  'admin'
);

-- Создать тестового пользователя (логин: user, пароль: user123)
INSERT INTO users (username, email, password_hash, role)
VALUES (
  'user',
  'user@example.com',
  crypt('user123', gen_salt('bf')),
  'user'
);
```

> Пароли можно изменить через интерфейс или заменив строку `'admin123'` и `'user123'` на нужные.

---

## Шаг 4. Сборка проекта

```bash
# Собрать библиотеки (lib/*)
pnpm run typecheck:libs

# Собрать API-сервер
pnpm --filter @workspace/api-server run build

# Собрать фронтенд (SPA)
pnpm --filter @workspace/trainer run build
```

После сборки:
- API-сервер: `artifacts/api-server/dist/index.mjs`
- Фронтенд: `artifacts/trainer/dist/` (статические файлы)

---

## Шаг 5. Запуск

### Вариант A — Разработка (dev-режим)

```bash
# В одном терминале — API-сервер
pnpm --filter @workspace/api-server run dev

# В другом терминале — фронтенд
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/trainer run dev
```

### Вариант B — Продакшн

**API-сервер:**
```bash
DATABASE_URL=... SESSION_SECRET=... PORT=8080 node artifacts/api-server/dist/index.mjs
```

**Фронтенд (статические файлы):**

Раздайте содержимое `artifacts/trainer/dist/` через любой веб-сервер. Примеры:

```bash
# Nginx (рекомендуется)
# Скопируйте dist/ в /var/www/html/ и настройте проксирование /api → API-сервер

# Или serve (для быстрого теста)
npx serve artifacts/trainer/dist -s -l 3000
```

---

## Шаг 6. Настройка Nginx (рекомендуется)

Пример конфигурации `/etc/nginx/sites-available/trainer`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Фронтенд — статические файлы
    root /var/www/trainer/dist;
    index index.html;

    # SPA-роутинг: все пути → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Проксирование API-запросов на Express
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Cookie $http_cookie;
    }
}
```

---

## Шаг 7. Process Manager (PM2)

Для фоновой работы API-сервера в продакшне:

```bash
npm install -g pm2

pm2 start artifacts/api-server/dist/index.mjs \
  --name "it-trainer-api" \
  --env production \
  -- --env DATABASE_URL="..." SESSION_SECRET="..."

# Автозапуск при перезагрузке сервера
pm2 startup
pm2 save
```

---

## Переменные окружения API-сервера

| Переменная       | Обязательная | Описание |
|------------------|:---:|----------|
| `DATABASE_URL`   | ✅  | Строка подключения PostgreSQL (`postgresql://user:pass@host:5432/db`) |
| `SESSION_SECRET` | ✅  | Секрет для подписи cookies сессий (≥32 символов) |
| `PORT`           | —   | Порт сервера (по умолчанию `8080`) |
| `NODE_ENV`       | —   | Режим: `development` или `production` |

---

## Учётные записи по умолчанию

| Логин  | Пароль   | Роль          |
|--------|----------|---------------|
| admin  | admin123 | Администратор |
| user   | user123  | Пользователь  |

> **Смените пароли после первого входа!**

---

## Роли пользователей

| Функция                         | user | admin |
|---------------------------------|:----:|:-----:|
| Игровые раунды                  | ✅   | ✅    |
| Своя статистика                 | ✅   | ✅    |
| Управление словарём терминов    | —    | ✅    |
| Просмотр системных логов        | —    | ✅    |
| Очистка логов                   | —    | ✅    |

---

## API эндпоинты

### Аутентификация
| Метод | Путь              | Описание               |
|-------|-------------------|------------------------|
| POST  | `/api/auth/register` | Регистрация           |
| POST  | `/api/auth/login`    | Вход                  |
| POST  | `/api/auth/logout`   | Выход                 |
| GET   | `/api/auth/me`       | Текущий пользователь  |

### Игра
| Метод | Путь              | Описание                  |
|-------|-------------------|---------------------------|
| POST  | `/api/game/start`   | Начать новый раунд       |
| POST  | `/api/game/answer`  | Отправить ответ           |
| POST  | `/api/game/hint`    | Запросить подсказку       |
| POST  | `/api/game/forfeit` | Сдаться                  |
| GET   | `/api/game/current` | Получить текущий раунд   |

### Статистика
| Метод | Путь                     | Описание               |
|-------|--------------------------|------------------------|
| GET   | `/api/stats/me`          | Сводная статистика     |
| GET   | `/api/stats/me/history`  | История раундов (10)   |
| GET   | `/api/stats/me/chart`    | Данные графика (7 дней)|

### Термины (admin)
| Метод  | Путь              | Описание            |
|--------|-------------------|---------------------|
| GET    | `/api/terms`      | Список терминов     |
| POST   | `/api/terms`      | Добавить термин     |
| PUT    | `/api/terms/:id`  | Изменить термин     |
| DELETE | `/api/terms/:id`  | Удалить термин      |

### Логи (admin)
| Метод  | Путь         | Описание         |
|--------|--------------|------------------|
| GET    | `/api/logs`  | Список логов     |
| DELETE | `/api/logs`  | Очистить логи    |

---

## Схема базы данных

```
users          — пользователи (id, username, email, password_hash, role)
terms          — термины (id, term, description, status: actual|deprecated|moderation)
game_rounds    — раунды (id, user_id, term_id, status, attempts_used, hint_used, ...)
system_logs    — системные события (id, level, message, created_at)
feedback       — отзывы к терминам (id, term_id, user_id, message)
```

---

## Решение проблем

**Ошибка подключения к БД:**
```
Error: connect ECONNREFUSED
```
Проверьте `DATABASE_URL` и доступность PostgreSQL-сервера.

**Сессии не сохраняются после перезапуска:**
Убедитесь, что `SESSION_SECRET` одинаков при каждом запуске сервера.

**Фронтенд показывает пустую страницу:**
Проверьте, что Nginx корректно проксирует `/api/` на Express-сервер и отдаёт `index.html` для всех остальных путей.

**Нет доступных терминов:**
В таблице `terms` должны быть записи со статусом `actual`. Проверьте через `SELECT * FROM terms WHERE status = 'actual'`.
