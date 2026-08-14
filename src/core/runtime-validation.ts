import type { ExtensionSettings, LookupResult, TimeCategory } from './contracts';

const LOOKUP_ERRORS = new Set(['not_found', 'rate_limited', 'network', 'service_error', 'invalid_request']);
const CATEGORIES: TimeCategory[] = ['mainStory', 'mainPlusExtras', 'completionist'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableNumber(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isTimeChange(value: unknown): boolean {
  return value === null || (isRecord(value) && (
    value.kind === 'new'
    || (value.kind === 'removed' && typeof value.previous === 'number' && value.previous > 0)
    || (value.kind === 'delta' && typeof value.minutes === 'number' && value.minutes !== 0)
  ));
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
    && typeof data.gameId === 'number' && data.gameId > 0
    && typeof data.requestedTitle === 'string'
    && typeof data.matchedTitle === 'string'
    && isNullableNumber(data.mainStory)
    && isNullableNumber(data.mainPlusExtras)
    && isNullableNumber(data.completionist)
    && isRecord(data.changes) && CATEGORIES.every((category) => isTimeChange((data.changes as Record<string, unknown>)[category]))
    && (data.baselineUpdatedAt === null || typeof data.baselineUpdatedAt === 'number')
    && (data.availability === 'timed' || data.availability === 'known_without_times')
    && typeof data.hltbUrl === 'string'
    && (data.source === 'network' || data.source === 'cache' || data.source === 'snapshot')
    && typeof data.updatedAt === 'number'
    && typeof data.stale === 'boolean';
}
