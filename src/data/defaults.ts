import type { SiteSettings, TerminalInfo } from './types.ts'

/*
 * Значения по умолчанию. Общие для сайта (пока настройки не загрузились)
 * и сервера (если ключ ещё не сохранён в БД).
 */

export const DEFAULT_SETTINGS: SiteSettings = {
  contacts: {
    // ЗАПОЛНИТЕЛИ — замените в админ-панели (Настройки → Контакты)
    email: 'hello@webcraft.studio',
    phone: '',
    telegram: '@webcraft_studio',
    hours: 'пн–пт, 10:00–19:00',
    address: '',
    links: [],
  },
  cta: {
    heroPrimary: 'Исследовать услуги',
    heroSecondary: 'Посмотреть проекты',
    navButton: 'Обсудить проект',
    catalogTitle: 'Не нашли подходящую услугу?',
    catalogText: 'Расскажите о задаче — предложим решение и рассчитаем стоимость под ваш объём работ.',
    catalogButton: 'Обсудить проект',
    serviceButton: 'Обсудить проект',
    contactTitle: 'Обсудим ваш проект',
    contactLead: 'Опишите задачу в свободной форме. Ответим, уточним детали и предложим, как построить работу.',
    contactSubmit: 'Отправить заявку',
  },
}

export const EMPTY_TERMINAL: TerminalInfo = { title: '', specs: [], capabilities: [], priceText: '' }
