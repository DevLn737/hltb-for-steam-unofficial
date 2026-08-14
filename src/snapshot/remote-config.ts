const PRODUCTION_SNAPSHOT_BASE_URL = 'https://devln737.github.io/hltb-for-steam-data/';

// WXT replaces WXT_-prefixed variables at build time. This override is used by
// local acceptance builds only; production builds always use GitHub Pages.
export const REMOTE_SNAPSHOT_BASE_URL = import.meta.env.WXT_REMOTE_SNAPSHOT_BASE_URL
  || PRODUCTION_SNAPSHOT_BASE_URL;

// This key is generated for the v2.2 snapshot channel. Its matching private key
// must remain only in the private Forgejo updater's secret store.
export const REMOTE_SNAPSHOT_PUBLIC_KEY: JsonWebKey = {
  kty: 'EC',
  crv: 'P-256',
  x: 'DoAI6ekg6mzGS-JV1--swocaIj5dirgUWQXQpT1-H2w',
  y: '8_cDANXlU-7HNIdwVS4qrFqUlEiQ4sOnzfi2T_-9JGQ',
  ext: true,
};
