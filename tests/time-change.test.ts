import { describe, expect, it } from 'vitest';
import { describeTimeChange } from '../src/ui/time-change';

describe('completion-time change formatting', () => {
  const baseline = Date.UTC(2026, 6, 22);

  it('formats increases and decreases in both time formats', () => {
    expect(describeTimeChange({ kind: 'delta', minutes: 30 }, 'decimal', 'en', baseline)?.text).toBe('▲ 0.5h');
    expect(describeTimeChange({ kind: 'delta', minutes: -75 }, 'hoursMinutes', 'en', baseline)?.text).toBe('▼ 1h 15m');
  });

  it('localizes new and removed states', () => {
    expect(describeTimeChange({ kind: 'new' }, 'decimal', 'ru', baseline)?.text).toBe('НОВОЕ');
    expect(describeTimeChange({ kind: 'removed', previous: 60 }, 'decimal', 'de', baseline)?.text).toBe('ENTFERNT');
  });

  it('hides unchanged and decimal changes that round to zero', () => {
    expect(describeTimeChange(null, 'decimal', 'en', baseline)).toBeNull();
    expect(describeTimeChange({ kind: 'delta', minutes: 10 }, 'decimal', 'en', baseline)).toBeNull();
    expect(describeTimeChange({ kind: 'delta', minutes: 10 }, 'hoursMinutes', 'en', baseline)?.text).toBe('▲ 10m');
  });
});
