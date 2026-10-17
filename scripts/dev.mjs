// Запуск разработки: API-сервер (с перезапуском при изменениях) + Vite.
//   npm run dev      — основная база data/webcraft.db
//   npm run dev:qa   — отдельная база для проверок data/qa.db
import { spawn } from 'node:child_process'

const qa = process.argv.includes('--qa')
// порт API задаётся отдельно от PORT (его может выставлять окружение для Vite)
const apiPort = process.env.API_PORT ?? '5190'
const env = { ...process.env, API_PORT: apiPort }

const procs = [
  spawn(process.execPath, ['--watch-path=server', '--watch-path=src/data', 'server/index.ts', '--port', apiPort, ...(qa ? ['--qa'] : [])], { stdio: 'inherit', env }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit', env }),
]

const stop = () => {
  for (const p of procs) p.kill()
  process.exit()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
for (const p of procs) p.on('exit', (code) => code && code !== 0 && stop())
