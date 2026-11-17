const PRODUCTION_SNAPSHOT_BASE_URL = 'https://devln737.github.io/hltb-for-steam-unofficial/data/v2/';

// WXT replaces WXT_-prefixed variables at build time. This override is used by
// local acceptance builds only; production builds always use GitHub Pages.
export const REMOTE_SNAPSHOT_BASE_URL = import.meta.env.WXT_REMOTE_SNAPSHOT_BASE_URL
  || PRODUCTION_SNAPSHOT_BASE_URL;

// This key is generated for the v2.2 snapshot channel. Its matching private key
// must remain only in the updater's private secret store.
export const REMOTE_SNAPSHOT_PUBLIC_KEY: JsonWebKey = {
  kty: 'EC',
  crv: 'P-256',
  x: 'Cna5Y2StFag996HThLBW7gZdc0drcBbgGZ1GqXWkZEI',
  y: 'Drkqhr-hTTjiDKpYZJ0mzy1iIepi9-Lf4v6w8zsOjK4',
  ext: true,
};
