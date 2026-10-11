import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, type GameTimes, type RuntimeRequest } from '../src/core/contracts';
import { WIDGET_ID } from '../src/ui/widget';
import type * as SteamPage from '../src/steam/page';

vi.mock('../src/steam/page', async (importOriginal) => ({
  ...await importOriginal<typeof SteamPage>(),
  extractSteamGamePage: () => ({ appId: '3321460', title: 'Crimson Desert', artworkUrls: [], backdropUrl: null }),
}));

const game: GameTimes = {
  appId: '3321460', gameId: 106_171, requestedTitle: 'Crimson Desert', matchedTitle: 'Crimson Desert',
  mainStory: 60, mainPlusExtras: 120, completionist: 180,
  changes: { mainStory: null, mainPlusExtras: null, completionist: null }, baselineUpdatedAt: null,
  availability: 'timed', hltbUrl: 'https://howlongtobeat.com/game/106171', source: 'snapshot',
  updatedAt: Date.UTC(2026, 6, 22), stale: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.stubGlobal('defineContentScript', (definition: unknown) => definition);
  vi.spyOn(MutationObserver.prototype, 'observe').mockImplementation(() => undefined);
  vi.spyOn(window, 'addEventListener').mockImplementation(() => undefined);
  document.body.innerHTML = '<main><div class="game_area_purchase"></div></main>';
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('content snapshot activation', () => {
  it('updates an already rendered card when a new snapshot finishes installing', async () => {
    const update = deferred<unknown>();
    let installed = false;
    let lookupCount = 0;
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message: unknown) => {
      const request = message as RuntimeRequest;
      if (request.type === 'CHECK_SNAPSHOT_UPDATE') return update.promise;
      if (request.type === 'GET_SETTINGS') return { ok: true, settings: DEFAULT_SETTINGS };
      lookupCount += 1;
      return { ok: true, data: { ...game, mainStory: installed ? 120 : 60 } };
    });
    const { default: content } = await import('../entrypoints/content');
    (content.main as () => void)();
    await vi.waitFor(() => expect(document.getElementById(WIDGET_ID)?.shadowRoot?.querySelector('.time-mainStory strong')?.textContent).toBe('1 Hour'));

    installed = true;
    update.resolve({ ok: true, update: { status: 'updated', checkedAt: Date.now(), activeVersion: '2026.09.07.1' } });
    await vi.waitFor(() => expect(document.getElementById(WIDGET_ID)?.shadowRoot?.querySelector('.time-mainStory strong')?.textContent).toBe('2 Hours'));
    expect(lookupCount).toBe(2);
    expect(document.getElementById(WIDGET_ID)?.shadowRoot?.textContent).not.toContain('Checked');
  });

  it('prevents a pre-update lookup from overwriting the refreshed card', async () => {
    const update = deferred<unknown>();
    const oldLookup = deferred<unknown>();
    let lookupCount = 0;
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message: unknown) => {
      const request = message as RuntimeRequest;
      if (request.type === 'CHECK_SNAPSHOT_UPDATE') return update.promise;
      if (request.type === 'GET_SETTINGS') return { ok: true, settings: DEFAULT_SETTINGS };
      lookupCount += 1;
      return lookupCount === 1 ? oldLookup.promise : { ok: true, data: { ...game, mainStory: 120 } };
    });
    const { default: content } = await import('../entrypoints/content');
    (content.main as () => void)();
    update.resolve({ ok: true, update: { status: 'updated', checkedAt: Date.now(), activeVersion: '2026.09.07.1' } });
    await vi.waitFor(() => expect(document.getElementById(WIDGET_ID)?.shadowRoot?.querySelector('.time-mainStory strong')?.textContent).toBe('2 Hours'));

    oldLookup.resolve({ ok: true, data: game });
    // Allow the older message and its Promise.all continuation to settle.
    await vi.waitFor(() => expect(lookupCount).toBe(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById(WIDGET_ID)?.shadowRoot?.querySelector('.time-mainStory strong')?.textContent).toBe('2 Hours');
  });

  it.each(['current', 'skipped', 'failed'])('does not repeat the lookup after a %s update check', async (status) => {
    let lookupCount = 0;
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message: unknown) => {
      const request = message as RuntimeRequest;
      if (request.type === 'CHECK_SNAPSHOT_UPDATE') return { ok: true, update: { status, checkedAt: Date.now() } };
      if (request.type === 'GET_SETTINGS') return { ok: true, settings: DEFAULT_SETTINGS };
      lookupCount += 1;
      return { ok: true, data: game };
    });
    const { default: content } = await import('../entrypoints/content');
    (content.main as () => void)();
    await vi.waitFor(() => expect(document.getElementById(WIDGET_ID)?.shadowRoot?.querySelector('.time-mainStory strong')?.textContent).toBe('1 Hour'));
    expect(lookupCount).toBe(1);
  });
});
