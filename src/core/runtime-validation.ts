import type { ExtensionSettings, LookupResult, TimeCategory } from './contracts';

const LOOKUP_ERRORS = new Set(['not_found', 'rate_limited', 'network', 'service_error', 'invalid_request']);
const CATEGORIES: TimeCategory[] = ['mainStory', 'mainPlusExtras', 'completionist'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableNumber(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

export function isExtensionSettings(value: unknown): value is ExtensionSettings {
  if (!isRecord(value) || !isRecord(value.categories)) return false;
  const categories = value.categories;
  return CATEGORIES.every((category) => typeof categories[category] === 'boolean')
    && (value.timeFormat === 'decimal' || value.timeFormat === 'hoursMinutes')
    && (value.cacheDurationDays === 1 || value.cacheDurationDays === 7 || value.cacheDurationDays === 30);
}

export function isSettingsResponse(value: unknown): value is { ok: true; settings: ExtensionSettings } {
  return isRecord(value) && value.ok === true && isExtensionSettings(value.settings);
}

export function isClearCacheResponse(value: unknown): value is { ok: true; cleared: true } {
  return isRecord(value) && value.ok === true && value.cleared === true;
}

export function isLookupResult(value: unknown): value is LookupResult {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false;
  if (!value.ok) {
    return typeof value.error === 'string'
      && LOOKUP_ERRORS.has(value.error)
      && (value.retryAfterSeconds === undefined || typeof value.retryAfterSeconds === 'number')
      && (value.diagnostic === undefined || (
        isRecord(value.diagnostic)
        && (value.diagnostic.stage === 'initialization' || value.diagnostic.stage === 'search')
        && (value.diagnostic.status === undefined || typeof value.diagnostic.status === 'number')
      ));
  }
  const data = value.data;
  return isRecord(data)
    && typeof data.appId === 'string'
    && typeof data.requestedTitle === 'string'
    && typeof data.matchedTitle === 'string'
    && isNullableNumber(data.mainStory)
    && isNullableNumber(data.mainPlusExtras)
    && isNullableNumber(data.completionist)
    && typeof data.hltbUrl === 'string'
    && (data.imageUrl === null || typeof data.imageUrl === 'string')
    && (data.source === 'network' || data.source === 'cache')
    && typeof data.fetchedAt === 'number'
    && typeof data.stale === 'boolean';
}
