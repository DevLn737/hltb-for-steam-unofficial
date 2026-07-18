export interface SteamGamePage {
  appId: string;
  title: string;
}

export interface WidgetPlacement {
  anchor: Element;
  position: 'before' | 'after';
}

function cleanSteamTitle(value: string): string {
  return value
    .replace(/\s+on Steam$/i, '')
    .replace(/^Save \d+% on /i, '')
    .trim();
}

export function extractSteamGamePage(documentRef: Document = document, url = location.href): SteamGamePage | null {
  const appId = new URL(url).pathname.match(/\/app\/(\d+)/)?.[1];
  if (!appId) return null;

  const domTitle = documentRef.querySelector<HTMLElement>('.apphub_AppName, #appHubAppName')?.textContent;
  const openGraphTitle = documentRef.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content;
  const slug = new URL(url).pathname.match(/\/app\/\d+\/([^/]+)/)?.[1];
  const fallbackTitle = slug ? decodeURIComponent(slug).replace(/_/g, ' ') : '';
  const title = cleanSteamTitle(domTitle || openGraphTitle || fallbackTitle);
  return title ? { appId, title } : null;
}

export function findWidgetPlacement(documentRef: Document = document): WidgetPlacement | null {
  const candidates: ReadonlyArray<readonly [string, WidgetPlacement['position']]> = [
    ['.game_area_purchase', 'before'],
    ['.game_area_purchase_game', 'before'],
    ['.apphub_AppName', 'after'],
    ['.apphub_HomeHeader', 'after'],
    ['#appHubAppName', 'after'],
    ['.rightcol', 'before'],
    ['.game_meta_data', 'before'],
  ];
  for (const [selector, position] of candidates) {
    const anchor = documentRef.querySelector(selector);
    if (anchor) return { anchor, position };
  }
  return null;
}
