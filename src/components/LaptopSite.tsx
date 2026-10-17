import { useLayoutEffect, useRef, useState } from 'react'
import { ServicesPage } from '../pages/ServicesPage'
import { Navbar } from './Navbar'
import { screenDom } from '../dive/diveStore'

/**
 * Ширина макета = ширине страницы: в финале перехода превью совпадает с настоящей страницей 1:1.
 * Берём фактическую ширину корня: при scrollbar-gutter: stable clientWidth не учитывает
 * зарезервированный под полосу прокрутки отступ.
 */
const layoutWidth = () => document.documentElement.getBoundingClientRect().width

/**
 * Настоящий сайт на экране 3D-ноутбука. Обычный DOM: та же страница
 * каталога, что и по адресу /services. Положение и перспективу задаёт
 * сцена (ScreenProjector) через matrix3d; canvas над ним прозрачен
 * ровно в области экрана, поэтому рамка и смартфон перекрывают сайт корректно.
 */
export function LaptopSite() {
  const [w, setW] = useState(layoutWidth)
  const h = w / 1.6
  const frame = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const page = useRef<HTMLDivElement>(null)
  const nav = useRef<HTMLDivElement>(null)
  const glass = useRef<HTMLDivElement>(null)
  const dim = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const onResize = () => setW(layoutWidth())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useLayoutEffect(() => {
    Object.assign(screenDom, {
      frame: frame.current,
      viewport: viewport.current,
      page: page.current,
      nav: nav.current,
      glass: glass.current,
      dim: dim.current,
      width: w,
      height: h,
    })
    return () => {
      Object.assign(screenDom, { frame: null, viewport: null, page: null, nav: null, glass: null, dim: null })
    }
  }, [w, h])

  return (
    <div ref={frame} className="laptop-site" style={{ width: w, height: h }} inert aria-hidden="true" data-placed="false">
      <div ref={viewport} className="laptop-site__viewport" style={{ height: h }}>
        <div ref={page} className="laptop-site__page">
          <ServicesPage preview />
        </div>
        <div ref={nav} className="laptop-site__nav">
          <Navbar preview previewCurrent="services" />
        </div>
      </div>
      <div ref={glass} className="laptop-site__glass" />
      <div ref={dim} className="laptop-site__dim" />
    </div>
  )
}
