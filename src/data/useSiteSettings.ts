import { settingsResource } from './repository'
import { useResource } from './useResource'
import { DEFAULT_SETTINGS } from './defaults'
import type { SiteSettings } from './types'

/** Тексты кнопок и контакты из админ-панели; до загрузки — значения по умолчанию. */
export function useSiteSettings(): SiteSettings {
  const res = useResource(settingsResource)
  return res.data ?? DEFAULT_SETTINGS
}
