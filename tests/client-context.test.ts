import { describe, expect, it } from 'vitest';
import { detectClientContext } from '../src/core/client-context';

describe('client context detection', () => {
  it('detects the embedded Steam Chromium user agent', () => {
    expect(detectClientContext('Mozilla/5.0 (Windows NT 10.0; Win64; x64; Valve Steam Client) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36'))
      .toBe('steam');
  });

  it.each([
    'Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 Firefox/128.0',
    'Mozilla/5.0 Edg/126.0.0.0',
  ])('treats a normal browser as browser mode: %s', (userAgent) => {
    expect(detectClientContext(userAgent)).toBe('browser');
  });
});
