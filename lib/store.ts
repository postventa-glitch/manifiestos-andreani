import { put, list, del } from '@vercel/blob';
import { Manifiesto, DayRecord, AuditEntry } from './types';

const STORE_PREFIX = 'store-v2-';

interface StoreData {
  manifiestos: Manifiesto[];
  history: DayRecord[];
  pendingFromYesterday: Manifiesto[];
  auditLog: AuditEntry[];
  _version: number;
  _savedAt: string;
}

const emptyStore: StoreData = {
  manifiestos: [],
  history: [],
  pendingFromYesterday: [],
  auditLog: [],
  _version: 0,
  _savedAt: new Date().toISOString(),
};

// ── Robust in-memory cache ──
let _cache: StoreData | null = null;
let _cacheTime = 0;
const CACHE_TTL = 1500;

// ── Write mutex to prevent concurrent saves ──
let _writeLock: Promise<void> = Promise.resolve();

async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const prev = _writeLock;
  _writeLock = new Promise<void>(res => { release = res; });
  await prev;
  try {
    return await fn();
  } finally {
    release!();
  }
}

// ── Find the latest blob (by version in content, not by URL) ──
async function findLatestBlob(): Promise<{ url: string; allUrls: string[] } | null> {
  try {
    const { blobs } = await list({ prefix: STORE_PREFIX });
    if (blobs.length === 0) {
      // Try legacy key
      const legacy = await list({ prefix: 'manifiestos-data.json' });
      if (legacy.blobs.length > 0) {
        return { url: legacy.blobs[0].url, allUrls: legacy.blobs.map(b => b.url) };
      }
      return null;
    }
    // Sort by uploadedAt descending — newest first
    const sorted = blobs.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
    return {
      url: sorted[0].url,
      allUrls: sorted.map(b => b.url),
    };
  } catch {
    return null;
  }
}

async function loadStore(): Promise<StoreData> {
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) {
    return _cache;
  }

  try {
    const result = await findLatestBlob();
    if (!result) return { ...emptyStore };

    const res = await fetch(result.url, { cache: 'no-store' });
    if (!res.ok) return { ...emptyStore };

    const data = await res.json();
    if (!data.auditLog) data.auditLog = [];
    if (!data._version) data._version = 0;
    if (!data._savedAt) data._savedAt = new Date().toISOString();

    _cache = data as StoreData;
    _cacheTime = Date.now();

    // Background cleanup: delete old blobs (keep only the newest)
    if (result.allUrls.length > 1) {
      const oldUrls = result.allUrls.slice(1);
      Promise.all(oldUrls.map(url => del(url).catch(() => {}))).catch(() => {});
    }

    return _cache;
  } catch {
    // If load fails but we have cache, return stale cache
    if (_cache) return _cache;
    return { ...emptyStore };
  }
}

async function saveStore(data: StoreData): Promise<void> {
  data._version = (data._version || 0) + 1;
  data._savedAt = new Date().toISOString();

  try {
    // WRITE-FIRST: create new blob before deleting old ones
    // Use timestamped key so blobs don't collide
    const key = `${STORE_PREFIX}${Date.now()}.json`;
    await put(key, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
    });

    // Update cache immediately
    _cache = data;
    _cacheTime = Date.now();

    // Background cleanup: delete all older blobs
    const { blobs } = await list({ prefix: STORE_PREFIX });
    const sorted = blobs.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
    // Keep only the newest
    if (sorted.length > 1) {
      const toDelete = sorted.slice(1);
      Promise.all(toDelete.map(b => del(b.url).catch(() => {}))).catch(() => {});
    }

    // Also cleanup legacy blobs
    const legacy = await list({ prefix: 'manifiestos-data.json' });
    if (legacy.blobs.length > 0) {
      Promise.all(legacy.blobs.map(b => del(b.url).catch(() => {}))).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to save store:', e);
    // Still update cache so local reads work
    _cache = data;
    _cacheTime = Date.now();
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
  return withWriteLock(async () => {
    const store = await loadStore();
    const exists = store.manifiestos.find(x => x.numero === m.numero);
    if (!exists) {
      store.manifiestos.push(m);
      await saveStore(store);
    }
  });
}

export async function deleteManifiesto(manifiestoId: string): Promise<boolean> {
  return withWriteLock(async () => {
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
  });
}

export async function updateGuiaCheck(
  manifiestoId: string,
  guiaNumero: string,
  checked: boolean
): Promise<void> {
  return withWriteLock(async () => {
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
  });
}

export async function finalizeDay(): Promise<DayRecord | null> {
  return withWriteLock(async () => {
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
  });
}

export async function getHistory(): Promise<DayRecord[]> {
  const store = await loadStore();
  return store.history;
}
