import { put, list } from '@vercel/blob';
import { Manifiesto, DayRecord, AuditEntry } from './types';

/*
 * SINGLE-KEY BLOB STORE v3
 *
 * Strategy: ONE fixed blob key, overwrite with put(), read by DIRECT URL.
 * NEVER uses list() during normal reads — only once on cold start to discover URL.
 * NEVER returns empty data if we previously had data (version guard).
 * NEVER deletes anything.
 */

const BLOB_KEY = 'manifiestos-v3.json';

interface StoreData {
  manifiestos: Manifiesto[];
  history: DayRecord[];
  pendingFromYesterday: Manifiesto[];
  auditLog: AuditEntry[];
  _version: number;
}

const emptyStore: StoreData = {
  manifiestos: [],
  history: [],
  pendingFromYesterday: [],
  auditLog: [],
  _version: 0,
};

// ── Globals: persist within a single serverless instance ──
let _cache: StoreData | null = null;
let _cacheTime = 0;
let _blobUrl: string | null = null; // Direct URL to the blob — avoids list() on reads
const CACHE_TTL = 3000;

/*
 * Discover the blob URL. Called ONCE per cold start.
 * After first write, _blobUrl is set from put() response.
 */
async function discoverBlobUrl(): Promise<string | null> {
  if (_blobUrl) return _blobUrl;

  try {
    // 1. Try current key
    const { blobs } = await list({ prefix: BLOB_KEY, limit: 1 });
    if (blobs.length > 0) {
      _blobUrl = blobs[0].url;
      return _blobUrl;
    }

    // 2. Try legacy keys and migrate
    for (const prefix of ['mdata-', 'manifiestos-data.json']) {
      const legacy = await list({ prefix, limit: 5 });
      if (legacy.blobs.length > 0) {
        // Sort by newest
        const sorted = [...legacy.blobs].sort(
          (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
        const res = await fetch(sorted[0].url, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          // Migrate to new key
          const blob = await put(BLOB_KEY, JSON.stringify(data), {
            access: 'public',
            addRandomSuffix: false,
          });
          _blobUrl = blob.url;
          console.log(`Migrated from ${prefix} to ${BLOB_KEY}`);
          return _blobUrl;
        }
      }
    }

    return null;
  } catch (e) {
    console.error('discoverBlobUrl error:', e);
    return null;
  }
}

/*
 * Read the store. Uses direct URL fetch (no list()).
 * Falls back to stale cache on any error.
 * NEVER returns empty if cache has data (version guard).
 */
async function loadStore(): Promise<StoreData> {
  // Return fresh cache
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) {
    return _cache;
  }

  try {
    const url = await discoverBlobUrl();
    if (!url) {
      // No blob found — return cache if we have one, else empty
      return _cache || { ...emptyStore };
    }

    // Direct fetch with cache buster — bypasses CDN completely
    const res = await fetch(`${url}?_cb=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) {
      return _cache || { ...emptyStore };
    }

    const data = await res.json();
    if (!data.auditLog) data.auditLog = [];
    if (!data._version) data._version = 0;

    // VERSION GUARD: never downgrade to older/empty data
    if (_cache && _cache._version > 0 && data._version < _cache._version) {
      return _cache;
    }

    _cache = data as StoreData;
    _cacheTime = Date.now();
    return _cache;
  } catch {
    // Network error — ALWAYS prefer stale cache over empty
    return _cache || { ...emptyStore };
  }
}

/*
 * Write the store. Overwrites the single blob key.
 * Updates cache IMMEDIATELY so same-instance reads see new data.
 * Updates _blobUrl from put() response.
 */
async function saveStore(data: StoreData): Promise<void> {
  data._version = (data._version || 0) + 1;

  // Instant cache update
  _cache = JSON.parse(JSON.stringify(data));
  _cacheTime = Date.now();

  try {
    const blob = await put(BLOB_KEY, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
    });
    // Cache the URL — future reads skip list() entirely
    _blobUrl = blob.url;
  } catch (e) {
    console.error('saveStore error:', e);
  }
}

// ── Public API ──

export async function getAll(): Promise<{
  manifiestos: Manifiesto[];
  pending: Manifiesto[];
  auditLog: AuditEntry[];
  _version: number;
}> {
  const store = await loadStore();
  return {
    manifiestos: store.manifiestos,
    pending: store.pendingFromYesterday,
    auditLog: store.auditLog,
    _version: store._version,
  };
}

export async function addManifiesto(m: Manifiesto): Promise<void> {
  const store = await loadStore();
  const exists = store.manifiestos.find(x => x.numero === m.numero);
  if (!exists) {
    store.manifiestos.push(m);
    await saveStore(store);
  }
}

export async function deleteManifiesto(manifiestoId: string): Promise<boolean> {
  const store = await loadStore();
  const inCurrent = store.manifiestos.find(m => m.id === manifiestoId);
  const inPending = store.pendingFromYesterday.find(m => m.id === manifiestoId);
  const found = inCurrent || inPending;

  if (!found) return false;

  store.manifiestos = store.manifiestos.filter(m => m.id !== manifiestoId);
  store.pendingFromYesterday = store.pendingFromYesterday.filter(m => m.id !== manifiestoId);

  store.auditLog.push({
    guiaNumero: '-',
    manifiestoId,
    action: 'deleted',
    timestamp: new Date().toISOString(),
    detail: `Manifiesto ${found.numero} eliminado (${found.guias.length} guias)`,
  });

  await saveStore(store);
  return true;
}

export async function updateGuiaCheck(
  manifiestoId: string,
  guiaNumero: string,
  checked: boolean
): Promise<void> {
  const store = await loadStore();
  const allManifiestos = [...store.manifiestos, ...store.pendingFromYesterday];
  const manifiesto = allManifiestos.find(m => m.id === manifiestoId);
  if (manifiesto) {
    const guia = manifiesto.guias.find(g => g.numero === guiaNumero);
    if (guia) {
      guia.checked = checked;
      guia.checkedAt = checked ? new Date().toISOString() : null;

      store.auditLog.push({
        guiaNumero,
        manifiestoId,
        action: checked ? 'checked' : 'unchecked',
        timestamp: new Date().toISOString(),
      });
    }
    await saveStore(store);
  }
}

export async function finalizeDay(): Promise<DayRecord | null> {
  const store = await loadStore();
  if (store.manifiestos.length === 0 && store.pendingFromYesterday.length === 0) return null;

  const today = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const allActive = [...store.manifiestos, ...store.pendingFromYesterday];
  const totalGuias = allActive.reduce((sum, m) => sum + m.guias.length, 0);
  const completedGuias = allActive.reduce(
    (sum, m) => sum + m.guias.filter(g => g.checked).length, 0
  );

  const record: DayRecord = {
    date: today,
    manifiestos: JSON.parse(JSON.stringify(allActive)),
    finalizedAt: new Date().toISOString(),
    totalGuias,
    completedGuias,
    auditLog: [...store.auditLog],
  };

  store.history.push(record);

  const pendingManifiestos: Manifiesto[] = [];
  for (const m of allActive) {
    const unchecked = m.guias.filter(g => !g.checked);
    if (unchecked.length > 0) {
      pendingManifiestos.push({
        ...m,
        id: m.id + '-pending-' + Date.now(),
        guias: unchecked.map(g => ({ ...g, checked: false, checkedAt: null })),
        totalPaquetes: unchecked.reduce((s, g) => s + g.paquetes, 0),
      });
    }
  }

  store.pendingFromYesterday = pendingManifiestos;
  store.manifiestos = [];
  store.auditLog = [];

  await saveStore(store);
  return record;
}

export async function getHistory(): Promise<DayRecord[]> {
  const store = await loadStore();
  return store.history;
}
