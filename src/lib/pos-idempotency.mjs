export const PENDING_SALE_STORAGE_KEY = 'supervecino_pending_sale'
/** Reuses the key for the same unresolved checkout and rotates it for a new cart. */
export function getPendingSaleKey(storage, fingerprint, createKey, inMemoryPending = null) {
  if (inMemoryPending?.fingerprint === fingerprint && typeof inMemoryPending.key === 'string') return inMemoryPending.key
  try { const pending = JSON.parse(storage?.getItem(PENDING_SALE_STORAGE_KEY) || 'null'); if (pending?.fingerprint === fingerprint && typeof pending.key === 'string') return pending.key } catch {}
  const key = createKey()
  try { storage?.setItem(PENDING_SALE_STORAGE_KEY, JSON.stringify({ fingerprint, key })) } catch {}
  return key
}
export function clearPendingSaleKey(storage) { try { storage?.removeItem(PENDING_SALE_STORAGE_KEY) } catch {} }
