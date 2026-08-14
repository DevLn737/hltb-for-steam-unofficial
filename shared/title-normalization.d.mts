export const SNAPSHOT_BUCKET_COUNT: 16;
export function normalizeTitle(value: unknown): string;
export function normalizeTitleLegacy(value: unknown): string;
export function snapshotBucket(normalizedTitle: string, bucketCount?: number): number;
export function compareNormalizedTitles(left: string, right: string): number;
