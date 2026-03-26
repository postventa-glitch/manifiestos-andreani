import { put, list, del } from '@vercel/blob';
import { Manifiesto, DayRecord, AuditEntry } from './types';

const STORE_KEY = 'manifiestos-data.json';

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

// In-memory cache to reduce blob reads
let _cache: StoreData | null = null;
let _cacheTime = 0;
const CACHE_TTL = 2000; // 2 seconds — fresh enough for real-time, avoids hammering blob

async function findBlobUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: STORE_KEY });
    if (blobs.length > 0) return blobs[0].url;
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
    const url = await findBlobUrl();
    if (!url) return { ...emptyStore };
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { ...emptyStore };
    const data = await res.json();
    // Migrate old data that doesn't have auditLog
    if (!data.auditLog) data.auditLog = [];
    if (!data._version) data._version = 0;
    _cache = data as StoreData;
    _cacheTime = Date.now();
    return _cache;
  } catch {
    return { ...emptyStore };
  }
}

async function saveStore(data: StoreData): Promise<void> {
  data._version = (data._version || 0) + 1;
  try {
    const url = await findBlobUrl();
    if (url) await del(url);
    await put(STORE_KEY, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
    });
    // Update cache immediately after write
    _cache = data;
    _cacheTime = Date.now();
  } catch (e) {
    console.error('Failed to save store:', e);
  }
}

// ── Public API (all async) ──

export async function getAll(): Promise<{
  manifiestos: Manifiesto[];
  pending: Manifiesto[];
  auditLog: AuditEntry[];
}> {
  const store = await loadStore();
  return {
    manifiestos: store.manifiestos,
    pending: store.pendingFromYesterday,
    auditLog: store.auditLog,
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

      // Add audit entry
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

  // Move unchecked guias to pending for next day
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
