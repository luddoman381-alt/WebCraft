/*
 * Текст презентации «О студии» и расписание его печати в терминале.
 * Каждый экран терминала — набор строк; время появления каждого символа
 * рассчитывается заранее, поэтому кадр — чистая функция времени:
 * строки не дублируются и не накладываются, а повтор начинается с нуля.
 */

export type LineKind = 'prompt' | 'title' | 'text' | 'section' | 'final' | 'blank'

type Block = { kind: LineKind; text: string }

/** Группы — смысловые экраны; длинная группа сама переносится на следующий экран. */
const GROUPS: Block[][] = [
  [
    { kind: 'prompt', text: '> Initializing WebCraft...' },
    { kind: 'prompt', text: '> System founded: 2026' },
    { kind: 'prompt', text: '> Founders: RUSLAN LYACHOVICH' },
    { kind: 'prompt', text: '> VSEVOLOD ZIBOROV' },
    { kind: 'prompt', text: '> Mission: Build. Automate. Scale.' },
  ],
  [
    { kind: 'title', text: 'WEBCRAFT — DIGITAL STUDIO' },
    { kind: 'text', text: 'Мы — WebCraft, студия цифровых решений для бизнеса.' },
    {
      kind: 'text',
      text: 'Мы создаём современные сайты, веб-платформы и системы автоматизации, которые помогают компаниям привлекать клиентов, оптимизировать процессы и расти.',
    },
  ],
  [
    {
      kind: 'text',
      text: 'Мы открыты как для небольших компаний, так и для крупных проектов. Мы верим, что небольшой бизнес сегодня может стать крупным завтра, и помогаем ему строить цифровой фундамент для этого роста.',
    },
    { kind: 'text', text: 'Наш подход — не просто сделать сайт. Мы стремимся создавать работающие инструменты для развития бизнеса.' },
  ],
  [
    { kind: 'section', text: '01 / WEB DEVELOPMENT' },
    { kind: 'text', text: 'Сайты, лендинги и цифровые платформы, созданные с учётом целей бизнеса и пользовательского опыта.' },
    { kind: 'section', text: '02 / BUSINESS AUTOMATION' },
    {
      kind: 'text',
      text: 'Автоматизация отдельных задач и комплексных бизнес-процессов: обработка заявок, уведомления, интеграции и сокращение ручной работы.',
    },
  ],
  [
    { kind: 'section', text: '03 / SYSTEM INTEGRATION' },
    { kind: 'text', text: 'Объединение сайтов, CRM, мессенджеров и других сервисов в единую систему.' },
    { kind: 'section', text: '04 / AI SOLUTIONS' },
    { kind: 'text', text: 'Практическое применение ИИ для обработки информации, ускорения операций и создания новых возможностей бизнеса.' },
  ],
  [
    { kind: 'section', text: '05 / DIGITAL GROWTH' },
    {
      kind: 'text',
      text: 'Развитие цифрового присутствия компании, улучшение клиентского пути и создание инструментов, которые помогают бизнесу масштабироваться.',
    },
  ],
  [
    { kind: 'final', text: "> We don't just build websites. We build systems for growth." },
    { kind: 'final', text: '> WEBCRAFT SYSTEM: READY' },
  ],
]

/** Весь текст одной строкой — для скринридеров и режима без WebGL. */
export const TRANSCRIPT: { kind: LineKind; text: string }[] = GROUPS.flat()

/* ------------------------------------------------------------------ раскладка */

export type Row = { kind: LineKind; text: string }
export type Page = {
  rows: Row[]
  /** абсолютное время (мс от начала терминала) появления каждого символа, по строкам */
  times: number[][]
  start: number
  typedEnd: number
  end: number
}

export type TerminalLayout = { pages: Page[]; total: number }

type Measure = (text: string, kind: LineKind) => number

/** Перенос по словам в пределах ширины экрана. */
function wrap(text: string, kind: LineKind, maxWidth: number, measure: Measure): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (measure(next, kind) <= maxWidth || !cur) cur = next
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

/** Детерминированный генератор: одинаковый ритм при каждом показе. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const SPEED: Record<LineKind, number> = { prompt: 36, title: 46, text: 13, section: 28, final: 34, blank: 0 }
const PAUSE_AFTER: Record<LineKind, number> = { prompt: 280, title: 420, text: 120, section: 180, final: 520, blank: 0 }
/** пауза после законченного абзаца (последняя строка блока) */
const BLOCK_PAUSE: Record<LineKind, number> = { prompt: 0, title: 0, text: 650, section: 0, final: 0, blank: 0 }
export const PAGE_FADE = 520
export const FINAL_BLINK = 3000

export function layoutTerminal(maxWidth: number, maxRows: number, measure: Measure, reduced: boolean): TerminalLayout {
  // 1. блоки → экраны
  const pages: { rows: Row[]; blockEnds: Set<number> }[] = []
  for (const group of GROUPS) {
    let page = { rows: [] as Row[], blockEnds: new Set<number>() }
    pages.push(page)
    const wrapped = group.map((b) => wrap(b.text, b.kind, maxWidth, measure).map((t) => ({ kind: b.kind, text: t })))
    group.forEach((block, bi) => {
      const lines = wrapped[bi]
      const needGap = page.rows.length > 0 && (block.kind === 'title' || block.kind === 'section' || block.kind === 'text') && bi > 0
      // заголовок раздела переносится на новый экран вместе со своим описанием
      const keepWithNext = (block.kind === 'section' || block.kind === 'title') && bi + 1 < group.length ? wrapped[bi + 1].length + 1 : 0
      const need = lines.length + (needGap ? 1 : 0) + keepWithNext
      if (page.rows.length && page.rows.length + need > maxRows) {
        page = { rows: [], blockEnds: new Set<number>() }
        pages.push(page)
      } else if (needGap) {
        page.rows.push({ kind: 'blank', text: '' })
      }
      page.rows.push(...lines)
      page.blockEnds.add(page.rows.length - 1)
    })
  }

  // 2. расписание
  const rand = rng(2026)
  let t = 0
  const out: Page[] = pages.map((p) => {
    const start = t
    t += 220
    const times = p.rows.map((row, ri) => {
      const ts: number[] = []
      for (let i = 0; i < row.text.length; i++) {
        if (!reduced) t += SPEED[row.kind] * (0.6 + rand() * 0.8)
        ts.push(t)
      }
      t += PAUSE_AFTER[row.kind] + (p.blockEnds.has(ri) ? BLOCK_PAUSE[row.kind] : 0)
      return ts
    })
    const typedEnd = t
    const chars = p.rows.reduce((n, r) => n + r.text.length, 0)
    // время на чтение экрана: тем дольше, чем больше текста
    t += Math.min(5200, 1300 + chars * 11)
    const end = t
    t += PAGE_FADE
    return { rows: p.rows, times, start, typedEnd, end }
  })
  const last = out[out.length - 1]
  return { pages: out, total: last.typedEnd + FINAL_BLINK }
}
