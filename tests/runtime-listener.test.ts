import { describe, expect, it, vi } from 'vitest';
import { createRuntimeMessageListener } from '../src/background/runtime-listener';

describe('Chrome runtime message listener', () => {
  it('keeps the channel open and responds after asynchronous work', async () => {
    const handler = vi.fn(async () => ({ ok: true, cleared: true } as const));
    const sendResponse = vi.fn();
    const listener = createRuntimeMessageListener(handler);

    expect(listener({ type: 'CLEAR_CACHE' }, {}, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true, cleared: true }));
  });

  it('always sends a controlled response when the handler rejects', async () => {
    const listener = createRuntimeMessageListener(async () => { throw new Error('boom'); });
    const sendResponse = vi.fn();

    expect(listener({}, {}, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'service_error' }));
  });
});
