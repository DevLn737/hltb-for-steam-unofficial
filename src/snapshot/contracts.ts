export interface SnapshotBucketInfo {
  name: string;
  entries: number;
  compressedBytes: number;
  uncompressedBytes: number;
  sha256: string;
  uncompressedSha256: string;
}

export interface SnapshotManifestV3 {
  schema: 3;
  compression: 'gzip';
  sourceUpdatedAt: string;
  sourceEntryCount: number;
  timedEntryCount: number;
  entryCount: number;
  normalizedTitleCount: number;
  titleCollisionCount: number;
  titleCollisionRecordCount: number;
  steamMappingCount: number;
  steamCollisionCount: number;
  bucketCount: 64;
  origin: string;
  titleBuckets: SnapshotBucketInfo[];
  steamBuckets: SnapshotBucketInfo[];
}

export interface SnapshotPackEntry extends SnapshotBucketInfo {
  path: string;
  kind: 'title' | 'steam';
  offset: number;
}

export interface SnapshotManifestV4 {
  schema: 4;
  snapshotVersion: string;
  compression: 'gzip';
  sourceUpdatedAt: string;
  generatedAt: string;
  sourceEntryCount: number;
  timedEntryCount: number;
  entryCount: number;
  normalizedTitleCount: number;
  titleCollisionCount: number;
  titleCollisionRecordCount: number;
  steamMappingCount: number;
  steamCollisionCount: number;
  bucketCount: 64;
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
  schema: 3 | 4;
  compression: 'gzip';
  sourceUpdatedAt: string;
  bucketCount: 64;
  titleBuckets: SnapshotBucketInfo[];
  steamBuckets: SnapshotBucketInfo[];
}

