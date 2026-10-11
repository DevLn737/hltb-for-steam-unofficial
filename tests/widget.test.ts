import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/core/contracts';
import { ensureWidgetHost, renderError, renderLoading, renderResult, renderUnavailableResult } from '../src/ui/widget';

describe('Steam widget', () => {
  it('uses one Shadow DOM host and renders loading state', () => {
    const anchor = document.body.appendChild(document.createElement('aside'));
    const placement = { anchor, position: 'before' as const };
    const first = ensureWidgetHost(document, placement);
    const second = ensureWidgetHost(document, placement);
    renderLoading(first, 'en');
    expect(first).toBe(second);
    expect(document.querySelectorAll('#hltb-for-steam-unofficial')).toHaveLength(1);
    expect(first.style.getPropertyValue('margin')).toBe('0px 0px 28px');
    expect(first.style.getPropertyPriority('margin')).toBe('important');
    expect(first.shadowRoot?.textContent).toContain('Loading completion times');
  });

  it('renders the verified Trails contract and source link', () => {
    const anchor = document.body.appendChild(document.createElement('div'));
    const host = ensureWidgetHost(document, { anchor, position: 'before' });
    renderResult(host, {
      appId: '3375780', gameId: 123, requestedTitle: 'Trails in the Sky 1st Chapter', matchedTitle: 'Trails in the Sky 1st Chapter',
      mainStory: 2400, mainPlusExtras: 3420, completionist: 3480, hltbUrl: 'https://howlongtobeat.com/game/155183',
      availability: 'timed',
      changes: { mainStory: null, mainPlusExtras: null, completionist: null }, baselineUpdatedAt: null, source: 'network', updatedAt: Date.UTC(2026, 6, 18), stale: false,
    }, DEFAULT_SETTINGS, 'en',
    ['https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3375780/library_600x900_2x.jpg'],
    'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3375780/header.jpg');
    expect(host.shadowRoot?.textContent).toContain('40 Hours');
    expect(host.shadowRoot?.textContent).toContain('57 Hours');
    expect(host.shadowRoot?.textContent).toContain('58 Hours');
    expect(host.shadowRoot?.textContent).not.toContain('4.6');
    expect(host.shadowRoot?.querySelector('a')?.href).toBe('https://howlongtobeat.com/game/155183');
    expect(host.shadowRoot?.querySelector('a')?.target).toBe('_blank');
    expect(host.shadowRoot?.querySelector('a')?.rel).toBe('noopener noreferrer');
    expect(host.shadowRoot?.querySelector('img')?.src).toContain('steamstatic.com');
    expect(host.shadowRoot?.querySelector('.cover-backdrop')).not.toBeNull();
    expect(host.shadowRoot?.querySelector('.time-mainStory')).not.toBeNull();
    expect(host.shadowRoot?.textContent).not.toContain('Updated');
  });

  it('hides the snapshot check date and removes failed Steam artwork without a placeholder', () => {
    const anchor = document.body.appendChild(document.createElement('div'));
    const host = ensureWidgetHost(document, { anchor, position: 'before' });
    renderResult(host, {
      appId: '2258500', gameId: 123, requestedTitle: 'CRYMACHINA', matchedTitle: 'CRYMACHINA',
      mainStory: 930, mainPlusExtras: 1170, completionist: 1740,
      availability: 'timed',
      hltbUrl: 'https://howlongtobeat.com/?q=CRYMACHINA', source: 'snapshot',
      changes: { mainStory: null, mainPlusExtras: null, completionist: null }, baselineUpdatedAt: null,
      updatedAt: Date.UTC(2026, 6, 20), stale: false,
    }, DEFAULT_SETTINGS, 'ru',
    ['https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2258500/library_600x900_2x.jpg'],
    'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2258500/header.jpg');
    expect(host.shadowRoot?.textContent).not.toContain('Локальный снимок');
    expect(host.shadowRoot?.textContent).not.toContain('Проверено');
    expect(host.shadowRoot?.querySelector('.updated')).toBeNull();
    const image = host.shadowRoot?.querySelector('img');
    image?.dispatchEvent(new Event('error'));
    expect(host.shadowRoot?.querySelector('.artwork')).toBeNull();
    expect(host.shadowRoot?.querySelector('.result-card')?.classList).toContain('no-artwork');
    expect(host.shadowRoot?.textContent).not.toContain('HowLongToBeatHowLongToBeat');
  });

  it('renders uncertain matches as a unified gray result card', () => {
    const anchor = document.body.appendChild(document.createElement('div'));
    const host = ensureWidgetHost(document, { anchor, position: 'before' });
    renderUnavailableResult(host, 'Unknown & Game', DEFAULT_SETTINGS, 'ru',
      ['https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3181220/library_600x900_2x.jpg'],
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3181220/header.jpg');
    expect(host.shadowRoot?.querySelector('.result-card')).not.toBeNull();
    expect(host.shadowRoot?.querySelectorAll('.time.is-unavailable')).toHaveLength(3);
    expect(host.shadowRoot?.querySelectorAll('.time strong')).toHaveLength(3);
    expect([...host.shadowRoot?.querySelectorAll('.time strong') ?? []].every((value) => value.textContent === '—')).toBe(true);
    expect(host.shadowRoot?.textContent).not.toContain('Надёжное совпадение');
    expect(host.shadowRoot?.textContent).not.toContain('Обновлено');
    expect(host.shadowRoot?.querySelector('a')?.href).toContain('Unknown%20%26%20Game');
    expect(host.shadowRoot?.querySelector('a')?.target).toBe('_blank');
    expect(host.shadowRoot?.querySelector('a')?.rel).toBe('noopener noreferrer');
  });

  it('uses gray only for missing categories in a partial HLTB result', () => {
    const anchor = document.body.appendChild(document.createElement('div'));
    const host = ensureWidgetHost(document, { anchor, position: 'before' });
    renderResult(host, {
      appId: '3181220', gameId: 123, requestedTitle: 'AV Director Life!', matchedTitle: 'AV Director Life!',
      mainStory: null, mainPlusExtras: 120, completionist: null,
      availability: 'timed',
      hltbUrl: 'https://howlongtobeat.com/game/175491', source: 'network',
      changes: { mainStory: null, mainPlusExtras: null, completionist: null }, baselineUpdatedAt: null,
      updatedAt: Date.UTC(2026, 6, 28), stale: false,
    }, DEFAULT_SETTINGS, 'en');
    expect(host.shadowRoot?.querySelectorAll('.time.is-unavailable')).toHaveLength(2);
    expect(host.shadowRoot?.querySelector('.time-mainPlusExtras')?.classList).not.toContain('is-unavailable');
    expect(host.shadowRoot?.textContent).toContain('2 Hours');
  });

  it('keeps the cached fallback badge without displaying a check date', () => {
    const anchor = document.body.appendChild(document.createElement('div'));
    const host = ensureWidgetHost(document, { anchor, position: 'before' });
    renderResult(host, {
      appId: '2258500', gameId: 123, requestedTitle: 'CRYMACHINA', matchedTitle: 'CRYMACHINA',
      mainStory: 930, mainPlusExtras: 1170, completionist: 1740, availability: 'timed',
      hltbUrl: 'https://howlongtobeat.com/game/124771', source: 'cache',
      changes: { mainStory: null, mainPlusExtras: null, completionist: null }, baselineUpdatedAt: null,
      updatedAt: Date.UTC(2026, 6, 28), stale: true,
    }, DEFAULT_SETTINGS, 'en');
    expect(host.shadowRoot?.textContent).toContain('Saved result');
    expect(host.shadowRoot?.textContent).not.toContain('Checked');
    expect(host.shadowRoot?.querySelector('.updated')).toBeNull();
  });

  it('falls back to horizontal Steam artwork without distortion and then to text-only', () => {
    const anchor = document.body.appendChild(document.createElement('div'));
    const host = ensureWidgetHost(document, { anchor, position: 'before' });
    const vertical = 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3639650/library_600x900_2x.jpg';
    const header = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3639650/header.jpg';
    renderResult(host, {
      appId: '3639650', gameId: 123, requestedTitle: 'Kotama and Academy Citadel', matchedTitle: 'Kotama and Academy Citadel',
      mainStory: 590, mainPlusExtras: 996, completionist: 1126, availability: 'timed',
      hltbUrl: 'https://howlongtobeat.com/game/1', changes: { mainStory: null, mainPlusExtras: null, completionist: null }, baselineUpdatedAt: null, source: 'snapshot', updatedAt: Date.UTC(2026, 6, 22), stale: false,
    }, DEFAULT_SETTINGS, 'en', [vertical, header], header);
    const image = host.shadowRoot?.querySelector('img');
    image?.dispatchEvent(new Event('error'));
    expect(image?.src).toBe(header);
    expect(host.shadowRoot?.querySelector('.result-card')?.classList).toContain('landscape-artwork');
    expect(host.shadowRoot?.querySelector('.result-card')?.getAttribute('style')).toContain('header.jpg');
    image?.dispatchEvent(new Event('error'));
    expect(host.shadowRoot?.querySelector('.artwork')).toBeNull();
    expect(host.shadowRoot?.querySelector('.result-card')?.classList).toContain('no-artwork');
  });

  it('shows a safe network stage and status instead of hiding the cause', () => {
    const anchor = document.body.appendChild(document.createElement('div'));
    const host = ensureWidgetHost(document, { anchor, position: 'before' });
    renderError(host, 'network', 'CRYMACHINA', 'en', { stage: 'initialization', status: 403 });
    expect(host.shadowRoot?.textContent).toContain('initialization (HTTP 403)');
    expect(host.shadowRoot?.querySelector('a')?.target).toBe('_blank');
    expect(host.shadowRoot?.querySelector('a')?.rel).toBe('noopener noreferrer');
  });

  it('renders outlined change badges and hides decimal changes that round to zero', () => {
    const anchor = document.body.appendChild(document.createElement('div'));
    const host = ensureWidgetHost(document, { anchor, position: 'before' });
    renderResult(host, {
      appId: '2258500', gameId: 124_771, requestedTitle: 'CRYMACHINA', matchedTitle: 'CRYMACHINA',
      mainStory: 960, mainPlusExtras: 1170, completionist: null, availability: 'timed',
      changes: {
        mainStory: { kind: 'delta', minutes: 30 },
        mainPlusExtras: { kind: 'delta', minutes: 10 },
        completionist: { kind: 'removed', previous: 1740 },
      },
      baselineUpdatedAt: Date.UTC(2026, 6, 22), hltbUrl: 'https://howlongtobeat.com/game/124771',
      source: 'snapshot', updatedAt: Date.UTC(2026, 7, 12), stale: false,
    }, DEFAULT_SETTINGS, 'en');
    const badges = [...host.shadowRoot?.querySelectorAll('.time-change') ?? []];
    expect(badges.map((badge) => badge.textContent)).toEqual(['▲ 0.5h', 'REMOVED']);
    expect(badges[0]?.getAttribute('aria-label')).toContain('Increased');
    expect(host.shadowRoot?.querySelector('.time-change-down')).toBeNull();
  });

  it('renders NEW as a localized badge', () => {
    const anchor = document.body.appendChild(document.createElement('div'));
    const host = ensureWidgetHost(document, { anchor, position: 'before' });
    renderResult(host, {
      appId: '1', gameId: 1, requestedTitle: 'Game', matchedTitle: 'Game',
      mainStory: 60, mainPlusExtras: null, completionist: null, availability: 'timed',
      changes: { mainStory: { kind: 'new' }, mainPlusExtras: null, completionist: null },
      baselineUpdatedAt: Date.UTC(2026, 6, 22), hltbUrl: 'https://howlongtobeat.com/game/1',
      source: 'snapshot', updatedAt: Date.UTC(2026, 7, 12), stale: false,
    }, DEFAULT_SETTINGS, 'ru');
    expect(host.shadowRoot?.querySelector('.time-change-new')?.textContent).toBe('НОВОЕ');
  });

  it('opens every HLTB link in the current Steam window', () => {
    const anchor = document.body.appendChild(document.createElement('div'));
    const host = ensureWidgetHost(document, { anchor, position: 'before' });
    renderResult(host, {
      appId: '1', gameId: 1, requestedTitle: 'Game', matchedTitle: 'Game',
      mainStory: 60, mainPlusExtras: null, completionist: null, availability: 'timed',
      changes: { mainStory: null, mainPlusExtras: null, completionist: null }, baselineUpdatedAt: null,
      hltbUrl: 'https://howlongtobeat.com/game/1', source: 'snapshot', updatedAt: Date.UTC(2026, 8, 4), stale: false,
    }, DEFAULT_SETTINGS, 'en', [], null, 'steam');
    expect(host.shadowRoot?.querySelector('a')?.target).toBe('_self');
    expect(host.shadowRoot?.querySelector('a')?.hasAttribute('rel')).toBe(false);

    renderUnavailableResult(host, 'Unknown', DEFAULT_SETTINGS, 'en', [], null, 'steam');
    expect(host.shadowRoot?.querySelector('a')?.target).toBe('_self');

    renderError(host, 'network', 'Unknown', 'en', undefined, 'steam');
    expect(host.shadowRoot?.querySelector('a')?.target).toBe('_self');
  });
});
