import { useCallback, useEffect, useState } from 'react'

/*
 * Минимальный hash-роутер для этапа 1. Структура маршрутов вынесена в
 * конфиг, чтобы на следующем этапе заменить хук на react-router без
 * изменения компонентов навигации.
 */

export type RouteId = 'home' | 'services' | 'projects' | 'about' | 'contacts' | 'brief'

export type RouteDef = {
  id: RouteId
  path: string
  title: string
  description: string
}

export const ROUTES: Record<RouteId, RouteDef> = {
  home: { id: 'home', path: '/', title: 'Главная', description: '' },
  services: {
    id: 'services',
    path: '/services',
    title: 'Услуги',
    description: 'Разработка сайтов, каталогов, интеграций и автоматизации бизнес-процессов.',
  },
  projects: {
    id: 'projects',
    path: '/projects',
    title: 'Проекты',
    description: 'Кейсы студии: интернет-магазины, корпоративные платформы, внутренние сервисы.',
  },
  about: {
    id: 'about',
    path: '/about',
    title: 'О студии',
    description: 'Команда, подход к разработке и принципы качества WebCraft.',
  },
  contacts: {
    id: 'contacts',
    path: '/contacts',
    title: 'Контакты',
    description: 'Как с нами связаться и где мы находимся.',
  },
  brief: {
    id: 'brief',
    path: '/brief',
    title: 'Обсудить проект',
    description: 'Короткий бриф: задача, сроки, бюджет — ответим в течение рабочего дня.',
  },
}

export const NAV_ITEMS: RouteId[] = ['services', 'projects', 'about', 'contacts']

export const hrefFor = (id: RouteId) => `#${ROUTES[id].path}`

function parse(): RouteId {
  const path = window.location.hash.replace(/^#/, '') || '/'
  const found = Object.values(ROUTES).find((r) => r.path === path)
  return found ? found.id : 'home'
}

export function useRoute() {
  const [route, setRoute] = useState<RouteId>(parse)

  useEffect(() => {
    const onChange = () => setRoute(parse())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((id: RouteId) => {
    window.location.hash = ROUTES[id].path
  }, [])

  return { route, navigate }
}
