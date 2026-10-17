import { migrate } from '../db/index.ts'
import { admins } from '../repo.ts'
import { hashPassword, passwordProblems } from '../auth.ts'

/*
 * Управление администраторами из терминала (на сервере, не из браузера):
 *   npm run admin:create -- --email you@example.com
 *   npm run admin:password -- --email you@example.com
 *   npm run admin:list
 *   npm run admin:delete -- --email you@example.com
 *
 * Пароль вводится скрыто. Для автоматизации можно передать его через
 * переменную окружения ADMIN_PASSWORD (не через аргументы: они видны в истории и списке процессов).
 * Пароля по умолчанию нет.
 */

const [command, ...rest] = process.argv.slice(2)
const arg = (name: string) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : undefined
}

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    if (!stdin.isTTY) {
      // не терминал (pipe): читаем строку как есть
      let data = ''
      stdin.setEncoding('utf8')
      stdin.on('data', (d) => (data += d))
      stdin.on('end', () => resolve(data.split(/\r?\n/)[0] ?? ''))
      return
    }
    process.stdout.write(prompt)
    let value = ''
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', onData)
          process.stdout.write('\n')
          return resolve(value)
        }
        if (c === '\u0003') {
          stdin.setRawMode(false)
          process.stdout.write('\n')
          return reject(new Error('Отменено'))
        }
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1)
        else if (c >= ' ') value += c
      }
    }
    stdin.on('data', onData)
  })
}

async function askPassword(): Promise<string> {
  const fromEnv = process.env.ADMIN_PASSWORD
  if (fromEnv) {
    const problem = passwordProblems(fromEnv)
    if (problem) throw new Error(problem)
    return fromEnv
  }
  const pw = await readHidden('Пароль (не отображается): ')
  const problem = passwordProblems(pw)
  if (problem) throw new Error(problem)
  const again = await readHidden('Повторите пароль: ')
  if (pw !== again) throw new Error('Пароли не совпадают')
  return pw
}

function requireEmail(): string {
  const email = arg('email')?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Укажите email: --email you@example.com')
  }
  return email
}

async function main() {
  migrate(false)
  switch (command) {
    case 'create': {
      const email = requireEmail()
      if (admins.byEmail(email)) throw new Error(`Администратор ${email} уже существует (смена пароля: npm run admin:password)`)
      const hash = await hashPassword(await askPassword())
      admins.create(email, hash)
      console.log(`Администратор ${email} создан. Вход: /admin`)
      break
    }
    case 'password': {
      const email = requireEmail()
      const admin = admins.byEmail(email)
      if (!admin) throw new Error(`Администратор ${email} не найден`)
      admins.setPassword(admin.id, await hashPassword(await askPassword()))
      console.log(`Пароль для ${email} обновлён, все его сессии завершены.`)
      break
    }
    case 'list': {
      const list = admins.list()
      if (!list.length) console.log('Администраторов нет. Создайте: npm run admin:create -- --email you@example.com')
      for (const a of list) console.log(`${a.email}\tпоследний вход: ${a.lastLoginAt ?? '—'}`)
      break
    }
    case 'delete': {
      const email = requireEmail()
      const admin = admins.byEmail(email)
      if (!admin) throw new Error(`Администратор ${email} не найден`)
      admins.remove(admin.id)
      console.log(`Администратор ${email} удалён.`)
      break
    }
    default:
      console.log('Команды: create | password | list | delete  (--email you@example.com)')
      process.exitCode = 1
  }
}

main().catch((err: unknown) => {
  console.error(`Ошибка: ${err instanceof Error ? err.message : String(err)}`)
  process.exitCode = 1
})
