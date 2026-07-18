import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, type ExtensionSettings } from '../core/contracts';

const SETTINGS_KEY = 'settings:v2';

function isSettings(value: unknown): value is ExtensionSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Partial<ExtensionSettings>;
  return Boolean(
    settings.categories
      && typeof settings.categories.mainStory === 'boolean'
      && typeof settings.categories.mainPlusExtras === 'boolean'
      && typeof settings.categories.completionist === 'boolean'
      && ['decimal', 'hoursMinutes'].includes(settings.timeFormat ?? '')
      && [1, 7, 30].includes(settings.cacheDurationDays ?? 0),
  );
}

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = (await browser.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY];
  return isSettings(stored) ? stored : structuredClone(DEFAULT_SETTINGS);
}

export async function saveSettings(settings: ExtensionSettings): Promise<ExtensionSettings> {
  if (!isSettings(settings)) throw new TypeError('Invalid extension settings');
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

