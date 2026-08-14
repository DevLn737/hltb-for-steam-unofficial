import type { ExtensionSettings, GameTimes, LookupDiagnostic, LookupErrorCode } from '../core/contracts';
import { safeSteamArtworkUrl, type WidgetPlacement } from '../steam/page';
import { formatMinutes } from './format';
import { detectLocale, translate, type Locale } from './i18n';
import { describeTimeChange } from './time-change';
import styles from './widget.css?inline';

export const WIDGET_ID = 'hltb-for-steam-unofficial';

export function ensureWidgetHost(documentRef: Document, placement: WidgetPlacement): HTMLElement {
  const host = documentRef.getElementById(WIDGET_ID) ?? documentRef.createElement('section');
  if (!host.id) {
    host.id = WIDGET_ID;
    host.setAttribute('aria-live', 'polite');
    host.style.setProperty('display', 'block', 'important');
    host.style.setProperty('margin', '0 0 28px', 'important');
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

function safeHltbUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'howlongtobeat.com'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  documentRef: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = documentRef.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function frame(host: HTMLElement, className = ''): HTMLElement {
  if (!host.shadowRoot) throw new Error('Widget host has no shadow root');
  const documentRef = host.ownerDocument;
  const style = createElement(documentRef, 'style');
  style.textContent = styles;
  const article = createElement(documentRef, 'article', `card ${className}`.trim());
  host.shadowRoot.replaceChildren(style, article);
  return article;
}

function appendHeader(article: HTMLElement, locale: Locale): void {
  const documentRef = article.ownerDocument;
  const header = createElement(documentRef, 'header');
  const row = createElement(documentRef, 'div');
  row.append(
    createElement(documentRef, 'strong', undefined, translate('heading', locale)),
    createElement(documentRef, 'span', undefined, translate('unofficial', locale)),
  );
  header.append(row);
  article.append(header);
}

export function renderLoading(host: HTMLElement, locale = detectLocale()): void {
  const article = frame(host);
  appendHeader(article, locale);
  article.append(createElement(article.ownerDocument, 'p', 'status loading', translate('loading', locale)));
}

interface TimeCardData {
  requestedTitle: string;
  matchedTitle: string;
  mainStory: number | null;
  mainPlusExtras: number | null;
  completionist: number | null;
  changes: GameTimes['changes'];
  baselineUpdatedAt: number | null;
  hltbUrl: string;
  source: GameTimes['source'] | 'unavailable';
  updatedAt: number | null;
  stale: boolean;
}

function renderTimeCard(
  host: HTMLElement,
  data: TimeCardData,
  settings: ExtensionSettings,
  locale: Locale,
  steamArtworkUrls: readonly string[],
  steamBackdropUrl: string | null,
): void {
  const documentRef = host.ownerDocument;
  const unavailable = data.source === 'unavailable';
  const article = frame(host, `result-card${unavailable ? ' unavailable-card' : ''}`);
  const backdrop = createElement(documentRef, 'div', 'cover-backdrop');
  backdrop.setAttribute('aria-hidden', 'true');
  const shade = createElement(documentRef, 'div', 'card-shade');
  shade.setAttribute('aria-hidden', 'true');
  const layout = createElement(documentRef, 'div', 'result-layout');
  const artwork = createElement(documentRef, 'figure', 'artwork');
  const imageUrls = [...new Set(steamArtworkUrls.map(safeSteamArtworkUrl).filter((value): value is string => value !== null))];
  const backdropUrl = safeSteamArtworkUrl(steamBackdropUrl) ?? imageUrls[0] ?? null;

  if (imageUrls.length > 0) {
    const image = createElement(documentRef, 'img');
    image.alt = data.requestedTitle;
    image.referrerPolicy = 'no-referrer';
    let imageIndex = 0;
    const selectImage = (index: number) => {
      imageIndex = index;
      image.src = imageUrls[index]!;
      article.classList.toggle('landscape-artwork', index > 0);
      if (index > 0) article.style.setProperty('--cover-image', `url("${imageUrls[index]!.replace(/["\\]/g, '\\$&')}")`);
    };
    image.addEventListener('error', () => {
      if (imageIndex + 1 < imageUrls.length) {
        selectImage(imageIndex + 1);
        return;
      }
      artwork.remove();
      article.classList.add('no-artwork');
      article.classList.remove('landscape-artwork');
      article.style.removeProperty('--cover-image');
    });
    selectImage(0);
    artwork.append(image);
  } else {
    article.classList.add('no-artwork');
  }
  if (backdropUrl) article.style.setProperty('--cover-image', `url("${backdropUrl.replace(/["\\]/g, '\\$&')}")`);

  const content = createElement(documentRef, 'section', 'result-content');
  content.append(createElement(documentRef, 'h2', undefined, data.matchedTitle));
  const times = createElement(documentRef, 'div', 'times');
  const categories = [
    ['mainStory', 'mainStory', data.mainStory],
    ['mainPlusExtras', 'mainPlusExtras', data.mainPlusExtras],
    ['completionist', 'completionist', data.completionist],
  ] as const;
  for (const [setting, label, value] of categories) {
    if (!settings.categories[setting]) continue;
    const row = createElement(documentRef, 'div', `time time-${setting}${value === null ? ' is-unavailable' : ''}`);
    const labelElement = createElement(documentRef, 'span');
    labelElement.append(createElement(documentRef, 'span', 'time-label-text', translate(label, locale)));
    const change = describeTimeChange(data.changes[setting], settings.timeFormat, locale, data.baselineUpdatedAt);
    if (change) {
      const badge = createElement(documentRef, 'small', `time-change time-change-${change.tone}`, change.text);
      badge.title = change.description;
      badge.setAttribute('aria-label', change.description);
      labelElement.append(badge);
    }
    row.append(
      labelElement,
      createElement(documentRef, 'strong', undefined, formatMinutes(value, settings.timeFormat, locale)),
    );
    times.append(row);
  }
  content.append(times);

  const footer = createElement(documentRef, 'footer');
  if (!unavailable && data.updatedAt !== null && data.source !== 'network') {
    const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(data.updatedAt);
    if (data.source === 'snapshot') {
      footer.append(createElement(documentRef, 'span', 'updated', translate('checked', locale, { date })));
    } else {
      footer.append(createElement(documentRef, 'span', 'badge', translate(data.stale ? 'stale' : 'cached', locale)));
      footer.append(createElement(documentRef, 'span', 'updated', translate('checked', locale, { date })));
    }
  }
  const link = createElement(documentRef, 'a', undefined, `${translate(unavailable ? 'searchHltb' : 'openHltb', locale)} ↗`);
  link.href = safeHltbUrl(data.hltbUrl) ?? 'https://howlongtobeat.com/';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  footer.append(link);
  content.append(footer);
  if (imageUrls.length > 0) layout.append(artwork);
  layout.append(content);
  article.append(backdrop, shade, layout);
}

export function renderResult(
  host: HTMLElement,
  data: GameTimes,
  settings: ExtensionSettings,
  locale = detectLocale(),
  steamArtworkUrls: readonly string[] = [],
  steamBackdropUrl: string | null = null,
): void {
  renderTimeCard(host, data, settings, locale, steamArtworkUrls, steamBackdropUrl);
}

export function renderUnavailableResult(
  host: HTMLElement,
  title: string,
  settings: ExtensionSettings,
  locale = detectLocale(),
  steamArtworkUrls: readonly string[] = [],
  steamBackdropUrl: string | null = null,
): void {
  renderTimeCard(host, {
    requestedTitle: title,
    matchedTitle: title,
    mainStory: null,
    mainPlusExtras: null,
    completionist: null,
    changes: { mainStory: null, mainPlusExtras: null, completionist: null },
    baselineUpdatedAt: null,
    hltbUrl: `https://howlongtobeat.com/?q=${encodeURIComponent(title)}`,
    source: 'unavailable',
    updatedAt: null,
    stale: false,
  }, settings, locale, steamArtworkUrls, steamBackdropUrl);
}

export function renderError(
  host: HTMLElement,
  error: LookupErrorCode,
  title: string,
  locale = detectLocale(),
  diagnostic?: LookupDiagnostic,
): void {
  const documentRef = host.ownerDocument;
  const article = frame(host);
  appendHeader(article, locale);
  const key = error === 'not_found' ? 'notFound' : error === 'network' ? 'network' : error === 'rate_limited' ? 'rateLimited' : 'serviceError';
  article.append(createElement(documentRef, 'p', 'status error', translate(key, locale)));
  if (error === 'network' && diagnostic) {
    article.append(createElement(documentRef, 'p', 'diagnostic', translate('networkDetail', locale, {
      stage: translate(diagnostic.stage === 'initialization' ? 'initializationStage' : 'searchStage', locale),
      status: diagnostic.status === undefined ? '' : ` (HTTP ${diagnostic.status})`,
    })));
  }
  const link = createElement(documentRef, 'a', 'search', `${translate('searchHltb', locale)} ↗`);
  link.href = `https://howlongtobeat.com/?q=${encodeURIComponent(title)}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  article.append(link);
}
