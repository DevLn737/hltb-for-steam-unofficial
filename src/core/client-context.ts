import type { ClientContext } from './contracts';

const STEAM_CLIENT_MARKER = 'Valve Steam Client';

export function detectClientContext(userAgent: string): ClientContext {
  return userAgent.includes(STEAM_CLIENT_MARKER) ? 'steam' : 'browser';
}
