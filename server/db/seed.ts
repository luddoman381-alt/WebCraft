import { db, json, now, tx } from './index.ts'
import { DEMO_CATEGORIES, DEMO_PROJECTS, DEMO_SERVICES } from './demo-content.ts'

/**
 * Демонстрационное наполнение. Безопасно для повторного запуска:
 * INSERT OR IGNORE добавляет только отсутствующие записи и никогда
 * не перезаписывает то, что уже отредактировано в админ-панели.
 */
export function seedDemo(log = true) {
  const t = now()
  const counts = tx(() => {
    let c = 0
    let s = 0
    let p = 0
    const cat = db.prepare(
      `INSERT OR IGNORE INTO categories (id, title, summary, description, image, sort_order, hidden, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const x of DEMO_CATEGORIES) {
      c += Number(cat.run(x.id, x.title, x.summary, x.description, x.image, x.order, x.hidden ? 1 : 0, t, t).changes)
    }
    const svc = db.prepare(
      `INSERT OR IGNORE INTO services (id, slug, title, category_id, short_description, full_description, features, benefits,
         deliverables, cover, related, pricing, terminal, seo, status, sort_order, demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    for (const x of DEMO_SERVICES) {
      s += Number(
        svc.run(
          x.id,
          x.slug,
          x.title,
          x.category,
          x.shortDescription,
          json.str(x.fullDescription),
          json.str(x.features),
          json.str(x.benefits),
          json.str(x.deliverables),
          json.str(x.cover),
          json.str(x.related),
          json.str(x.pricing),
          json.str(x.terminal),
          json.str(x.seo),
          x.status,
          x.order,
          t,
          t,
        ).changes,
      )
    }
    const prj = db.prepare(
      `INSERT OR IGNORE INTO projects (id, slug, title, summary, services, tags, cover, status, kind, url, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const x of DEMO_PROJECTS) {
      p += Number(
        prj.run(x.id, x.slug, x.title, x.summary, json.str(x.services), json.str(x.tags), json.str(x.cover), x.status, x.kind, x.url, x.order, t, t)
          .changes,
      )
    }
    return { categories: c, services: s, projects: p }
  })
  if (log) console.log(`[db] демо-наполнение: +${counts.categories} категорий, +${counts.services} услуг, +${counts.projects} проектов`)
  return counts
}

/** База пустая — ни одной категории (первый запуск). */
export const isEmpty = () => Number((db.prepare('SELECT COUNT(*) n FROM categories').get() as { n: number }).n) === 0
