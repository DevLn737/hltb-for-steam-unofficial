export interface SnapshotBucketInfo {
  name: string;
  entries: number;
  compressedBytes: number;
  uncompressedBytes: number;
  sha256: string;
  uncompressedSha256: string;
}

export interface PackagedSnapshotManifestV7 {
  schema: 7;
  format: 'front-coded-uleb128-delta-v3';
  compression: 'gzip';
  sourceUpdatedAt: string;
  baselineUpdatedAt: string;
  checkedDates: string[];
  sourceEntryCount: number;
  timedEntryCount: number;
  entryCount: number;
  originalEntryCount: number;
  excludedEntryCount: number;
  normalizedTitleCount: number;
  titleCollisionCount: number;
  titleCollisionRecordCount: number;
  steamMappingCount: number;
  steamCollisionCount: number;
  bucketCount: 16;
  origin: string;
  titleBuckets: SnapshotBucketInfo[];
  steamBuckets: SnapshotBucketInfo[];
}

export interface SnapshotPackEntry extends SnapshotBucketInfo {
  path: string;
  kind: 'title' | 'steam';
  offset: number;
}

export interface SnapshotManifestV7 {
  schema: 7;
  format: 'front-coded-uleb128-delta-v3';
  snapshotVersion: string;
  compression: 'gzip';
  sourceUpdatedAt: string;
  baselineUpdatedAt: string;
  checkedDates: string[];
  generatedAt: string;
  sourceEntryCount: number;
  timedEntryCount: number;
  entryCount: number;
  originalEntryCount: number;
  excludedEntryCount: number;
  normalizedTitleCount: number;
  titleCollisionCount: number;
  titleCollisionRecordCount: number;
  steamMappingCount: number;
  steamCollisionCount: number;
  bucketCount: 16;
  origin: string;
  source: {
    lastGameId: number;
    databaseSha256: string;
  };
  pack: {
    path: 'snapshot.pack';
    bytes: number;
    sha256: string;
  };
  entries: SnapshotPackEntry[];
}

export interface RemoteSnapshotPointer {
  schema: 1;
  snapshotVersion: string;
  generatedAt: string;
  manifestPath: string;
  manifestSha256: string;
}

export type SnapshotUpdateStatus = 'skipped' | 'current' | 'updated' | 'failed';

export interface SnapshotUpdateState {
  status: SnapshotUpdateStatus;
  checkedAt: number;
  activeVersion?: string;
  error?: string;
}

export interface SnapshotLookupManifest {
  schema: 7;
  format: 'front-coded-uleb128-delta-v3';
  compression: 'gzip';
  sourceUpdatedAt: string;
  baselineUpdatedAt: string;
  checkedDates: string[];
  bucketCount: 16;
  titleBuckets: SnapshotBucketInfo[];
  steamBuckets: SnapshotBucketInfo[];
}
