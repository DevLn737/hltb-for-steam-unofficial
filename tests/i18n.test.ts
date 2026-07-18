import { describe, expect, it } from 'vitest';
import { formatMinutes } from '../src/ui/format';
import { detectLocale, translate } from '../src/ui/i18n';

describe('localization and time formatting', () => {
  it('selects Russian only for Russian browser locales', () => {
    expect(detectLocale('ru-RU')).toBe('ru');
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale('de-DE')).toBe('en');
  });

  it('formats decimal and hours/minutes values', () => {
    expect(formatMinutes(345, 'decimal', 'en')).toBe('5.8 h');
    expect(formatMinutes(345, 'hoursMinutes', 'ru')).toBe('5 ч 45 мин');
    expect(formatMinutes(null, 'decimal', 'en')).toBe('—');
  });

  it('applies translated replacements', () => {
    expect(translate('updated', 'ru', { date: '18 июля' })).toBe('Обновлено 18 июля');
  });
});
