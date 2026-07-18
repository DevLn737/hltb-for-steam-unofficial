import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/core/contracts';
import { ensureWidgetHost, renderError, renderLoading, renderResult } from '../src/ui/widget';

describe('Steam widget', () => {
  it('uses one Shadow DOM host and renders loading state', () => {
    const anchor = document.body.appendChild(document.createElement('aside'));
    const first = ensureWidgetHost(document, anchor);
    const second = ensureWidgetHost(document, anchor);
    renderLoading(first, 'en');
    expect(first).toBe(second);
    expect(document.querySelectorAll('#hltb-for-steam-unofficial')).toHaveLength(1);
    expect(first.shadowRoot?.textContent).toContain('Loading completion times');
  });

  it('renders the verified Trails contract and source link', () => {
    const host = ensureWidgetHost(document, document.body);
    renderResult(host, {
      appId: '3375780', requestedTitle: 'Trails in the Sky 1st Chapter', matchedTitle: 'Trails in the Sky 1st Chapter',
      mainStory: 2400, mainPlusExtras: 3420, completionist: 3480, hltbUrl: 'https://howlongtobeat.com/game/155183',
      source: 'network', fetchedAt: Date.UTC(2026, 6, 18), stale: false,
    }, DEFAULT_SETTINGS, 'en');
    expect(host.shadowRoot?.textContent).toContain('40 h');
    expect(host.shadowRoot?.textContent).toContain('57 h');
    expect(host.shadowRoot?.textContent).toContain('58 h');
    expect(host.shadowRoot?.textContent).not.toContain('4.6');
    expect(host.shadowRoot?.querySelector('a')?.href).toBe('https://howlongtobeat.com/game/155183');
  });

  it('renders a safe search link for uncertain matches', () => {
    const host = ensureWidgetHost(document, document.body);
    renderError(host, 'not_found', 'Unknown & Game', 'ru');
    expect(host.shadowRoot?.textContent).toContain('Надёжное совпадение');
    expect(host.shadowRoot?.querySelector('a')?.href).toContain('Unknown%20%26%20Game');
  });
});
