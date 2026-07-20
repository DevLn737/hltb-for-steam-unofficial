import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, type ExtensionSettings, type RuntimeRequest } from '../src/core/contracts';
import { withTimeout } from '../src/core/async';
import { isLookupResult, isSettingsResponse } from '../src/core/runtime-validation';
import { extractSteamGamePage, findWidgetPlacement } from '../src/steam/page';
import { detectLocale } from '../src/ui/i18n';
import { ensureWidgetHost, renderError, renderLoading, renderResult, WIDGET_ID } from '../src/ui/widget';

async function send(message: RuntimeRequest, timeoutMs: number): Promise<unknown> {
  return await withTimeout(browser.runtime.sendMessage(message) as Promise<unknown>, timeoutMs);
}

export default defineContentScript({
  matches: ['https://store.steampowered.com/app/*', 'https://steamcommunity.com/app/*'],
  runAt: 'document_idle',
  main() {
    let currentPage = '';
    let scheduled: ReturnType<typeof setTimeout> | undefined;

    const refresh = async () => {
      const page = extractSteamGamePage();
      const placement = findWidgetPlacement();
      if (!page || !placement) {
        document.getElementById(WIDGET_ID)?.remove();
        currentPage = '';
        return;
      }
      const pageKey = `${page.appId}:${page.title}`;
      const host = ensureWidgetHost(document, placement);
      if (pageKey === currentPage) return;
      currentPage = pageKey;
      const locale = detectLocale();
      renderLoading(host, locale);

      let lookup: unknown;
      let settings: ExtensionSettings;
      try {
        [lookup, settings] = await Promise.all([
          send({
            type: 'GET_GAME_TIMES',
            appId: page.appId,
            title: page.title,
            client: navigator.userAgent.includes('Valve Steam Client') ? 'steam' : 'browser',
          }, 20_000),
          send({ type: 'GET_SETTINGS' }, 3_000)
            .then((response) => isSettingsResponse(response) ? response.settings : DEFAULT_SETTINGS)
            .catch(() => DEFAULT_SETTINGS),
        ]);
      } catch {
        if (currentPage === pageKey) renderError(host, 'service_error', page.title, locale);
        return;
      }
      if (currentPage !== pageKey) return;
      if (!isLookupResult(lookup)) {
        renderError(host, 'service_error', page.title, locale);
      } else if (lookup.ok) {
        renderResult(host, lookup.data, settings, locale, page.artworkUrl, page.backdropUrl);
      } else {
        renderError(host, lookup.error, page.title, locale, lookup.diagnostic);
      }
    };

    const schedule = () => {
      clearTimeout(scheduled);
      scheduled = setTimeout(() => void refresh(), 150);
    };

    void refresh();
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('popstate', schedule);
  },
});
