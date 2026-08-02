import { describe, expect, it } from 'vitest';
import { formatMinutes } from '../src/ui/format';
import { detectLocale, SUPPORTED_LOCALES, translate } from '../src/ui/i18n';

describe('localization and time formatting', () => {
  it('selects supported browser locales and falls back to English', () => {
    expect(detectLocale('ru-RU')).toBe('ru');
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale('de-DE')).toBe('de');
    expect(detectLocale('pt-PT')).toBe('pt-BR');
    expect(detectLocale('zh-Hant-HK')).toBe('zh-TW');
    expect(detectLocale('zh_CN')).toBe('zh-CN');
    expect(detectLocale('nl-NL')).toBe('en');
  });

  it('formats decimal and hours/minutes values', () => {
    expect(formatMinutes(345, 'decimal', 'en')).toBe('6 Hours');
    expect(formatMinutes(918, 'decimal', 'en')).toBe('15½ Hours');
    expect(formatMinutes(1164, 'decimal', 'en')).toBe('19½ Hours');
    expect(formatMinutes(1728, 'decimal', 'en')).toBe('29 Hours');
    expect(formatMinutes(345, 'hoursMinutes', 'ru')).toBe('5 ч 45 мин');
    expect(formatMinutes(null, 'decimal', 'en')).toBe('—');
    expect(formatMinutes(930, 'decimal', 'de')).toContain('15,5');
  });

  it('applies translated replacements', () => {
    expect(translate('updated', 'ru', { date: '18 июля' })).toBe('Обновлено 18 июля');
  });

  it('provides usable widget and time strings for every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(translate('loading', locale).trim()).not.toBe('');
      expect(translate('serviceError', locale).trim()).not.toBe('');
      expect(translate('settings', locale).trim()).not.toBe('');
      expect(formatMinutes(918, 'decimal', locale).trim()).not.toBe('');
      expect(formatMinutes(345, 'hoursMinutes', locale).trim()).not.toBe('');
    }
  });
});
