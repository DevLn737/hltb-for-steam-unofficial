import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const requiredKeys = [
  'extensionName',
  'extensionShortName',
  'extensionDescription',
  'extensionActionTitle',
] as const;
const locales = ['en', 'ru', 'de', 'fr', 'es', 'pt_BR', 'it', 'pl', 'uk', 'tr', 'ja', 'ko', 'zh_CN', 'zh_TW'];

type Messages = Record<string, { message?: unknown; description?: unknown }>;

async function loadMessages(locale: string): Promise<Messages> {
  return JSON.parse(await readFile(`public/_locales/${locale}/messages.json`, 'utf8')) as Messages;
}

describe('extension manifest localization', () => {
  it('provides complete English and Russian catalogs', async () => {
    const catalogs = await Promise.all(locales.map(loadMessages));
    for (const catalog of catalogs) {
      expect(Object.keys(catalog).sort()).toEqual([...requiredKeys].sort());
      for (const key of requiredKeys) {
        expect(catalog[key]?.message).toEqual(expect.any(String));
        expect(String(catalog[key]?.message).trim()).not.toBe('');
      }
    }
  });

  it('keeps store-facing localized strings within Chrome limits', async () => {
    for (const locale of locales) {
      const messages = await loadMessages(locale);
      expect(String(messages.extensionName?.message).length).toBeLessThanOrEqual(75);
      expect(String(messages.extensionDescription?.message).length).toBeLessThanOrEqual(132);
    }
  });
});
