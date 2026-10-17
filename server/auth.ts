import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { env } from './env.ts'
import { admins, sessions, type Admin } from './repo.ts'

/*
 * Аутентификация администратора.
 *  - пароль: scrypt (N=2^15, r=8, p=1) с солью 16 байт, сравнение за постоянное время;
 *  - сессия: случайный токен 32 байта в httpOnly-cookie, в БД — только SHA-256 от него;
 *  - cookie SameSite=Strict, Secure в production.
 */

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 64 }
const scrypt = (pw: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((res, rej) => scryptCb(pw, salt, keylen, opts, (err, key) => (err ? rej(err) : res(key))))
const scryptOpts = (N: number, r: number, p: number): ScryptOptions => ({ N, r, p, maxmem: 128 * N * r * 2 })

export const PASSWORD_MIN = 12

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, SCRYPT.keylen, scryptOpts(SCRYPT.N, SCRYPT.r, SCRYPT.p))
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, keyB64] = stored.split('$')
  if (algo !== 'scrypt' || !saltB64 || !keyB64) return false
  const expected = Buffer.from(keyB64, 'base64')
  const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, scryptOpts(Number(n), Number(r), Number(p)))
  return key.length === expected.length && timingSafeEqual(key, expected)
}

/** Хеш-пустышка: вход с несуществующим email занимает столько же времени. */
let dummyHash: Promise<string> | null = null
export const timingDummy = () => (dummyHash ??= hashPassword(randomBytes(16).toString('hex')))

export function passwordProblems(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Пароль должен быть не короче ${PASSWORD_MIN} символов`
  if (pw.length > 256) return 'Слишком длинный пароль'
  if (/^(.)\1+$/.test(pw)) return 'Пароль из одного повторяющегося символа'
  return null
}

/* ------------------------------------------------------------------ сессии */

export const SESSION_COOKIE = 'wc_session'
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export function startSession(c: Context, admin: Admin) {
  sessions.purgeExpired()
  const token = randomBytes(32).toString('base64url')
  const maxAge = env.sessionDays * 24 * 3600
  const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString()
  sessions.create(sha256(token), admin.id, expiresAt, c.req.header('user-agent')?.slice(0, 300) ?? null)
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'Strict',
    path: '/',
    maxAge,
  })
}

export function endSession(c: Context) {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) sessions.remove(sha256(token))
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: env.cookieSecure })
}

export function currentAdmin(c: Context): Admin | null {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token || token.length > 100) return null
  const hash = sha256(token)
  const s = sessions.find(hash)
  if (!s) return null
  if (new Date(s.expiresAt).getTime() < Date.now()) {
    sessions.remove(hash)
    return null
  }
  return admins.byId(s.adminId)
}

export type AuthVars = { Variables: { admin: Admin } }

/** Закрывает маршрут для всех, кроме вошедшего администратора. */
export const requireAdmin: MiddlewareHandler<AuthVars> = async (c, next) => {
  const admin = currentAdmin(c)
  if (!admin) return c.json({ error: 'unauthorized', message: 'Требуется вход в админ-панель' }, 401)
  c.set('admin', admin)
  c.header('Cache-Control', 'no-store')
  await next()
}
