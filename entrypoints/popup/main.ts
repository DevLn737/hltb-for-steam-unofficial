import { browser } from 'wxt/browser';
import type { CacheDurationDays, ExtensionSettings, RuntimeResponse, TimeFormat } from '../../src/core/contracts';
import { detectLocale, translate, type MessageKey } from '../../src/ui/i18n';

const locale = detectLocale();
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const labels: Record<string, MessageKey> = {
  unofficial: 'unofficial',
  'settings-title': 'settings',
  'categories-title': 'categories',
  'mainStory-label': 'mainStory',
  'mainPlusExtras-label': 'mainPlusExtras',
  'completionist-label': 'completionist',
  'time-format-label': 'timeFormat',
  'decimal-option': 'decimal',
  'hours-minutes-option': 'hoursMinutes',
  'cache-duration-label': 'cacheDuration',
  'one-day-option': 'oneDay',
  'seven-days-option': 'sevenDays',
  'thirty-days-option': 'thirtyDays',
  'clear-cache': 'clearCache',
};

for (const [id, key] of Object.entries(labels)) byId(id).textContent = translate(key, locale);
document.documentElement.lang = locale;

function readSettings(): ExtensionSettings {
  return {
    categories: {
      mainStory: byId<HTMLInputElement>('mainStory').checked,
      mainPlusExtras: byId<HTMLInputElement>('mainPlusExtras').checked,
      completionist: byId<HTMLInputElement>('completionist').checked,
    },
    timeFormat: byId<HTMLSelectElement>('timeFormat').value as TimeFormat,
    cacheDurationDays: Number(byId<HTMLSelectElement>('cacheDuration').value) as CacheDurationDays,
  };
}

function applySettings(settings: ExtensionSettings): void {
  byId<HTMLInputElement>('mainStory').checked = settings.categories.mainStory;
  byId<HTMLInputElement>('mainPlusExtras').checked = settings.categories.mainPlusExtras;
  byId<HTMLInputElement>('completionist').checked = settings.categories.completionist;
  byId<HTMLSelectElement>('timeFormat').value = settings.timeFormat;
  byId<HTMLSelectElement>('cacheDuration').value = String(settings.cacheDurationDays);
}

let noticeTimeout: ReturnType<typeof setTimeout> | undefined;
function notice(key: 'saved' | 'cacheCleared'): void {
  clearTimeout(noticeTimeout);
  byId('notice').textContent = translate(key, locale);
  noticeTimeout = setTimeout(() => { byId('notice').textContent = ''; }, 1800);
}

async function save(): Promise<void> {
  await browser.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: readSettings() });
  notice('saved');
}

document.querySelectorAll('input, select').forEach((element) => element.addEventListener('change', () => void save()));
byId<HTMLButtonElement>('clear-cache').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'CLEAR_CACHE' });
  notice('cacheCleared');
});

const response = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' }) as RuntimeResponse;
if (response.ok && 'settings' in response) applySettings(response.settings);

