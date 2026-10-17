import { useEffect } from 'react'

const SITE = 'WebCraft'

function setMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.name = name
    document.head.appendChild(el)
  }
  el.content = content
}

/** Заголовок вкладки и meta description текущей страницы. */
export function useDocumentMeta(title: string | null, description?: string, enabled = true) {
  useEffect(() => {
    if (!enabled || !title) return
    document.title = title.includes(SITE) ? title : `${title} — ${SITE}`
    if (description) setMeta('description', description)
  }, [title, description, enabled])
}
