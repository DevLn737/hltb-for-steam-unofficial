import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, type ExtensionSettings } from '../core/contracts';
import { isExtensionSettings } from '../core/runtime-validation';

const SETTINGS_KEY = 'settings:v2';

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = (await browser.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY];
  return isExtensionSettings(stored) ? stored : structuredClone(DEFAULT_SETTINGS);
}

export async function saveSettings(settings: ExtensionSettings): Promise<ExtensionSettings> {
  if (!isExtensionSettings(settings)) throw new TypeError('Invalid extension settings');
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}
