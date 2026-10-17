import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { env } from '../env.ts'

/*
 * SQLite через встроенный node:sqlite: без нативных зависимостей,
 * один файл БД, транзакции, внешние ключи, WAL.
 */

mkdirSync(dirname(env.dbPath), { recursive: true })

export const db = new DatabaseSync(env.dbPath)
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 4000;')

export const now = () => new Date().toISOString()

/** Транзакция: всё или ничего. */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

const MIGRATIONS_DIR = join(import.meta.dirname, 'migrations')

/** Применяет новые миграции по порядку имён файлов. Повторный запуск безопасен. */
export function migrate(log = true): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`)
  const applied = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map((r) => r.name),
  )
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  const done: string[] = []
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    tx(() => {
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(file, now())
    })
    done.push(file)
    if (log) console.log(`[db] миграция применена: ${file}`)
  }
  return done
}

export const json = {
  parse<T>(value: unknown, fallback: T): T {
    if (typeof value !== 'string') return fallback
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  },
  str: (value: unknown) => JSON.stringify(value),
}
