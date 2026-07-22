import { chromium, expect, test, type BrowserContext, type Worker } from '@playwright/test';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const buildPath = path.resolve('.output/chrome-mv3');
let context: BrowserContext;
let worker: Worker;
let temporaryDirectory: string;
const hltbRequests: string[] = [];

test.beforeAll(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'hltb-browser-smoke-'));
  const extensionPath = path.join(temporaryDirectory, 'extension');
  await cp(buildPath, extensionPath, { recursive: true });
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Valve Steam Client) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.183 Safari/537.36',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  context.on('request', (request) => {
    if (request.url().startsWith('https://howlongtobeat.com/')) hltbRequests.push(request.url());
  });
  worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
});

test.afterAll(async () => {
  await context.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
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
  await expect(widget).toContainText('75 Hours');
  await expect(widget.locator('a')).toHaveAttribute('href', /howlongtobeat\.com\/game\/156025/);
  await expect(widget).not.toContainText('4.6');
  await expect(widget).not.toContainText('Local snapshot');
  expect(hltbRequests).toEqual([]);
});
