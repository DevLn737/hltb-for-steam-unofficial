const APP_TITLE_ALIASES: Readonly<Record<string, string>> = {
  // Exact Steam-to-HLTB naming corrections only. Times live in the versioned snapshot.
  '2258500': 'CRYMACHINA',
  '2680010': 'The First Berserker: Khazan',
  '3375780': 'Trails in the Sky 1st Chapter',
  '3639650': 'Kotama and Academy Citadel',
};

export function getLookupTitle(appId: string, steamTitle: string): string {
  return APP_TITLE_ALIASES[appId] ?? steamTitle;
}
