import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const extensionPath = path.resolve('.output/chrome-mv3');
const steamUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Valve Steam Client) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.183 Safari/537.36';
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 900 },
  userAgent: steamUserAgent,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});

try {
  await (context.serviceWorkers()[0] ? Promise.resolve() : context.waitForEvent('serviceworker'));

  const page = await context.newPage();
  await page.route('https://store.steampowered.com/app/2258500/CRYMACHINA/', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html><head><style>
      body{margin:0;padding:70px;background:radial-gradient(circle at top,#29445d,#171d25 55%);font-family:Arial;color:white}
      .page{display:grid;grid-template-columns:1fr 360px;gap:24px;max-width:1120px;margin:auto}.hero{height:310px;border-radius:8px;background:linear-gradient(135deg,#334b63,#182534);box-shadow:0 10px 40px #0008}.apphub_AppName{max-width:1120px;margin:0 auto 18px;font-size:28px}.rightcol{width:360px}.purchase-column{margin-top:18px}.game_area_purchase{height:78px;border-radius:6px;background:#253647}
    </style><meta property="og:title" content="CRYMACHINA on Steam"><meta property="og:image" content="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2258500/header.jpg"></head><body><div class="apphub_AppName">CRYMACHINA</div><div class="page"><div><div class="hero"></div><div class="purchase-column"><div class="game_area_purchase"></div></div></div><aside class="rightcol"></aside></div></body></html>`,
  }));
  await page.goto('https://store.steampowered.com/app/2258500/CRYMACHINA/');
  const widget = page.locator('#hltb-for-steam-unofficial');
  await widget.waitFor();
  await page.waitForFunction(() => {
    const image = globalThis.document.querySelector('#hltb-for-steam-unofficial')?.shadowRoot?.querySelector('img');
    return image?.complete && image.naturalWidth > 0;
  });
  await mkdir(path.resolve('docs/screenshots'), { recursive: true });
  const screenshot = path.resolve('docs/screenshots/widget.png');
  await widget.screenshot({ path: screenshot });
  await copyFile(screenshot, path.resolve('widget-preview.png'));
} finally {
  await context.close();
}
