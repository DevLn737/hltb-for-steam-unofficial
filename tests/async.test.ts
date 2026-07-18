import { describe, expect, it, vi } from 'vitest';
import { OperationTimeoutError, withTimeout } from '../src/core/async';

describe('withTimeout', () => {
  it('resolves a completed operation', async () => {
    await expect(withTimeout(Promise.resolve('done'), 100)).resolves.toBe('done');
  });

  it('rejects a channel that never settles instead of loading forever', async () => {
    vi.useFakeTimers();
    const result = withTimeout(new Promise<never>(() => undefined), 20_000);
    const expectation = expect(result).rejects.toEqual(new OperationTimeoutError(20_000));
    await vi.advanceTimersByTimeAsync(20_000);
    await expectation;
    vi.useRealTimers();
  });
});
