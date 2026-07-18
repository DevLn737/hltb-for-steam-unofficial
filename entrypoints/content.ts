import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, type ExtensionSettings, type LookupResult, type RuntimeRequest, type RuntimeResponse } from '../src/core/contracts';
import { withTimeout } from '../src/core/async';
import { extractSteamGamePage, findWidgetPlacement } from '../src/steam/page';
import { detectLocale } from '../src/ui/i18n';
import { ensureWidgetHost, renderError, renderLoading, renderResult, WIDGET_ID } from '../src/ui/widget';

async function send(message: RuntimeRequest, timeoutMs: number): Promise<RuntimeResponse> {
  return await withTimeout(browser.runtime.sendMessage(message) as Promise<RuntimeResponse>, timeoutMs);
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

      let lookup: RuntimeResponse;
      let settingsResponse: RuntimeResponse;
      try {
        [lookup, settingsResponse] = await Promise.all([
          send({ type: 'GET_GAME_TIMES', appId: page.appId, title: page.title }, 20_000),
          send({ type: 'GET_SETTINGS' }, 3_000).catch((): RuntimeResponse => ({ ok: true, settings: DEFAULT_SETTINGS })),
        ]);
      } catch {
        if (currentPage === pageKey) renderError(host, 'service_error', page.title, locale);
        return;
      }
      if (currentPage !== pageKey) return;
      const result = lookup as LookupResult;
      if (result.ok) {
        const settings = settingsResponse.ok && 'settings' in settingsResponse ? settingsResponse.settings : undefined;
        if (settings) renderResult(host, result.data, settings as ExtensionSettings, locale);
        else renderError(host, 'service_error', page.title, locale);
      } else {
        renderError(host, result.error, page.title, locale);
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
