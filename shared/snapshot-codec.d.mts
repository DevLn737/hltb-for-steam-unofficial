export type SteamIndexPair = [appId: number, packedLocation: number];
export function packSnapshotLocation(bucket: number, rowIndex: number): number;
export function unpackSnapshotLocation(value: number): { bucket: number; rowIndex: number };
export function encodeSteamIndex(pairs: SteamIndexPair[]): Uint8Array;
export function decodeSteamIndex(bytes: Uint8Array): SteamIndexPair[];
