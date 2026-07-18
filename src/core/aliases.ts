const APP_TITLE_ALIASES: Readonly<Record<string, string>> = {
  // Only naming corrections belong here. Never store completion times locally.
  '3375780': 'Trails in the Sky 1st Chapter',
};

export function getLookupTitle(appId: string, steamTitle: string): string {
  return APP_TITLE_ALIASES[appId] ?? steamTitle;
}

