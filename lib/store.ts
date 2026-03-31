import { Manifiesto, DayRecord, AuditEntry, GuiaTracking } from './types';

const DATA_KEY = 'manifiestos-data';

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

// ── KV read/write helpers ──

async function loadStore(kv: KVNamespace): Promise<StoreData> {
  try {
    const raw = await kv.get(DATA_KEY, 'text');
    if (!raw) return { ...emptyStore };
    const data = JSON.parse(raw) as StoreData;
    if (!data.auditLog) data.auditLog = [];
    if (!data._version) data._version = 0;
    if (!data.history) data.history = [];
    if (!data.pendingFromYesterday) data.pendingFromYesterday = [];
    if (!data.manifiestos) data.manifiestos = [];
    return data;
  } catch {
    return { ...emptyStore };
  }
}

async function saveStore(kv: KVNamespace, data: StoreData): Promise<void> {
  data._version = (data._version || 0) + 1;
  await kv.put(DATA_KEY, JSON.stringify(data));
}

// ── Public API ──

export async function getAll(kv: KVNamespace): Promise<{
  manifiestos: Manifiesto[];
  pending: Manifiesto[];
  auditLog: AuditEntry[];
  _version: number;
}> {
  const store = await loadStore(kv);
  return {
    manifiestos: store.manifiestos,
    pending: store.pendingFromYesterday,
    auditLog: store.auditLog,
    _version: store._version,
  };
}

export async function addManifiesto(kv: KVNamespace, m: Manifiesto): Promise<void> {
  const store = await loadStore(kv);
  const exists = store.manifiestos.find(x => x.numero === m.numero);
  if (!exists) {
    store.manifiestos.push(m);
    await saveStore(kv, store);
  }
}

export async function deleteManifiesto(kv: KVNamespace, manifiestoId: string): Promise<boolean> {
  const store = await loadStore(kv);
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

  await saveStore(kv, store);
  return true;
}

export async function updateGuiaCheck(
  kv: KVNamespace,
  manifiestoId: string,
  guiaNumero: string,
  checked: boolean
): Promise<void> {
  const store = await loadStore(kv);
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
    await saveStore(kv, store);
  }
}

export async function finalizeDay(kv: KVNamespace): Promise<DayRecord | null> {
  const store = await loadStore(kv);
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

  await saveStore(kv, store);
  return record;
}

export async function getHistory(kv: KVNamespace): Promise<DayRecord[]> {
  const store = await loadStore(kv);
  return store.history;
}

// ── PDF Storage in KV ──

export async function storePdf(kv: KVNamespace, fileName: string, base64Data: string): Promise<void> {
  await kv.put(`pdf:${fileName}`, base64Data);
}

export async function getPdf(kv: KVNamespace, fileName: string): Promise<string | null> {
  return await kv.get(`pdf:${fileName}`, 'text');
}

// ── Tracking Storage ──

export async function saveTracking(kv: KVNamespace, tracking: GuiaTracking): Promise<void> {
  const all = await getAllTracking(kv);
  const idx = all.findIndex(t => t.guiaNumero === tracking.guiaNumero);
  if (idx >= 0) {
    all[idx] = tracking;
  } else {
    all.push(tracking);
  }
  await kv.put('tracking-data', JSON.stringify(all));
}

export async function getAllTracking(kv: KVNamespace): Promise<GuiaTracking[]> {
  try {
    const raw = await kv.get('tracking-data', 'text');
    if (!raw) return [];
    return JSON.parse(raw) as GuiaTracking[];
  } catch {
    return [];
  }
}

export async function saveBulkTracking(kv: KVNamespace, trackings: GuiaTracking[]): Promise<void> {
  const all = await getAllTracking(kv);
  for (const t of trackings) {
    const idx = all.findIndex(x => x.guiaNumero === t.guiaNumero);
    if (idx >= 0) {
      all[idx] = t;
    } else {
      all.push(t);
    }
  }
  await kv.put('tracking-data', JSON.stringify(all));
}
