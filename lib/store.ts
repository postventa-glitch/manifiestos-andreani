import { put, list, del } from '@vercel/blob';
import { Manifiesto, DayRecord } from './types';

const STORE_KEY = 'manifiestos-data.json';

interface StoreData {
  manifiestos: Manifiesto[];
  history: DayRecord[];
  pendingFromYesterday: Manifiesto[];
}

const emptyStore: StoreData = {
  manifiestos: [],
  history: [],
  pendingFromYesterday: [],
};

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
  try {
    const url = await findBlobUrl();
    if (!url) return { ...emptyStore };
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { ...emptyStore };
    const data = await res.json();
    return data as StoreData;
  } catch {
    return { ...emptyStore };
  }
}

async function saveStore(data: StoreData): Promise<void> {
  try {
    // Delete old blob if exists
    const url = await findBlobUrl();
    if (url) {
      await del(url);
    }
    // Save new blob
    await put(STORE_KEY, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
    });
  } catch (e) {
    console.error('Failed to save store:', e);
  }
}

export async function getManifiestos(): Promise<Manifiesto[]> {
  const store = await loadStore();
  return store.manifiestos;
}

export async function getPendingFromYesterday(): Promise<Manifiesto[]> {
  const store = await loadStore();
  return store.pendingFromYesterday;
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
    }
    await saveStore(store);
  }
}

export async function finalizeDay(): Promise<DayRecord | null> {
  const store = await loadStore();
  if (store.manifiestos.length === 0) return null;

  const today = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const totalGuias = store.manifiestos.reduce((sum, m) => sum + m.guias.length, 0);
  const completedGuias = store.manifiestos.reduce(
    (sum, m) => sum + m.guias.filter(g => g.checked).length,
    0
  );

  const record: DayRecord = {
    date: today,
    manifiestos: JSON.parse(JSON.stringify(store.manifiestos)),
    finalizedAt: new Date().toISOString(),
    totalGuias,
    completedGuias,
  };

  store.history.push(record);

  // Move unchecked guias to pending for next day
  const pendingManifiestos: Manifiesto[] = [];
  for (const m of store.manifiestos) {
    const unchecked = m.guias.filter(g => !g.checked);
    if (unchecked.length > 0) {
      pendingManifiestos.push({
        ...m,
        id: m.id + '-pending',
        guias: unchecked.map(g => ({ ...g, checked: false, checkedAt: null })),
        totalPaquetes: unchecked.reduce((s, g) => s + g.paquetes, 0),
      });
    }
  }

  store.pendingFromYesterday = pendingManifiestos;
  store.manifiestos = [];

  await saveStore(store);
  return record;
}

export async function getHistory(): Promise<DayRecord[]> {
  const store = await loadStore();
  return store.history;
}

export async function getAllGuiasFlat() {
  const store = await loadStore();
  const all = [...store.manifiestos, ...store.pendingFromYesterday];
  return all.flatMap(m =>
    m.guias.map(g => ({
      ...g,
      manifiestoNumero: m.numero,
      manifiestoId: m.id,
      uploadedAt: m.uploadedAt,
    }))
  );
}
