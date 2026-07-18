import type { TimeFormat } from '../core/contracts';
import type { Locale } from './i18n';

export function formatMinutes(minutes: number | null, format: TimeFormat, locale: Locale): string {
  if (minutes === null) return '—';
  if (format === 'decimal') {
    const hours = Math.round(minutes / 30) / 2;
    if (locale === 'ru') {
      return `${new Intl.NumberFormat('ru', { maximumFractionDigits: 1 }).format(hours)} ч`;
    }
    const whole = Math.floor(hours);
    const fraction = Math.round((hours - whole) * 60);
    const glyph = fraction === 30 ? '½' : '';
    const value = glyph ? `${whole || ''}${glyph}` : new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(hours);
    return `${value} ${Math.abs(hours - 1) < Number.EPSILON ? 'Hour' : 'Hours'}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (locale === 'ru') return remainder ? `${hours} ч ${remainder} мин` : `${hours} ч`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
