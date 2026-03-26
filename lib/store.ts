import { Manifiesto, DayRecord } from './types';

// In-memory store — persists across requests within the same serverless instance.
// For production persistence, swap with Vercel KV or a database.

declare global {
  var __store: {
    manifiestos: Manifiesto[];
    history: DayRecord[];
    pendingFromYesterday: Manifiesto[];
  } | undefined;
}

function getStore() {
  if (!global.__store) {
    global.__store = {
      manifiestos: [],
      history: [],
      pendingFromYesterday: [],
    };
  }
  return global.__store;
}

export function getManifiestos(): Manifiesto[] {
  return getStore().manifiestos;
}

export function getPendingFromYesterday(): Manifiesto[] {
  return getStore().pendingFromYesterday;
}

export function addManifiesto(m: Manifiesto) {
  const store = getStore();
  // Avoid duplicates by manifest number
  const exists = store.manifiestos.find(x => x.numero === m.numero);
  if (!exists) {
    store.manifiestos.push(m);
  }
}

export function updateGuiaCheck(manifiestoId: string, guiaNumero: string, checked: boolean) {
  const store = getStore();
  const allManifiestos = [...store.manifiestos, ...store.pendingFromYesterday];
  const manifiesto = allManifiestos.find(m => m.id === manifiestoId);
  if (manifiesto) {
    const guia = manifiesto.guias.find(g => g.numero === guiaNumero);
    if (guia) {
      guia.checked = checked;
      guia.checkedAt = checked ? new Date().toISOString() : null;
    }
  }
}

export function finalizeDay(): DayRecord | null {
  const store = getStore();
  if (store.manifiestos.length === 0) return null;

  const today = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const totalGuias = store.manifiestos.reduce((sum, m) => sum + m.guias.length, 0);
  const completedGuias = store.manifiestos.reduce(
    (sum, m) => sum + m.guias.filter(g => g.checked).length, 0
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

  return record;
}

export function getHistory(): DayRecord[] {
  return getStore().history;
}

export function getAllGuiasFlat() {
  const store = getStore();
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
