import { lazy, Suspense } from 'react'
import App from './App'
import { appPath, useRouter } from './lib/router'
import { catalogResource, settingsResource } from './data/repository'

// Админ-панель — отдельный чанк: посетители сайта его не загружают
const AdminApp = lazy(() => import('./admin/AdminApp'))

const isAdminPath = (p: string) => p === '/admin' || p.startsWith('/admin/')

// данные сайта запрашиваются сразу, параллельно с загрузкой интерфейса
if (!isAdminPath(appPath())) {
  catalogResource()
  settingsResource()
}

export function Root() {
  const { location } = useRouter()
  if (isAdminPath(location.pathname)) {
    return (
      <Suspense fallback={<div className="admin-boot" aria-label="Загрузка панели" />}>
        <AdminApp />
      </Suspense>
    )
  }
  return <App />
}
