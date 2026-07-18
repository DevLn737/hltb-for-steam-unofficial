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

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

function safeHltbUrl(value: string, expectedPath: '/game/' | '/games/'): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'howlongtobeat.com' && url.pathname.startsWith(expectedPath)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function frame(host: HTMLElement, locale: Locale, body: string, className = ''): void {
  if (!host.shadowRoot) throw new Error('Widget host has no shadow root');
  host.shadowRoot.innerHTML = `<style>${styles}</style><article class="card ${className}">${body}</article>`;
}

export function renderLoading(host: HTMLElement, locale = detectLocale()): void {
  frame(host, locale, `<header><div><strong>${translate('heading', locale)}</strong><span>${translate('unofficial', locale)}</span></div></header><p class="status loading">${translate('loading', locale)}</p>`);
}

export function renderResult(host: HTMLElement, data: GameTimes, settings: ExtensionSettings, locale = detectLocale()): void {
  const categories = [
    ['mainStory', 'mainStory', data.mainStory],
    ['mainPlusExtras', 'mainPlusExtras', data.mainPlusExtras],
    ['completionist', 'completionist', data.completionist],
  ] as const;
  const rows = categories
    .filter(([setting]) => settings.categories[setting])
    .map(([setting, label, value]) => `<div class="time time-${setting}"><span>${translate(label, locale)}</span><strong>${formatMinutes(value, settings.timeFormat, locale)}</strong></div>`)
    .join('');
  const badge = data.source === 'cache' ? `<span class="badge">${translate(data.stale ? 'stale' : 'cached', locale)}</span>` : '';
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(data.fetchedAt);
  const pageUrl = safeHltbUrl(data.hltbUrl, '/game/') ?? 'https://howlongtobeat.com/';
  const imageUrl = data.imageUrl ? safeHltbUrl(data.imageUrl, '/games/') : null;
  const cover = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="" referrerpolicy="no-referrer">`
    : `<span>${translate('heading', locale)}</span>`;
  frame(host, locale, `<div class="cover-backdrop" aria-hidden="true"></div><div class="card-shade" aria-hidden="true"></div><div class="result-layout"><figure class="cover">${cover}</figure><section class="result-content"><h2>${escapeHtml(data.matchedTitle)}</h2><div class="times">${rows}</div><footer>${badge}<span class="updated">${translate('updated', locale, { date })}</span><a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener noreferrer">${translate('openHltb', locale)} ↗</a></footer></section></div>`, 'result-card');
  if (imageUrl) host.shadowRoot?.querySelector<HTMLElement>('.result-card')?.style.setProperty('--cover-image', `url("${imageUrl.replace(/["\\]/g, '\\$&')}")`);
}

export function renderError(host: HTMLElement, error: LookupErrorCode, title: string, locale = detectLocale()): void {
  const key = error === 'not_found' ? 'notFound' : error === 'network' ? 'network' : error === 'rate_limited' ? 'rateLimited' : 'serviceError';
  const searchUrl = `https://howlongtobeat.com/?q=${encodeURIComponent(title)}`;
  frame(host, locale, `<header><div><strong>${translate('heading', locale)}</strong><span>${translate('unofficial', locale)}</span></div></header><p class="status error">${translate(key, locale)}</p><a class="search" href="${searchUrl}" target="_blank" rel="noopener noreferrer">${translate('searchHltb', locale)} ↗</a>`);
}
