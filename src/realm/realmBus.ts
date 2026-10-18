/*
 * Два режима одного сайта: WebCraft (зелёный) и UpBusiness (сине-голубой).
 * Переключатель в шапке просит переход через эту шину; режиссёр перехода
 * живёт в App (там роутер и состояние сцены).
 */

export type Realm = 'wc' | 'ub'

export type RealmRequest = { target: Realm; origin: { x: number; y: number } }

let handler: ((r: RealmRequest) => void) | null = null

export function setRealmHandler(fn: ((r: RealmRequest) => void) | null) {
  handler = fn
}

/** Запрос перехода; точка origin — центр, откуда расходится свет. */
export function requestRealm(target: Realm, el?: Element | null) {
  const r = el?.getBoundingClientRect()
  const origin = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: 40 }
  handler?.({ target, origin })
}
