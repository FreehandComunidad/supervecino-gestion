export type PendingSale = { fingerprint: string; key: string }
export type PendingSaleStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export const PENDING_SALE_STORAGE_KEY: string
export function getPendingSaleKey(storage: PendingSaleStorage | null, fingerprint: string, createKey: () => string, inMemoryPending?: PendingSale | null): string
export function clearPendingSaleKey(storage: PendingSaleStorage | null): void
