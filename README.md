# WebCraft

Иммерсивный сайт студии WebCraft. Этап 1 — 3D-главная (ноутбук + смартфон). Этап 2 — живой сайт
на экране ноутбука, кинематографический переход в каталог и реальные страницы.

## Запуск

```bash
npm install
npm run dev        # разработка — http://localhost:5180
npm run build      # production-сборка в dist/
npm run preview    # просмотр сборки — http://localhost:5181
```

Стек: React 19 · TypeScript · Vite · three.js · @react-three/fiber · drei · postprocessing · GSAP.

## Маршруты

| Путь | Страница |
| --- | --- |
| `/` | 3D-сцена |
| `/services` | каталог (`?q=`, `?category=`, `?sort=` синхронизируются с URL) |
| `/services/:slug` | услуга |
| `/projects` | концепты (помечены как демо) |
| `/contact` | контакты (`?service=slug` предзаполняет форму) |
| `/about` | заглушка |

Роутер — `src/lib/router.tsx` (History API), таблица маршрутов — `src/lib/routes.ts`.
Для production-хостинга нужен SPA-fallback: все пути отдают `index.html`
(в `vite dev` / `vite preview` он включён по умолчанию).

## Переход «главная → каталог»

- `src/components/LaptopSite.tsx` — на экране ноутбука настоящий DOM: тот же компонент
  `ServicesPage` в режиме `preview`, ширина макета = ширине страницы.
- `src/scene/Scene.tsx` → `ScreenProjector` каждый кадр проецирует 4 угла экрана и задаёт DOM-слою
  `matrix3d` (гомография, `src/lib/homography.ts`). Canvas прозрачный, а экран ноутбука рисуется
  материалом-«окном» (`createScreenHoleMaterial`), поэтому рамка и смартфон корректно перекрывают сайт.
- `src/dive/useDiveController.ts` — таймлайн GSAP: подлёт → прокрутка сайта внутри экрана →
  приближение → стыковка 1:1 с окном → расширение → `/services` на той же прокрутке.
  Отмена: Esc, кнопка «Отменить переход», колесо вверх. Повторные нажатия игнорируются.
- `prefers-reduced-motion`, нет WebGL, сцена не готова — короткое затухание (~0.4 с).
  Слабые устройства — тот же сценарий в 1.45 раза быстрее.

## Данные

`src/data/types.ts` — модели (услуга, категория, цена, обложка, SEO, статус публикации).
`src/data/repository.ts` — единственная точка доступа; сейчас `demoSource`
(`src/data/demo/catalog.ts`, все цены — «индивидуальный расчёт»), позже — `setContentSource(apiSource)`.

## QA-параметры

- `?no-webgl` — упрощённый режим без 3D.
- `?reduce-motion` — сокращённые анимации (как при `prefers-reduced-motion`).
