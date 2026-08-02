import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  zip: {
    artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip',
    sourcesTemplate: '{{name}}-{{version}}-sources.zip',
    excludeSources: [
      '.agents/**',
      '.codex/**',
      '.git/**',
      '.output/**',
      '.wxt/**',
      'coverage/**',
      'data/snapshot-reports/**',
      'dist/**',
      'docs/screenshots/**',
      'docs/store-assets/**',
      'live-smoke/**',
      'node_modules/**',
      'playwright-report/**',
      'release/**',
      'signed/**',
      'steam-debug-logs/**',
      'test-results/**',
      'web-ext-artifacts/**',
      'hltb_data.json',
      '*.crx',
      '*.key',
      '*.log',
      '*.pem',
      '*.xpi',
      'widget-preview.png',
    ],
  },
  manifest: ({ browser }) => ({
    name: '__MSG_extensionName__',
    short_name: '__MSG_extensionShortName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    version: '2.1.4',
    homepage_url: 'https://github.com/DevLn737/hltb-for-steam-unofficial',
    ...(browser === 'firefox' ? {} : { minimum_chrome_version: '88' }),
    permissions: ['storage', 'declarativeNetRequestWithHostAccess'],
    host_permissions: ['https://howlongtobeat.com/*'],
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
      default_title: '__MSG_extensionActionTitle__',
      default_icon: {
        16: 'icons/icon16.png',
        32: 'icons/icon32.png',
        48: 'icons/icon48.png',
        ...(browser === 'firefox' ? { 64: 'icons/icon64.png' } : { 128: 'icons/icon128.png' }),
      },
    },
    icons: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      ...(browser === 'firefox' ? { 64: 'icons/icon64.png' } : { 128: 'icons/icon128.png' }),
    },
    ...(browser === 'firefox' ? {
      browser_specific_settings: {
        gecko: {
          id: 'hltb-for-steam-unofficial@devln737.github.io',
          strict_min_version: '140.0',
          data_collection_permissions: {
            required: ['websiteContent'],
          },
        },
        gecko_android: {
          strict_min_version: '142.0',
        },
      },
    } : {}),
  }),
});
