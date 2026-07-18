export type TimeCategory = 'mainStory' | 'mainPlusExtras' | 'completionist';
export type TimeFormat = 'decimal' | 'hoursMinutes';
export type CacheDurationDays = 1 | 7 | 30;

export interface ExtensionSettings {
  categories: Record<TimeCategory, boolean>;
  timeFormat: TimeFormat;
  cacheDurationDays: CacheDurationDays;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  categories: {
    mainStory: true,
    mainPlusExtras: true,
    completionist: true,
  },
  timeFormat: 'decimal',
  cacheDurationDays: 7,
};

export interface GameTimes {
  appId: string;
  requestedTitle: string;
  matchedTitle: string;
  mainStory: number | null;
  mainPlusExtras: number | null;
  completionist: number | null;
  hltbUrl: string;
  imageUrl: string | null;
  source: 'network' | 'cache';
  fetchedAt: number;
  stale: boolean;
}

export type LookupErrorCode =
  | 'not_found'
  | 'rate_limited'
  | 'network'
  | 'service_error'
  | 'invalid_request';

export type LookupResult =
  | { ok: true; data: GameTimes }
  | { ok: false; error: LookupErrorCode; retryAfterSeconds?: number };

export type RuntimeRequest =
  | { type: 'GET_GAME_TIMES'; appId: string; title: string }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; settings: ExtensionSettings }
  | { type: 'CLEAR_CACHE' };

export type RuntimeResponse =
  | LookupResult
  | { ok: true; settings: ExtensionSettings }
  | { ok: true; cleared: true }
  | { ok: false; error: 'invalid_request' | 'service_error' };
