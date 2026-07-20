import type { ExtensionSettings, GameTimes, LookupDiagnostic, LookupErrorCode } from '../core/contracts';
import { safeSteamArtworkUrl, type WidgetPlacement } from '../steam/page';
import { formatMinutes } from './format';
import { detectLocale, translate, type Locale } from './i18n';
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

export function renderResult(
  host: HTMLElement,
  data: GameTimes,
  settings: ExtensionSettings,
  locale = detectLocale(),
  steamArtworkUrl: string | null = null,
  steamBackdropUrl: string | null = null,
): void {
  const documentRef = host.ownerDocument;
  const article = frame(host, 'result-card');
  const backdrop = createElement(documentRef, 'div', 'cover-backdrop');
  backdrop.setAttribute('aria-hidden', 'true');
  const shade = createElement(documentRef, 'div', 'card-shade');
  shade.setAttribute('aria-hidden', 'true');
  const layout = createElement(documentRef, 'div', 'result-layout');
  const artwork = createElement(documentRef, 'figure', 'artwork');
  const pageUrl = safeHltbUrl(data.hltbUrl) ?? 'https://howlongtobeat.com/';
  const imageUrl = safeSteamArtworkUrl(steamArtworkUrl);
  const backdropUrl = safeSteamArtworkUrl(steamBackdropUrl) ?? imageUrl;

  if (imageUrl) {
    const image = createElement(documentRef, 'img');
    image.src = imageUrl;
    image.alt = data.requestedTitle;
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => {
      artwork.remove();
      article.classList.add('no-artwork');
    }, { once: true });
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
    const row = createElement(documentRef, 'div', `time time-${setting}`);
    row.append(
      createElement(documentRef, 'span', undefined, translate(label, locale)),
      createElement(documentRef, 'strong', undefined, formatMinutes(value, settings.timeFormat, locale)),
    );
    times.append(row);
  }
  content.append(times);

  const footer = createElement(documentRef, 'footer');
  if (data.source === 'cache') {
    footer.append(createElement(documentRef, 'span', 'badge', translate(data.stale ? 'stale' : 'cached', locale)));
  }
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(data.updatedAt);
  footer.append(createElement(documentRef, 'span', 'updated', translate('updated', locale, { date })));
  const link = createElement(documentRef, 'a', undefined, `${translate('openHltb', locale)} ↗`);
  link.href = pageUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  footer.append(link);
  content.append(footer);
  if (imageUrl) layout.append(artwork);
  layout.append(content);
  article.append(backdrop, shade, layout);
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
