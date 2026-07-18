export interface SteamGamePage {
  appId: string;
  title: string;
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

export function findWidgetAnchor(documentRef: Document = document): Element | null {
  return documentRef.querySelector('.rightcol, .game_meta_data, #game_area_purchase, .game_area_purchase');
}

