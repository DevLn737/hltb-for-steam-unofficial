import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const source = path.resolve('docs/store-assets/chrome/gallery.html');
const outputDirectory = path.resolve('docs/store-assets/chrome/screenshots');
const names = [
  '01-how-long-will-this-game-take.png',
  '02-see-when-estimates-change.png',
  '03-plan-your-backlog.png',
  '04-show-only-what-matters.png',
  '05-no-account-no-ads-no-tracking.png',
];
const locales = [
  { code: 'en', directory: outputDirectory },
  { code: 'ru', directory: path.join(outputDirectory, 'ru') },
];

await mkdir(outputDirectory, { recursive: true });
await mkdir(path.join(outputDirectory, 'ru'), { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

  for (const locale of locales) {
    for (const [index, name] of names.entries()) {
      const url = `${pathToFileURL(source).href}?slide=${index + 1}&lang=${locale.code}`;
      await page.goto(url, { waitUntil: 'load' });
      const capture = page.locator('#capture');
      if (await capture.getAttribute('src')) {
        await capture.evaluate((image) => image.decode());
      }
      await page.screenshot({ path: path.join(locale.directory, name) });
    }
  }
} finally {
  await browser.close();
}
