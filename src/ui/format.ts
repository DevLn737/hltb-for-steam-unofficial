import type { TimeFormat } from '../core/contracts';
import type { Locale } from './i18n';

export function formatMinutes(minutes: number | null, format: TimeFormat, locale: Locale): string {
  if (minutes === null) return '—';
  if (format === 'decimal') {
    const hours = Math.round(minutes / 30) / 2;
    if (locale === 'ru' || locale === 'uk') {
      return `${new Intl.NumberFormat('ru', { maximumFractionDigits: 1 }).format(hours)} ч`;
    }
    if (locale === 'en') {
      const whole = Math.floor(hours);
      const fraction = Math.round((hours - whole) * 60);
      const glyph = fraction === 30 ? '½' : '';
      const value = glyph ? `${whole || ''}${glyph}` : new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(hours);
      return `${value} ${Math.abs(hours - 1) < Number.EPSILON ? 'Hour' : 'Hours'}`;
    }
    return new Intl.NumberFormat(locale, {
      style: 'unit', unit: 'hour', unitDisplay: 'long', maximumFractionDigits: 1,
    }).format(hours);
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (locale === 'ru' || locale === 'uk') return remainder ? `${hours} ч ${remainder} мин` : `${hours} ч`;
  if (locale === 'en') return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  const formattedHours = new Intl.NumberFormat(locale, { style: 'unit', unit: 'hour', unitDisplay: 'short' }).format(hours);
  const formattedMinutes = new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute', unitDisplay: 'short' }).format(remainder);
  return remainder ? `${formattedHours} ${formattedMinutes}` : formattedHours;
}
