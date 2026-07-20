import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const appId = process.argv[2] ?? '2258500';
const slug = process.argv[3] ?? 'CRYMACHINA';
const userAgentMode = process.argv[4] ?? 'chrome';
const chromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
const steamUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Valve Steam Client) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.183 Safari/537.36';
if (!['chrome', 'steam'].includes(userAgentMode)) throw new Error(`Unknown user-agent mode: ${userAgentMode}`);
const steamUrl = `https://store.steampowered.com/app/${appId}/${slug}/`;
const outputDirectory = path.resolve('live-smoke');
const extensionPath = path.resolve('.output/chrome-mv3');
const events = [];

await mkdir(outputDirectory, { recursive: true });
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1440, height: 1000 },
  userAgent: userAgentMode === 'steam' ? steamUserAgent : chromeUserAgent,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});

context.on('request', (request) => {
  if (request.url().startsWith('https://howlongtobeat.com/')) {
    const headers = request.headers();
    events.push({
      type: 'request', method: request.method(), url: request.url(),
      headers: { origin: headers.origin, referer: headers.referer, userAgent: headers['user-agent'], accept: headers.accept },
    });
  }
});
context.on('response', (response) => {
  if (response.url().startsWith('https://howlongtobeat.com/')) {
    events.push({ type: 'response', status: response.status(), url: response.url() });
  }
});
context.on('requestfailed', (request) => {
  if (request.url().startsWith('https://howlongtobeat.com/')) {
    events.push({ type: 'failure', error: request.failure()?.errorText ?? 'unknown', url: request.url() });
  }
});

await context.addCookies([
  { name: 'birthtime', value: '0', domain: 'store.steampowered.com', path: '/' },
  { name: 'lastagecheckage', value: '1-January-1990', domain: 'store.steampowered.com', path: '/' },
  { name: 'wants_mature_content', value: '1', domain: 'store.steampowered.com', path: '/' },
]);

try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  worker.on('console', (message) => events.push({ type: 'console', level: message.type(), text: message.text() }));
  const probe = userAgentMode === 'steam' ? { stage: 'skipped-local-snapshot' } : await worker.evaluate(async () => {
    try {
      const initUrl = `https://howlongtobeat.com/api/bleed/init?t=${Date.now()}`;
      const rulesets = await globalThis.chrome.declarativeNetRequest.getEnabledRulesets();
      const ruleTest = await globalThis.chrome.declarativeNetRequest.testMatchOutcome({
        url: initUrl, type: 'xmlhttprequest', method: 'get', initiator: globalThis.location.origin,
      }).catch((error) => ({ error: error instanceof Error ? error.message : String(error) }));
      const init = await fetch(initUrl, {
        headers: { Accept: '*/*', 'Cache-Control': 'no-cache' },
      });
      const initType = init.headers.get('content-type');
      if (!init.ok) {
        const body = await init.text();
        const homepage = await fetch('https://howlongtobeat.com/', { credentials: 'include' });
        const retry = await fetch(`https://howlongtobeat.com/api/bleed/init?t=${Date.now()}`, {
          credentials: 'include', headers: { Accept: '*/*', 'Cache-Control': 'no-cache' },
        });
        return {
          stage: 'init', status: init.status, contentType: initType, rulesets, ruleTest,
          pageTitle: body.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null,
          cloudflare: /cloudflare|cf-ray/i.test(body),
          sessionProbe: { homepageStatus: homepage.status, retryStatus: retry.status },
        };
      }
      const auth = await init.json();
      if (!auth?.token || !auth?.hpKey || !auth?.hpVal) {
        return { stage: 'init-shape', status: init.status, keys: Object.keys(auth ?? {}) };
      }
      const payload = {
        [auth.hpKey]: auth.hpVal,
        searchType: 'games', searchTerms: ['CRYMACHINA'], searchPage: 1, size: 20,
        searchOptions: {
          games: {
            userId: 0, platform: '', sortCategory: 'popular', rangeCategory: 'main',
            rangeTime: { min: 0, max: 0 },
            gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
            rangeYear: { min: '', max: '' }, modifier: '',
          },
          users: { sortCategory: 'postcount' }, lists: { sortCategory: 'follows' },
          filter: '', sort: 0, randomizer: 0,
        },
        useCache: true,
      };
      const search = await fetch('https://howlongtobeat.com/api/bleed', {
        method: 'POST',
        headers: {
          Accept: '*/*', 'Content-Type': 'application/json',
          'X-Auth-Token': auth.token, 'X-Hp-Key': auth.hpKey, 'X-Hp-Val': auth.hpVal,
        },
        body: JSON.stringify(payload),
      });
      const searchType = search.headers.get('content-type');
      if (!search.ok) return { stage: 'search', status: search.status, contentType: searchType };
      const result = await search.json();
      return { stage: 'complete', status: search.status, keys: Object.keys(result ?? {}), dataCount: result?.data?.length ?? 0 };
    } catch (error) {
      return { stage: 'exception', name: error instanceof Error ? error.name : 'Unknown', message: error instanceof Error ? error.message : String(error) };
    }
  });
  const page = await context.newPage();
  await page.goto(steamUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const widget = page.locator('#hltb-for-steam-unofficial');
  await widget.waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const text = globalThis.document.querySelector('#hltb-for-steam-unofficial')?.shadowRoot?.textContent ?? '';
    return text.length > 0 && !text.includes('Loading completion times');
  }, undefined, { timeout: 30_000 }).catch(() => undefined);
  await page.waitForFunction(() => {
    const image = globalThis.document.querySelector('#hltb-for-steam-unofficial')?.shadowRoot?.querySelector('img');
    return !image || (image.complete && image.naturalWidth > 0);
  }, undefined, { timeout: 10_000 }).catch(() => undefined);
  await widget.screenshot({ path: path.join(outputDirectory, `${appId}-widget.png`) });
  const placement = await page.evaluate(() => {
    const widgetElement = globalThis.document.querySelector('#hltb-for-steam-unofficial');
    const purchaseElement = globalThis.document.querySelector('.game_area_purchase');
    if (!widgetElement || !purchaseElement) return null;
    const widgetRect = widgetElement.getBoundingClientRect();
    const purchaseRect = purchaseElement.getBoundingClientRect();
    return {
      gap: Math.round(purchaseRect.top - widgetRect.bottom),
      widget: { x: widgetRect.x, y: widgetRect.y, width: widgetRect.width, height: widgetRect.height },
      purchase: { x: purchaseRect.x, y: purchaseRect.y, width: purchaseRect.width, height: purchaseRect.height },
    };
  });
  if (placement) {
    const x = Math.max(0, Math.min(placement.widget.x, placement.purchase.x) - 10);
    const y = Math.max(0, placement.widget.y - 10);
    const right = Math.max(placement.widget.x + placement.widget.width, placement.purchase.x + placement.purchase.width) + 10;
    const bottom = placement.purchase.y + Math.min(placement.purchase.height, 190);
    await page.screenshot({
      path: path.join(outputDirectory, `${appId}-placement.png`),
      clip: { x, y, width: right - x, height: bottom - y },
    });
  }
  const text = await widget.evaluate((element) => element.shadowRoot?.querySelector('.card')?.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  process.stdout.write(`${JSON.stringify({ steamUrl, userAgentMode, probe, placement, text, events }, null, 2)}\n`);
  if (userAgentMode === 'chrome' && probe.stage !== 'complete') throw new Error(`HLTB probe failed at ${probe.stage} (HTTP ${probe.status ?? 'unknown'})`);
  if (userAgentMode === 'steam' && events.some((event) => event.type === 'request')) {
    throw new Error('Steam mode unexpectedly contacted HowLongToBeat');
  }
  if (!placement || placement.gap < 20) throw new Error(`The widget-to-purchase gap is too small: ${placement?.gap ?? 'missing'}px`);
  if (/temporarily unavailable|could not be loaded/i.test(text) || !text.includes('Open on HowLongToBeat')) {
    throw new Error(`The extension did not render a live HLTB result: ${text}`);
  }
  if (userAgentMode === 'steam' && !text.includes('Local snapshot')) throw new Error(`Steam mode did not render snapshot data: ${text}`);
} finally {
  await context.close();
}
