import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const extensionPath = path.resolve('.output/chrome-mv3');
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});

try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await worker.evaluate(async () => {
    const extensionApi = globalThis.chrome;
    await extensionApi.storage.local.set({
      'game:v3:2258500:crymachina': {
        schema: 3,
        data: {
          appId: '2258500', requestedTitle: 'CRYMACHINA', matchedTitle: 'CRYMACHINA',
          mainStory: 930, mainPlusExtras: 1170, completionist: 1740,
          hltbUrl: 'https://howlongtobeat.com/game/129922',
          imageUrl: 'https://howlongtobeat.com/games/crymachina-cover.svg', fetchedAt: Date.now(),
        },
      },
    });
  });

  const page = await context.newPage();
  await page.route('https://howlongtobeat.com/games/crymachina-cover.svg', (route) => route.fulfill({
    status: 302,
    headers: { location: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2258500/library_600x900_2x.jpg' },
  }));
  await page.route('https://store.steampowered.com/app/2258500/CRYMACHINA/', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html><head><style>
      body{margin:0;padding:70px;background:radial-gradient(circle at top,#29445d,#171d25 55%);font-family:Arial;color:white}
      .page{display:grid;grid-template-columns:1fr 360px;gap:24px;max-width:1120px;margin:auto}.hero{height:310px;border-radius:8px;background:linear-gradient(135deg,#334b63,#182534);box-shadow:0 10px 40px #0008}.apphub_AppName{max-width:1120px;margin:0 auto 18px;font-size:28px}.rightcol{width:360px}.purchase-column{margin-top:18px}.game_area_purchase{height:78px;border-radius:6px;background:#253647}
    </style><meta property="og:title" content="CRYMACHINA on Steam"></head><body><div class="apphub_AppName">CRYMACHINA</div><div class="page"><div><div class="hero"></div><div class="purchase-column"><div class="game_area_purchase"></div></div></div><aside class="rightcol"></aside></div></body></html>`,
  }));
  await page.goto('https://store.steampowered.com/app/2258500/CRYMACHINA/');
  const widget = page.locator('#hltb-for-steam-unofficial');
  await widget.waitFor();
  await page.waitForFunction(() => {
    const image = globalThis.document.querySelector('#hltb-for-steam-unofficial')?.shadowRoot?.querySelector('img');
    return image?.complete && image.naturalWidth > 0;
  });
  await mkdir(path.resolve('docs/screenshots'), { recursive: true });
  await widget.screenshot({ path: path.resolve('docs/screenshots/widget.png') });
} finally {
  await context.close();
}
