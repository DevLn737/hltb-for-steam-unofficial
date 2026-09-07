import { chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const expectedVersion = process.argv[2];
if (!expectedVersion) {
  throw new Error('Usage: node scripts/smoke-local-snapshot.mjs <expected-snapshot-version> [extension-directory]');
}

const extensionPath = path.resolve(process.argv[3] ?? '.output/chrome-mv3');
const profilePath = await mkdtemp(path.join(tmpdir(), 'hltb-acceptance-'));
const hltbRequests = [];
let activeContext;

async function launch() {
  const context = await chromium.launchPersistentContext(profilePath, {
    channel: 'chromium',
    headless: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Valve Steam Client) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.183 Safari/537.36',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  activeContext = context;
  context.on('request', (request) => {
    if (request.url().startsWith('https://howlongtobeat.com/')) hltbRequests.push(request.url());
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const extensionId = worker.url().split('/')[2];
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  return { context, page };
}

async function message(page, payload) {
  return page.evaluate((request) => globalThis.chrome.runtime.sendMessage(request), payload);
}

function assert(condition, messageText) {
  if (!condition) throw new Error(messageText);
}

async function assertWidget(context, fixture) {
  const url = `https://store.steampowered.com/app/${fixture.appId}/${fixture.slug}/`;
  const page = await context.newPage();
  await page.route(url, (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html><head><meta property="og:title" content="${fixture.title}"></head><body><div class="apphub_AppName">${fixture.title}</div><main><div class="game_area_purchase"></div></main></body></html>`,
  }));
  await page.goto(url);
  const widget = page.locator('#hltb-for-steam-unofficial');
  await widget.waitFor();
  const badges = await widget.locator('.time-change').allTextContents();
  assert(JSON.stringify(badges) === JSON.stringify(fixture.badges), `${fixture.title} badge mismatch: ${JSON.stringify(badges)}`);
  const labels = await widget.locator('.time-change').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
  assert(labels.every((label) => label?.includes('Sep 3, 2026')), `${fixture.title} baseline date is missing: ${JSON.stringify(labels)}`);
}

try {
  let { context, page } = await launch();
  const update = await message(page, { type: 'CHECK_SNAPSHOT_UPDATE', force: true });
  assert(update.ok === true, `Snapshot update failed: ${JSON.stringify(update)}`);
  assert(update.update.status === 'updated', `Expected updated status, got ${JSON.stringify(update.update)}`);
  assert(update.update.activeVersion === expectedVersion, `Expected ${expectedVersion}, got ${update.update.activeVersion}`);

  const cases = [
    { appId: 1623730, title: 'Palworld', expected: ['delta', 'delta', 'delta'] },
    { appId: 674750, title: 'Yet Another Zombie Defense HD', expected: ['delta', null, 'delta'] },
    { appId: 3628950, title: "Succubus Successor: Delilah's Juicy Journey", expected: [null, null, null] },
  ];
  for (const fixture of cases) {
    const response = await message(page, { type: 'GET_GAME_TIMES', appId: fixture.appId, title: fixture.title, client: 'steam' });
    assert(response.ok === true, `${fixture.title} lookup failed: ${JSON.stringify(response)}`);
    assert(response.data.source === 'snapshot', `${fixture.title} did not use snapshot`);
    const actual = ['mainStory', 'mainPlusExtras', 'completionist'].map((key) => response.data.changes[key]?.kind ?? null);
    assert(JSON.stringify(actual) === JSON.stringify(fixture.expected), `${fixture.title} history mismatch: ${JSON.stringify(actual)}`);
    console.log(`${fixture.title}: ${JSON.stringify(response.data.changes)}`);
  }
  await assertWidget(context, { appId: 1623730, slug: 'Palworld', title: 'Palworld', badges: ['▲ 19.5h', '▲ 21h', '▲ 38.5h'] });
  await assertWidget(context, { appId: 674750, slug: 'Yet_Another_Zombie_Defense_HD', title: 'Yet Another Zombie Defense HD', badges: [] });
  await assertWidget(context, { appId: 3628950, slug: 'Succubus_Successor_Delilahs_Juicy_Journey', title: "Succubus Successor: Delilah's Juicy Journey", badges: [] });
  await context.close();
  activeContext = undefined;

  ({ context, page } = await launch());
  const persisted = await message(page, { type: 'GET_GAME_TIMES', appId: 1623730, title: 'Palworld', client: 'steam' });
  assert(persisted.ok === true && persisted.data.source === 'snapshot', 'Remote snapshot was not retained after browser restart');
  await context.close();
  activeContext = undefined;

  assert(hltbRequests.length === 0, `Steam mode contacted HLTB: ${hltbRequests.join(', ')}`);
  console.log(`Accepted signed snapshot ${expectedVersion}; IndexedDB restart and Steam offline routing passed.`);
} finally {
  await activeContext?.close().catch(() => undefined);
  await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch((error) => {
    console.warn(`Could not remove temporary profile: ${error.message}`);
  });
}
