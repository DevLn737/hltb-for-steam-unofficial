import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'HLTB for Steam — Unofficial',
    short_name: 'HLTB for Steam',
    description: 'Shows HowLongToBeat completion times on Steam game pages.',
    version: '2.1.0',
    permissions: ['storage', 'declarativeNetRequestWithHostAccess'],
    host_permissions: [
      'https://store.steampowered.com/*',
      'https://steamcommunity.com/*',
      'https://howlongtobeat.com/*',
    ],
    declarative_net_request: {
      rule_resources: [
        {
          id: 'hltb_headers',
          enabled: true,
          path: 'rules/hltb-headers.json',
        },
      ],
    },
    action: {
      default_title: 'HLTB for Steam — Unofficial',
      default_icon: {
        16: 'icons/icon16.png',
        32: 'icons/icon32.png',
        48: 'icons/icon48.png',
        ...(browser === 'firefox' ? {} : { 128: 'icons/icon128.png' }),
      },
    },
    icons: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      ...(browser === 'firefox' ? {} : { 128: 'icons/icon128.png' }),
    },
    ...(browser === 'firefox' ? {
      browser_specific_settings: {
        gecko: {
          id: 'hltb-for-steam-unofficial@devln737.github.io',
          strict_min_version: '142.0',
          data_collection_permissions: {
            required: ['websiteContent'],
          },
        },
      },
    } : {}),
  }),
});
