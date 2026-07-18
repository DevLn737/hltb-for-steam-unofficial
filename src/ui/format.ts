import type { TimeFormat } from '../core/contracts';
import type { Locale } from './i18n';

export function formatMinutes(minutes: number | null, format: TimeFormat, locale: Locale): string {
  if (minutes === null) return '—';
  if (format === 'decimal') {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(hours) + (locale === 'ru' ? ' ч' : ' h');
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (locale === 'ru') return remainder ? `${hours} ч ${remainder} мин` : `${hours} ч`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

