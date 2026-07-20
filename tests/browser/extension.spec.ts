import { chromium, expect, test, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';

const extensionPath = path.resolve('.output/chrome-mv3');
let context: BrowserContext;
let worker: Worker;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
});

test.afterAll(async () => {
  await context.close();
});

test('loads the MV3 worker and popup', async () => {
  const extensionId = worker.url().split('/')[2];
  expect(extensionId).toBeTruthy();
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator('header')).toContainText('HowLongToBeat');
  await expect(page.locator('#cacheDuration')).toHaveValue('7');
});

test('injects one Shadow DOM widget on a Steam game page', async () => {
  await worker.evaluate(async () => {
    const extensionApi = (globalThis as unknown as {
      chrome: { storage: { local: { set(value: Record<string, unknown>): Promise<void> } } };
    }).chrome;
    await extensionApi.storage.local.set({
      'game:v4:3375780:trails in the sky 1st chapter': {
        schema: 4,
        data: {
          appId: '3375780',
          requestedTitle: 'Trails in the Sky 1st Chapter',
          matchedTitle: 'Trails in the Sky 1st Chapter',
          mainStory: 2400,
          mainPlusExtras: 3420,
          completionist: 3480,
          hltbUrl: 'https://howlongtobeat.com/game/155183',
          updatedAt: Date.now(),
        },
      },
    });
  });
  const page = await context.newPage();
  await page.route('https://store.steampowered.com/app/3375780/Trails_in_the_Sky_1st_Chapter/', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><head><meta property="og:title" content="Wrong title on Steam"><meta property="og:image" content="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3375780/header.jpg"></head><body><div class="apphub_AppName">Trails in the Sky 1st Chapter</div><main><div class="game_area_purchase"></div></main><aside class="rightcol"></aside></body></html>',
  }));
  await page.goto('https://store.steampowered.com/app/3375780/Trails_in_the_Sky_1st_Chapter/');
  const widget = page.locator('#hltb-for-steam-unofficial');
  await expect(widget).toHaveCount(1);
  await expect(widget.locator('xpath=following-sibling::*[1]')).toHaveClass('game_area_purchase');
  await expect(widget).toContainText('40 Hours');
  await expect(widget).toContainText('57 Hours');
  await expect(widget).toContainText('58 Hours');
  await expect(widget).not.toContainText('4.6');
  await expect(widget).not.toContainText('Local snapshot');
});
