import { useSyncExternalStore } from 'react'
import type { Realm } from './realmBus'

/** Идёт ли переход между режимами и куда — для подсветки переключателя. */
let state: { busy: boolean; target: Realm | null } = { busy: false, target: null }
const listeners = new Set<() => void>()

export function setRealmState(next: { busy: boolean; target: Realm | null }) {
  state = next
  listeners.forEach((l) => l())
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export const useRealmBusy = () => useSyncExternalStore(subscribe, () => state.busy)
export const useRealmTarget = () => useSyncExternalStore(subscribe, () => state.target)
