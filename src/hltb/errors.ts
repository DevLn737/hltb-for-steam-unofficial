export class HltbNetworkError extends Error {
  constructor(message: string, readonly status?: number, options?: ErrorOptions) {
    super(message, options);
    this.name = 'HltbNetworkError';
  }
}

export class HltbRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`HLTB rate limit reached; retry after ${retryAfterSeconds} seconds`);
    this.name = 'HltbRateLimitError';
  }
}

