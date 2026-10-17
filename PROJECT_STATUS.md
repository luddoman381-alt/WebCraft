# WebCraft — состояние проекта

Документ для продолжения работы в новом сеансе без чтения истории переписки.
Обновлён: 2026-10-17, после этапа 3.

> Проект находится в `webcraft/` внутри `business-leads-parser/`. Родительская папка —
> **другой** Python/Streamlit-проект (парсер лидов): его не трогать.
> Работа идёт по этапам; следующий этап начинать только после подтверждения владельца.

## Этапы

| Этап | Тег git | Что сделано |
| --- | --- | --- |
| 1 | `stage-1` | 3D-главная: процедурные ноутбук и смартфон (R3F), свет, сетка, навигация, hero, хотспоты, загрузчик, fallback без WebGL, reduced-motion |
| 2 | `stage-2` | Живой DOM-каталог на экране ноутбука (гомография `matrix3d` + прозрачное «окно» в canvas), GSAP-переход «главная → /services» с отменой, роутер на History API, страницы каталога/услуги/проектов/контактов/404 |
| 3 | `stage-3` | Сервер Node + SQLite, миграции, сид, серверная валидация; аутентификация администратора; админ-панель `/admin`; заявки с сайта; настройки сайта из БД; терминальный hover-эффект карточек каталога |

Откат к этапу: `git checkout stage-2` (только для просмотра) или `git diff stage-2..stage-3`.

## Технологии

- Frontend: React 19, TypeScript, Vite 8, three.js, @react-three/fiber, drei, postprocessing, GSAP.
- Backend: **Node ≥ 24** (TypeScript запускается напрямую, без сборки), встроенный `node:sqlite`,
  Hono + @hono/node-server. Хеши паролей — `node:crypto` scrypt.
- Без внешней СУБД и без лишних зависимостей.

## Структура

```
webcraft/
  index.html, vite.config.ts        прокси /api и /uploads → API (changeOrigin: false — важно для CSRF)
  scripts/dev.mjs                   npm run dev: API (--watch) + Vite
  server/
    index.ts                        Hono: /api, /uploads, dist + SPA-fallback (--static)
    env.ts                          конфиг из .env; флаги --static, --qa, --port
    db/index.ts                     SQLite (WAL, FK), раннер миграций
    db/migrations/001_init.sql      схема: admins, sessions, categories, services, projects, settings, leads
    db/seed.ts, demo-content.ts     демо-наполнение (INSERT OR IGNORE, только недостающее)
    repo.ts                         доступ к данным
    validation.ts                   валидация (ошибки по полям → 422)
    auth.ts, security.ts            сессии, requireAdmin, CSRF, лимиты, заголовки/CSP
    routes/public.ts|auth.ts|admin.ts
    cli/admin.ts, cli/db.ts
  src/
    main.tsx → Root.tsx             /admin → ленивый AdminApp, иначе публичный App
    App.tsx                         публичное приложение, сцена, переход в каталог
    lib/router.tsx, routes.ts       History-роутер и таблица маршрутов
    dive/                           состояние и режиссура перехода
    scene/                          3D (Scene, Laptop, Phone, Atmosphere…)
    pages/                          Services, Service, Projects, Contact, NotFound
    components/catalog/             ServiceCard, TerminalLayer, PriceTag, ServiceCover
    data/types.ts                   модели (общие для сайта, панели и сервера)
    data/repository.ts, http.ts     публичное API + кэш
    data/defaults.ts                значения настроек по умолчанию (общие с сервером)
    admin/                          AdminApp, api.ts, ui.tsx, pages/*, admin.css
  data/                             НЕ в git: webcraft.db, qa.db, uploads/, qa-admin.local.json
```

## Команды

```bash
cd webcraft
npm install
npm run admin:create -- --email you@example.com   # первый администратор (см. ниже)
npm run dev          # сайт http://localhost:5180, API http://127.0.0.1:5190
npm run build        # tsc -b (фронтенд + сервер) + vite build
npm start            # production: dist + API на http://127.0.0.1:5181
npm run lint         # oxlint (0 ошибок, ~32 предупреждения стиля)
npm run db:migrate   # применить новые миграции
npm run db:seed      # добавить недостающие демо-записи
npm run dev:qa       # то же, что dev, но база data/qa.db
npm run start:qa     # production на data/qa.db
```

Конфигурация — `.env` по образцу `.env.example` (`.env` не коммитится). Порт API в dev —
`API_PORT` (по умолчанию 5190), а не `PORT`.

## База данных

- Файл: `data/webcraft.db` (SQLite, WAL). Создаётся автоматически; миграции применяются при
  старте сервера и CLI (таблица `schema_migrations`).
- Миграции: одна — `001_init.sql`. Новые изменения схемы — только новым файлом `002_*.sql`.
- Пустая база при первом запуске сервера заполняется демо-контентом (`SEED_DEMO=0` — отключить).
- Основная база на момент записи: схема создана, **администратора нет**, демо-контент
  появится при первом `npm run dev`/`npm start`.
- `data/qa.db` — тестовая база для проверок (содержит тестового администратора, тестовую заявку).
  Учётные данные тестового администратора — `data/qa-admin.local.json` (только для qa.db).
- Резервная копия: копия файла БД при остановленном сервере.

## Первый администратор

Пароля по умолчанию нет. На машине с проектом:

```bash
npm run admin:create -- --email you@example.com
```

Пароль вводится скрыто, минимум 12 символов, хранится как scrypt-хеш. Затем вход на `/admin`.
Смена пароля: `npm run admin:password -- --email …` (завершает сессии). Не передавайте пароль
аргументом командной строки; для автоматизации — переменная `ADMIN_PASSWORD`.

## Что проверено (этап 3, в браузере)

Вход/выход, 401 без сессии, 403 без CSRF-заголовка и с чужим Origin, лимит входа (429),
создание → редактирование → публикация → удаление услуги с отражением в каталоге, скрытие и
восстановление категории, тексты кнопок из настроек, заявка из формы → панель (поиск, статус),
загрузка PNG и отклонение поддельных файлов/SVG, сохранение данных после перезапуска,
терминальный эффект (мышь, клавиатура, тап на мобильном, повторное наведение без дублей),
прямые URL и переход из 3D-сцены в production-сборке.

## Известные проблемы и незавершённое

- Однажды в dev статус заявки после перезапуска оказался прежним; повторить не удалось
  (3 попытки через API и UI с перезапусками — статус сохраняется). Стоит перепроверить.
- `prefers-reduced-motion` проверялся через QA-параметр `?reduce-motion`, а не системной настройкой.
- Отправка заявок не уведомляет менеджера (нет email/Telegram-уведомлений).
- Контакты в настройках — заполнители (`hello@webcraft.studio`, `@webcraft_studio`) — заменить в `/admin`.
- Каталог и портфолио — демонстрационные записи; заменить реальным контентом.
- Страница «О студии» — заглушка, не редактируется из панели.
- Нет управления несколькими администраторами из UI (только CLI), нет журнала действий.
- Загруженные изображения не удаляются с диска при удалении записей.
- Лимиты запросов хранятся в памяти процесса (сбрасываются при перезапуске; на несколько
  процессов не рассчитаны).
- Нет автотестов (проверки выполнялись вручную в браузере).
- Хостинг/деплой не настраивался; для публикации нужен HTTPS-прокси и SPA-fallback (есть в `npm start`).

## Рекомендуемый следующий этап (после подтверждения владельца)

1. Уведомления о новых заявках (email или Telegram-бот) и экспорт заявок в CSV.
2. Редактируемая страница «О студии» и SEO: sitemap.xml, robots.txt, Open Graph.
3. Автотесты API (node:test) для аутентификации, валидации и CRUD.
4. Подготовка к деплою: Dockerfile или инструкция для VPS (nginx + HTTPS), резервное копирование БД.

## Как продолжить в новом сеансе

Прочитать этот файл и `README.md`, затем `git log --oneline` и `git status`.
Запуск для проверки: `npm run dev:qa` (не трогает основную базу).
