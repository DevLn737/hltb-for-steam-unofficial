import type { ExtensionSettings, GameTimes, LookupErrorCode } from '../core/contracts';
import { formatMinutes } from './format';
import { detectLocale, translate, type Locale } from './i18n';
import type { WidgetPlacement } from '../steam/page';
import styles from './widget.css?inline';

export const WIDGET_ID = 'hltb-for-steam-unofficial';

export function ensureWidgetHost(documentRef: Document, placement: WidgetPlacement): HTMLElement {
  const host = documentRef.getElementById(WIDGET_ID) ?? documentRef.createElement('section');
  if (!host.id) {
    host.id = WIDGET_ID;
    host.setAttribute('aria-live', 'polite');
    host.attachShadow({ mode: 'open' });
  }

  const { anchor, position } = placement;
  const parent = anchor.parentNode;
  if (!parent) throw new Error('Widget anchor has no parent');
  if (position === 'before') {
    if (host.parentNode !== parent || host.nextSibling !== anchor) parent.insertBefore(host, anchor);
  } else if (host.parentNode !== parent || anchor.nextSibling !== host) {
    parent.insertBefore(host, anchor.nextSibling);
  }
  return host;
}

function frame(host: HTMLElement, locale: Locale, body: string): void {
  if (!host.shadowRoot) throw new Error('Widget host has no shadow root');
  host.shadowRoot.innerHTML = `<style>${styles}</style><article class="card"><header><div><strong>${translate('heading', locale)}</strong><span>${translate('unofficial', locale)}</span></div></header>${body}</article>`;
}

export function renderLoading(host: HTMLElement, locale = detectLocale()): void {
  frame(host, locale, `<p class="status loading">${translate('loading', locale)}</p>`);
}

export function renderResult(host: HTMLElement, data: GameTimes, settings: ExtensionSettings, locale = detectLocale()): void {
  const categories = [
    ['mainStory', 'mainStory', data.mainStory],
    ['mainPlusExtras', 'mainPlusExtras', data.mainPlusExtras],
    ['completionist', 'completionist', data.completionist],
  ] as const;
  const rows = categories
    .filter(([setting]) => settings.categories[setting])
    .map(([, label, value]) => `<div class="time"><span>${translate(label, locale)}</span><strong>${formatMinutes(value, settings.timeFormat, locale)}</strong></div>`)
    .join('');
  const badge = data.source === 'cache' ? `<span class="badge">${translate(data.stale ? 'stale' : 'cached', locale)}</span>` : '';
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(data.fetchedAt);
  frame(host, locale, `<div class="times">${rows}</div><footer>${badge}<span>${translate('updated', locale, { date })}</span><a href="${data.hltbUrl}" target="_blank" rel="noopener noreferrer">${translate('openHltb', locale)} ↗</a></footer>`);
}

export function renderError(host: HTMLElement, error: LookupErrorCode, title: string, locale = detectLocale()): void {
  const key = error === 'not_found' ? 'notFound' : error === 'network' ? 'network' : error === 'rate_limited' ? 'rateLimited' : 'serviceError';
  const searchUrl = `https://howlongtobeat.com/?q=${encodeURIComponent(title)}`;
  frame(host, locale, `<p class="status error">${translate(key, locale)}</p><a class="search" href="${searchUrl}" target="_blank" rel="noopener noreferrer">${translate('searchHltb', locale)} ↗</a>`);
}
