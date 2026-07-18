import { browser } from 'wxt/browser';
import type { ExtensionSettings, LookupResult, RuntimeRequest, RuntimeResponse } from '../src/core/contracts';
import { extractSteamGamePage, findWidgetAnchor } from '../src/steam/page';
import { detectLocale } from '../src/ui/i18n';
import { ensureWidgetHost, renderError, renderLoading, renderResult, WIDGET_ID } from '../src/ui/widget';

async function send(message: RuntimeRequest): Promise<RuntimeResponse> {
  return await browser.runtime.sendMessage(message) as RuntimeResponse;
}

export default defineContentScript({
  matches: ['https://store.steampowered.com/app/*', 'https://steamcommunity.com/app/*'],
  runAt: 'document_idle',
  main() {
    let currentPage = '';
    let scheduled: ReturnType<typeof setTimeout> | undefined;

    const refresh = async () => {
      const page = extractSteamGamePage();
      const anchor = findWidgetAnchor();
      if (!page || !anchor) {
        document.getElementById(WIDGET_ID)?.remove();
        currentPage = '';
        return;
      }
      const pageKey = `${page.appId}:${page.title}`;
      if (pageKey === currentPage && document.getElementById(WIDGET_ID)) return;
      currentPage = pageKey;
      const host = ensureWidgetHost(document, anchor);
      const locale = detectLocale();
      renderLoading(host, locale);

      const [lookup, settingsResponse] = await Promise.all([
        send({ type: 'GET_GAME_TIMES', appId: page.appId, title: page.title }),
        send({ type: 'GET_SETTINGS' }),
      ]);
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

