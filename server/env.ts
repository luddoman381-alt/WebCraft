import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/*
 * Конфигурация сервера из переменных окружения (.env в корне проекта).
 * Переменные, уже заданные в окружении, имеют приоритет над файлом.
 * Секретов в коде нет: учётные данные администратора создаются через CLI.
 */

const ROOT = resolve(import.meta.dirname, '..')
const envFile = resolve(ROOT, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

const args = process.argv.slice(2)
const argValue = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const serveStatic = args.includes('--static') || process.env.SERVE_STATIC === '1'
/** --qa: отдельная база и загрузки для проверок, основная база не затрагивается */
const qa = args.includes('--qa')
const production = process.env.NODE_ENV === 'production'

export const env = {
  root: ROOT,
  production,
  port: Number(argValue('--port') ?? process.env.PORT ?? (serveStatic ? 5181 : 5190)),
  host: process.env.HOST ?? '127.0.0.1',
  qa,
  dbPath: resolve(ROOT, qa ? 'data/qa.db' : (process.env.DB_PATH ?? 'data/webcraft.db')),
  uploadDir: resolve(ROOT, qa ? 'data/qa-uploads' : (process.env.UPLOAD_DIR ?? 'data/uploads')),
  serveStatic,
  staticDir: resolve(ROOT, 'dist'),
  /** Secure-флаг cookie: включён в production; локально по http — выключен */
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === '1' : production,
  /** доверять X-Forwarded-For (только за своим reverse-proxy) */
  trustProxy: process.env.TRUST_PROXY === '1',
  /** заполнить пустую БД демонстрационным контентом при первом запуске */
  seedDemo: process.env.SEED_DEMO !== '0',
  sessionDays: Math.max(1, Number(process.env.SESSION_DAYS ?? 7)),
  /** разрешённый Origin для изменяющих запросов (за прокси/на домене); по умолчанию — host запроса */
  publicOrigin: process.env.PUBLIC_ORIGIN ?? null,
}
