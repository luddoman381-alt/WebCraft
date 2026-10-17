-- WebCraft: начальная схема

CREATE TABLE admins (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

-- В БД хранится только SHA-256 от токена сессии: утечка базы не даёт войти
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT
);
CREATE INDEX sessions_admin ON sessions(admin_id);

CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  hidden      INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Списки и вложенные объекты — JSON-колонки
CREATE TABLE services (
  id                TEXT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  category_id       TEXT NOT NULL REFERENCES categories(id) ON UPDATE CASCADE,
  short_description TEXT NOT NULL,
  full_description  TEXT NOT NULL DEFAULT '[]',
  features          TEXT NOT NULL DEFAULT '[]',
  benefits          TEXT NOT NULL DEFAULT '[]',
  deliverables      TEXT NOT NULL DEFAULT '[]',
  cover             TEXT NOT NULL,
  related           TEXT NOT NULL DEFAULT '[]',
  pricing           TEXT NOT NULL,
  terminal          TEXT NOT NULL,
  seo               TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('published', 'hidden')),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  demo              INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX services_category ON services(category_id);
CREATE INDEX services_public ON services(status, sort_order);

CREATE TABLE projects (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  summary    TEXT NOT NULL,
  services   TEXT NOT NULL DEFAULT '[]',
  tags       TEXT NOT NULL DEFAULT '[]',
  cover      TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('published', 'hidden')),
  kind       TEXT NOT NULL CHECK (kind IN ('concept', 'case')),
  url        TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE leads (
  id           INTEGER PRIMARY KEY,
  created_at   TEXT NOT NULL,
  name         TEXT NOT NULL,
  contact      TEXT NOT NULL,
  service_slug TEXT,
  message      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done', 'spam')),
  page         TEXT,
  user_agent   TEXT,
  note         TEXT NOT NULL DEFAULT ''
);
CREATE INDEX leads_created ON leads(created_at DESC);
CREATE INDEX leads_status ON leads(status);
