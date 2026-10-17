# WebCraft — этап 1: визуальная основа

Иммерсивная главная страница студии WebCraft: 3D-сцена (ноутбук + смартфон) на React Three Fiber,
навигация, hero-блок, приближение камеры к объектам, страницы-заглушки разделов.

## Запуск

```bash
npm install
npm run dev        # разработка — http://localhost:5180
npm run build      # production-сборка в dist/
npm run preview    # просмотр сборки — http://localhost:5181
```

## Стек

React 19 · TypeScript · Vite · three.js · @react-three/fiber · @react-three/drei ·
@react-three/postprocessing · GSAP

## Структура

```
src/
  App.tsx                 композиция страницы, состояние фокуса, колесо/свайп/Esc
  components/             Navbar, Hero, FocusPanel, Hotspots, Loader, StubPage,
                          SceneFallback, ErrorBoundary, Logo
  scene/                  Scene (Canvas, камера, раскладка), Laptop, Phone,
                          Atmosphere (окружение, сетка, линии, частицы),
                          materials, screenTextures (интерфейсы экранов на canvas),
                          hotspotBridge (3D-якоря → DOM-кнопки)
  lib/                    routes (hash-роутер + конфиг маршрутов), device, theme
  hooks/                  useMediaQuery / useReducedMotion
```

## Режимы

- **Слабые устройства** (≤4 ядер, ≤2 ГБ памяти или узкий сенсорный экран): без bloom/виньетки,
  пониженный DPR, статичные тени. `PerformanceMonitor` понижает качество при просадке FPS.
- **prefers-reduced-motion**: без парящих движений, параллакса и бегущих линий; камера
  переключается почти мгновенно; CSS-анимации отключены.
- **Нет WebGL / ошибка сцены**: статичная CSS-версия композиции, интерфейс полностью рабочий.
  Проверить вручную: `http://localhost:5180/?no-webgl`.

## Маршруты

Сейчас — hash-роутер (`#/services`, `#/projects`, `#/about`, `#/contacts`, `#/brief`) с конфигом
в `src/lib/routes.ts`. На следующем этапе хук `useRoute` заменяется на react-router без
изменения компонентов навигации.
