import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { env } from './env.ts'
import { migrate } from './db/index.ts'
import { isEmpty, seedDemo } from './db/seed.ts'
import { admins } from './repo.ts'
import { csrfGuard, securityHeaders } from './security.ts'
import { ValidationError } from './validation.ts'
import { publicApi } from './routes/public.ts'
import { authApi } from './routes/auth.ts'
import { adminApi } from './routes/admin.ts'

/* ------------------------------------------------------------------ база */

migrate()
if (env.seedDemo && isEmpty()) seedDemo()
mkdirSync(env.uploadDir, { recursive: true })

/* ------------------------------------------------------------------ приложение */

const app = new Hono()

app.use('*', securityHeaders)
app.use('/api/*', csrfGuard)
// JSON-запросы — до 1 МБ; загрузка файлов ограничивается отдельно
app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/admin/uploads') return next()
  return bodyLimit({ maxSize: 1024 * 1024, onError: (cc) => cc.json({ error: 'too_large', message: 'Слишком большой запрос' }, 413) })(c, next)
})

app.get('/api/health', (c) => c.json({ ok: true }))
app.route('/api', publicApi)
app.route('/api/auth', authApi)
app.route('/api/admin', adminApi)
app.all('/api/*', (c) => c.json({ error: 'not_found', message: 'Метод API не найден' }, 404))

// Загруженные изображения: только файлы с безопасными именами из каталога загрузок
app.use(
  '/uploads/*',
  serveStatic({
    root: env.uploadDir,
    rewriteRequestPath: (p) => p.replace(/^\/uploads/, ''),
    onFound: (_p, c) => {
      c.header('Cache-Control', 'public, max-age=31536000, immutable')
    },
  }),
)
app.get('/uploads/*', (c) => c.notFound())

// Production: собранный фронтенд + SPA-fallback (все пути, кроме /api, отдают index.html)
if (env.serveStatic) {
  if (!existsSync(join(env.staticDir, 'index.html'))) {
    console.error('[server] нет dist/index.html — сначала выполните npm run build')
    process.exit(1)
  }
  const indexHtml = readFileSync(join(env.staticDir, 'index.html'), 'utf8')
  app.use(
    '/assets/*',
    serveStatic({
      root: normalize(env.staticDir),
      onFound: (_p, c) => {
        c.header('Cache-Control', 'public, max-age=31536000, immutable')
      },
    }),
  )
  app.use('*', serveStatic({ root: normalize(env.staticDir) }))
  app.get('*', (c) => {
    // запрос файла (есть расширение) — честный 404, а не HTML вместо устаревшего чанка
    if (/\.[a-z0-9]{1,8}$/i.test(c.req.path)) return c.text('Not found', 404)
    c.header('Cache-Control', 'no-cache')
    return c.html(indexHtml)
  })
}

app.onError((err, c) => {
  if (err instanceof ValidationError) {
    return c.json({ error: 'validation', message: err.message, fields: err.fields }, 422)
  }
  const msg = err instanceof Error ? err.message : String(err)
  if (/UNIQUE constraint failed/.test(msg)) {
    return c.json({ error: 'conflict', message: 'Запись с такими данными уже существует' }, 409)
  }
  if (/FOREIGN KEY constraint failed/.test(msg)) {
    return c.json({ error: 'conflict', message: 'Запись связана с другими данными' }, 409)
  }
  console.error('[server] ошибка:', err)
  return c.json({ error: 'server_error', message: 'Внутренняя ошибка сервера' }, 500)
})

serve({ fetch: app.fetch, port: env.port, hostname: env.host }, (info) => {
  console.log(`[server] http://${env.host}:${info.port}  (БД: ${env.dbPath}${env.serveStatic ? ', статика dist/' : ''})`)
  if (admins.count() === 0) {
    console.log('[server] администратор не создан. Создайте его командой: npm run admin:create')
  }
})
