import { findStrictMatch, type MatchCandidate } from '../core/title-matcher';
import { HltbNetworkError, HltbRateLimitError } from './errors';

const BASE_URL = 'https://howlongtobeat.com';
const INIT_URL = `${BASE_URL}/api/bleed/init`;
const SEARCH_URL = `${BASE_URL}/api/bleed`;
const AUTH_TTL_MS = 10 * 60 * 1000;

interface AuthSession {
  token: string;
  hpKey: string;
  hpVal: string;
  expiresAt: number;
}

interface HltbGame {
  game_id: number;
  game_name: string;
  game_alias?: string;
  game_image?: string;
  comp_main?: number;
  comp_plus?: number;
  comp_100?: number;
}

interface HltbSearchResponse {
  data?: HltbGame[];
}

export interface HltbGameTimes {
  gameId: number;
  matchedTitle: string;
  mainStory: number | null;
  mainPlusExtras: number | null;
  completionist: number | null;
  hltbUrl: string;
  imageUrl: string | null;
}

export interface HltbClientOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
}

function secondsToMinutes(value: number | undefined): number | null {
  if (!value || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value / 60);
}

function gameImageUrl(value: string | undefined): string | null {
  if (!value) return null;
  const path = value.replace(/^\/?(?:games\/)?/, '');
  return path ? `${BASE_URL}/games/${path}` : null;
}

function retryAfterSeconds(headers: Headers, now: number): number {
  const header = headers.get('Retry-After');
  if (!header) return 60;
  const numeric = Number.parseInt(header, 10);
  if (Number.isFinite(numeric)) return Math.max(1, numeric);
  const date = Date.parse(header);
  return Number.isNaN(date) ? 60 : Math.max(1, Math.ceil((date - now) / 1000));
}

export class HltbClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private session: AuthSession | null = null;

  constructor(options: HltbClientOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.now = options.now ?? Date.now;
  }

  async lookup(title: string): Promise<HltbGameTimes | null> {
    const response = await this.search(title, true);
    const candidates = response.data ?? [];
    const matchCandidates: Array<HltbGame & MatchCandidate> = candidates.map((game) => ({
      ...game,
      id: game.game_id,
      name: game.game_name,
      ...(game.game_alias ? { aliases: game.game_alias } : {}),
    }));
    const match = findStrictMatch(title, matchCandidates);
    if (!match) return null;
    const game = match.candidate;
    return {
      gameId: game.game_id,
      matchedTitle: game.game_name,
      mainStory: secondsToMinutes(game.comp_main),
      mainPlusExtras: secondsToMinutes(game.comp_plus),
      completionist: secondsToMinutes(game.comp_100),
      hltbUrl: `${BASE_URL}/game/${game.game_id}`,
      imageUrl: gameImageUrl(game.game_image),
    };
  }

  private async search(title: string, allowRefresh: boolean): Promise<HltbSearchResponse> {
    const auth = await this.getSession();
    const payload = {
      searchType: 'games',
      searchTerms: title.split(/\s+/).filter(Boolean),
      searchPage: 1,
      size: 20,
      searchOptions: {
        games: {
          userId: 0,
          platform: '',
          sortCategory: 'popular',
          rangeCategory: 'main',
          rangeTime: { min: null, max: null },
          gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
          rangeYear: { min: '', max: '' },
          modifier: '',
        },
        users: { sortCategory: 'postcount' },
        lists: { sortCategory: 'follows' },
        filter: '',
        sort: 0,
        randomizer: 0,
      },
      useCache: true,
      [auth.hpKey]: auth.hpVal,
    };

    const response = await this.request(SEARCH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-auth-token': auth.token,
        'x-hp-key': auth.hpKey,
        'x-hp-val': auth.hpVal,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 429) {
      throw new HltbRateLimitError(retryAfterSeconds(response.headers, this.now()));
    }
    if ([401, 403, 404].includes(response.status) && allowRefresh) {
      this.session = null;
      return this.search(title, false);
    }
    if (!response.ok) throw new HltbNetworkError(`HLTB search failed with HTTP ${response.status}`, response.status);
    return this.readJson<HltbSearchResponse>(response, 'Invalid HLTB search response');
  }

  private async getSession(): Promise<AuthSession> {
    if (this.session && this.now() < this.session.expiresAt) return this.session;
    const response = await this.request(`${INIT_URL}?t=${this.now()}`, {
      method: 'GET',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) throw new HltbNetworkError(`HLTB initialization failed with HTTP ${response.status}`, response.status);
    const raw = await this.readJson<Partial<AuthSession>>(response, 'Invalid HLTB initialization response');
    if (!raw.token || !raw.hpKey || !raw.hpVal) throw new HltbNetworkError('HLTB initialization response is missing authentication fields');
    this.session = { token: raw.token, hpKey: raw.hpKey, hpVal: raw.hpVal, expiresAt: this.now() + AUTH_TTL_MS };
    return this.session;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } catch (error) {
      throw new HltbNetworkError(error instanceof Error && error.name === 'AbortError' ? 'HLTB request timed out' : 'HLTB network request failed', undefined, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readJson<T>(response: Response, message: string): Promise<T> {
    try {
      return await response.json() as T;
    } catch (error) {
      throw new HltbNetworkError(message, response.status, { cause: error });
    }
  }
}
