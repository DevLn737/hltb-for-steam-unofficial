import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/core/contracts';
import { ensureWidgetHost, renderError, renderLoading, renderResult } from '../src/ui/widget';

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
      appId: '3375780', requestedTitle: 'Trails in the Sky 1st Chapter', matchedTitle: 'Trails in the Sky 1st Chapter',
      mainStory: 2400, mainPlusExtras: 3420, completionist: 3480, hltbUrl: 'https://howlongtobeat.com/game/155183',
      source: 'network', updatedAt: Date.UTC(2026, 6, 18), stale: false,
    }, DEFAULT_SETTINGS, 'en',
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3375780/library_600x900_2x.jpg',
    'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3375780/header.jpg');
    expect(host.shadowRoot?.textContent).toContain('40 Hours');
    expect(host.shadowRoot?.textContent).toContain('57 Hours');
    expect(host.shadowRoot?.textContent).toContain('58 Hours');
    expect(host.shadowRoot?.textContent).not.toContain('4.6');
    expect(host.shadowRoot?.querySelector('a')?.href).toBe('https://howlongtobeat.com/game/155183');
    expect(host.shadowRoot?.querySelector('img')?.src).toContain('steamstatic.com');
    expect(host.shadowRoot?.querySelector('.cover-backdrop')).not.toBeNull();
    expect(host.shadowRoot?.querySelector('.time-mainStory')).not.toBeNull();
  });

  it('shows only the snapshot update time and removes failed Steam artwork without a placeholder', () => {
    const anchor = document.body.appendChild(document.createElement('div'));
    const host = ensureWidgetHost(document, { anchor, position: 'before' });
    renderResult(host, {
      appId: '2258500', requestedTitle: 'CRYMACHINA', matchedTitle: 'CRYMACHINA',
      mainStory: 930, mainPlusExtras: 1170, completionist: 1740,
      hltbUrl: 'https://howlongtobeat.com/?q=CRYMACHINA', source: 'snapshot',
      updatedAt: Date.UTC(2026, 6, 20), stale: false,
    }, DEFAULT_SETTINGS, 'ru',
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2258500/library_600x900_2x.jpg',
    'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2258500/header.jpg');
    expect(host.shadowRoot?.textContent).not.toContain('Локальный снимок');
    expect(host.shadowRoot?.textContent).toContain('Обновлено');
    const image = host.shadowRoot?.querySelector('img');
    image?.dispatchEvent(new Event('error'));
    expect(host.shadowRoot?.querySelector('.artwork')).toBeNull();
    expect(host.shadowRoot?.querySelector('.result-card')?.classList).toContain('no-artwork');
    expect(host.shadowRoot?.textContent).not.toContain('HowLongToBeatHowLongToBeat');
  });

  it('renders a safe search link for uncertain matches', () => {
    const anchor = document.body.appendChild(document.createElement('div'));
    const host = ensureWidgetHost(document, { anchor, position: 'before' });
    renderError(host, 'not_found', 'Unknown & Game', 'ru');
    expect(host.shadowRoot?.textContent).toContain('Надёжное совпадение');
    expect(host.shadowRoot?.querySelector('a')?.href).toContain('Unknown%20%26%20Game');
  });

  it('shows a safe network stage and status instead of hiding the cause', () => {
    const anchor = document.body.appendChild(document.createElement('div'));
    const host = ensureWidgetHost(document, { anchor, position: 'before' });
    renderError(host, 'network', 'CRYMACHINA', 'en', { stage: 'initialization', status: 403 });
    expect(host.shadowRoot?.textContent).toContain('initialization (HTTP 403)');
  });
});
