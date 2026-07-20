export type Locale = 'en' | 'ru';

const messages = {
  en: {
    heading: 'HowLongToBeat',
    unofficial: 'Unofficial',
    loading: 'Loading completion times…',
    mainStory: 'Main Story',
    mainPlusExtras: 'Main + Extras',
    completionist: 'Completionist',
    unavailable: '—',
    cached: 'Cached',
    stale: 'Saved result',
    updated: 'Updated {date}',
    openHltb: 'Open on HowLongToBeat',
    searchHltb: 'Search on HowLongToBeat',
    notFound: 'No confident title match was found.',
    network: 'HowLongToBeat is temporarily unavailable.',
    networkDetail: 'Failed during HLTB {stage}{status}.',
    initializationStage: 'initialization',
    searchStage: 'search',
    rateLimited: 'Too many requests. Try again later.',
    serviceError: 'The completion times could not be loaded.',
    settings: 'Settings',
    categories: 'Visible categories',
    timeFormat: 'Time format',
    decimal: 'Decimal hours',
    hoursMinutes: 'Hours and minutes',
    cacheDuration: 'Cache duration',
    oneDay: '1 day',
    sevenDays: '7 days',
    thirtyDays: '30 days',
    clearCache: 'Clear cached games',
    cacheCleared: 'Cache cleared',
    saved: 'Saved',
    saveError: 'Extension connection failed',
  },
  ru: {
    heading: 'HowLongToBeat',
    unofficial: 'Неофициально',
    loading: 'Загружаем время прохождения…',
    mainStory: 'Основной сюжет',
    mainPlusExtras: 'Сюжет + дополнения',
    completionist: 'Полное прохождение',
    unavailable: '—',
    cached: 'Из кэша',
    stale: 'Сохранённый результат',
    updated: 'Обновлено {date}',
    openHltb: 'Открыть на HowLongToBeat',
    searchHltb: 'Найти на HowLongToBeat',
    notFound: 'Надёжное совпадение названия не найдено.',
    network: 'HowLongToBeat временно недоступен.',
    networkDetail: 'Сбой на этапе HLTB: {stage}{status}.',
    initializationStage: 'инициализация',
    searchStage: 'поиск',
    rateLimited: 'Слишком много запросов. Попробуйте позже.',
    serviceError: 'Не удалось загрузить время прохождения.',
    settings: 'Настройки',
    categories: 'Показываемые категории',
    timeFormat: 'Формат времени',
    decimal: 'Десятичные часы',
    hoursMinutes: 'Часы и минуты',
    cacheDuration: 'Срок хранения кэша',
    oneDay: '1 день',
    sevenDays: '7 дней',
    thirtyDays: '30 дней',
    clearCache: 'Очистить кэш игр',
    cacheCleared: 'Кэш очищен',
    saved: 'Сохранено',
    saveError: 'Нет связи с расширением',
  },
} as const;

export type MessageKey = keyof typeof messages.en;

export function detectLocale(language = navigator.language): Locale {
  return language.toLocaleLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function translate(key: MessageKey, locale: Locale, replacements: Record<string, string> = {}): string {
  let value: string = messages[locale][key];
  for (const [name, replacement] of Object.entries(replacements)) value = value.replace(`{${name}}`, replacement);
  return value;
}
