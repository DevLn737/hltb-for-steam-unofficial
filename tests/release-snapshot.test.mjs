// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { verifyReleaseFreshness } from '../scripts/verify-release-snapshot.mjs';

const now = Date.parse('2026-10-12T04:00:00Z');
const current = {
  sourceUpdatedAt: '2026-10-12',
  checkedDates: ['2026-09-05', '2026-10-12'],
  origin: 'Private updater; packaged from signed snapshot 2026.10.12.1',
};

describe('release snapshot freshness gate', () => {
  it('accepts fresh signed incremental data without relabeling older game checks', () => {
    expect(verifyReleaseFreshness(current, now)).toBe('2026-10-12');
  });

  it('rejects the stale September database even with a new extension version', () => {
    expect(() => verifyReleaseFreshness({ ...current, sourceUpdatedAt: '2026-09-07' }, now)).toThrow(/stale/);
  });

  it('accepts the exact 72-hour limit and rejects an older snapshot', () => {
    const source = Date.parse('2026-10-12T00:00:00Z');
    expect(verifyReleaseFreshness(current, source + 72 * 60 * 60 * 1000)).toBe('2026-10-12');
    expect(() => verifyReleaseFreshness(current, source + 72 * 60 * 60 * 1000 + 1)).toThrow(/stale/);
  });

  it('rejects future dates', () => {
    expect(() => verifyReleaseFreshness({ ...current, sourceUpdatedAt: '2026-10-13' }, now)).toThrow(/future/);
  });

  it.each(['2026-02-30', '2026-10-12T00:00:00Z', undefined])('rejects an invalid source date: %s', (sourceUpdatedAt) => {
    expect(() => verifyReleaseFreshness({ ...current, sourceUpdatedAt }, now)).toThrow(/invalid source date/);
  });

  it('requires actual successful checks on the source date', () => {
    expect(() => verifyReleaseFreshness({ ...current, checkedDates: ['2026-09-05'] }, now)).toThrow(/no successful/);
  });

  it('rejects data without signed-channel provenance', () => {
    expect(() => verifyReleaseFreshness({ ...current, origin: 'Unsigned import' }, now)).toThrow(/signed snapshot channel/);
  });
});
