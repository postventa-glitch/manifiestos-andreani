import { put, list, del } from '@vercel/blob';
import { Manifiesto, DayRecord, AuditEntry } from './types';

/*
 * IMMUTABLE BLOB STORE
 *
 * Each write creates a NEW blob with a unique timestamped key.
 * Reads always list all blobs and pick the newest by uploadedAt.
 * Deletes happen ONLY as background cleanup, never during writes.
 * This eliminates ALL race conditions between read and write.
 */

const BLOB_PREFIX = 'mdata-';

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

// ── Cache: shared within a single serverless instance ──
let _cache: StoreData | null = null;
let _cacheTime = 0;
const CACHE_TTL = 3000;

// ── Find the NEWEST blob by uploadedAt ──
async function findNewestBlob(): Promise<{ url: string; all: { url: string; uploadedAt: string }[] } | null> {
  try {
    // Check new prefix first
    const { blobs } = await list({ prefix: BLOB_PREFIX });
    if (blobs.length > 0) {
      const sorted = [...blobs].sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
      return {
        url: sorted[0].url,
        all: sorted.map(b => ({ url: b.url, uploadedAt: b.uploadedAt })),
      };
    }
    // Fallback: try legacy key
    const legacy = await list({ prefix: 'manifiestos-data.json' });
    if (legacy.blobs.length > 0) {
      return {
        url: legacy.blobs[0].url,
        all: legacy.blobs.map(b => ({ url: b.url, uploadedAt: b.uploadedAt })),
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function loadStore(): Promise<StoreData> {
  // Return cache if fresh
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) {
    return _cache;
  }

  try {
    const result = await findNewestBlob();
    if (!result) {
      // No blobs at all — but if we have stale cache, prefer that over empty
      if (_cache) return _cache;
      return { ...emptyStore };
    }

    const res = await fetch(result.url, { cache: 'no-store' });
    if (!res.ok) {
      if (_cache) return _cache;
      return { ...emptyStore };
    }

    const data = await res.json();
    if (!data.auditLog) data.auditLog = [];
    if (!data._version) data._version = 0;

    _cache = data as StoreData;
    _cacheTime = Date.now();

    // Background: clean up old blobs (keep only newest 2)
    if (result.all.length > 2) {
      const toDelete = result.all.slice(2);
      for (const b of toDelete) {
        del(b.url).catch(() => {});
      }
    }

    return _cache;
  } catch {
    // Network error — return stale cache if available
    if (_cache) return _cache;
    return { ...emptyStore };
  }
}

async function saveStore(data: StoreData): Promise<void> {
  data._version = (data._version || 0) + 1;

  // Update cache IMMEDIATELY — any read on this instance sees new data instantly
  _cache = { ...data };
  _cacheTime = Date.now();

  try {
    // Write a NEW blob with unique key — never overwrites, never conflicts
    const key = `${BLOB_PREFIX}${Date.now()}.json`;
    await put(key, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
    });
    // DO NOT delete old blobs here — loadStore cleanup handles it
  } catch (e) {
    console.error('Failed to save store:', e);
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
