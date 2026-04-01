'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Guia {
  numero: string;
  paquetes: number;
  checked: boolean;
  checkedAt: string | null;
}

interface AuditEntry {
  guiaNumero: string;
  manifiestoId: string;
  action: 'checked' | 'unchecked';
  timestamp: string;
}

interface Manifiesto {
  id: string;
  numero: string;
  fecha: string;
  sucursal: string;
  direccion: string;
  email: string;
  telefono: string;
  guias: Guia[];
  pesoTotal: string;
  totalPaquetes: number;
  uploadedAt: string;
  zona?: 'puerto_madryn' | 'buenos_aires';
}

// Fixed company info
const EMPRESA = {
  sucursal: 'ANDREANI',
  direccion: 'Nino Incorvay 976, 9120 Puerto Madryn',
  email: 'postventa@promarineantioxidants.com',
  telefono: '+5492804029031',
};

type ZonaFilter = 'all' | 'puerto_madryn' | 'buenos_aires';

export default function PublicPage() {
  const [manifiestos, setManifiestos] = useState<Manifiesto[]>([]);
  const [pending, setPending] = useState<Manifiesto[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [zonaFilter, setZonaFilter] = useState<ZonaFilter>('all');
  const [loading, setLoading] = useState(true);
  const [showAudit, setShowAudit] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const lastVersion = useRef<number>(0);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sequential queue for server writes
  const checkQueue = useRef<Array<{ manifiestoId: string; guiaNumero: string; checked: boolean }>>([]);
  const isProcessing = useRef(false);
  // Cooldown: block all syncs for N ms after last local change
  const lastLocalChange = useRef<number>(0);
  const SYNC_COOLDOWN = 4000; // 4s cooldown after last click before allowing server sync
  // Debounce per guia
  const lastClickTime = useRef<Record<string, number>>({});

  const isBusy = () => {
    return checkQueue.current.length > 0 || isProcessing.current || (Date.now() - lastLocalChange.current < SYNC_COOLDOWN);
  };

  const processQueue = useCallback(async () => {
    if (isProcessing.current || checkQueue.current.length === 0) return;
    isProcessing.current = true;

    while (checkQueue.current.length > 0) {
      const op = checkQueue.current.shift()!;
      try {
        const res = await fetch('/api/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(op),
        });
        const data = await res.json();
        lastVersion.current = data._version || lastVersion.current;
      } catch {}
    }

    isProcessing.current = false;
    // Schedule sync well after cooldown expires
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(syncFromServer, SYNC_COOLDOWN + 500);
  }, []);

  const syncFromServer = useCallback(async () => {
    // STRICT guard: never sync if user has been clicking recently
    if (isBusy()) return;
    try {
      const res = await fetch('/api/manifiestos');
      const data = await res.json();
      const serverVersion = data._version || 0;
      // Double-check after await — user may have clicked during fetch
      if (!isBusy() && serverVersion >= lastVersion.current) {
        setManifiestos(data.manifiestos || []);
        setPending(data.pending || []);
        setAuditLog(data.auditLog || []);
        lastVersion.current = serverVersion;
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    syncFromServer();
    const interval = setInterval(syncFromServer, 6000);
    return () => { clearInterval(interval); if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [syncFromServer]);

  const handleCheck = (manifiestoId: string, guiaNumero: string, checked: boolean) => {
    // Debounce: ignore clicks within 400ms on same guia
    const key = `${manifiestoId}-${guiaNumero}`;
    const now = Date.now();
    if (lastClickTime.current[key] && now - lastClickTime.current[key] < 400) return;
    lastClickTime.current[key] = now;
    lastLocalChange.current = now; // Mark cooldown

    // Instant optimistic update
    const updateList = (list: Manifiesto[]) =>
      list.map(m =>
        m.id === manifiestoId
          ? { ...m, guias: m.guias.map(g => g.numero === guiaNumero ? { ...g, checked, checkedAt: checked ? new Date().toISOString() : null } : g) }
          : m
      );

    setManifiestos(prev => updateList(prev));
    setPending(prev => updateList(prev));
    setAuditLog(prev => [...prev, { guiaNumero, manifiestoId, action: checked ? 'checked' : 'unchecked', timestamp: new Date().toISOString() }]);

    checkQueue.current.push({ manifiestoId, guiaNumero, checked });
    processQueue();
  };

  const handleSelectAll = (manifiestoId: string, checked: boolean) => {
    const now = Date.now();
    lastLocalChange.current = now;

    // Find the manifest
    const all = [...manifiestos, ...pending];
    const manifiesto = all.find(m => m.id === manifiestoId);
    if (!manifiesto) return;

    // Only toggle guias that need changing
    const guiasToToggle = manifiesto.guias.filter(g => g.checked !== checked);
    if (guiasToToggle.length === 0) return;

    // Optimistic update all at once
    const updateList = (list: Manifiesto[]) =>
      list.map(m =>
        m.id === manifiestoId
          ? { ...m, guias: m.guias.map(g => ({ ...g, checked, checkedAt: checked ? new Date().toISOString() : null })) }
          : m
      );

    setManifiestos(prev => updateList(prev));
    setPending(prev => updateList(prev));

    // Queue each guia change for server
    for (const g of guiasToToggle) {
      const key = `${manifiestoId}-${g.numero}`;
      lastClickTime.current[key] = now;
      setAuditLog(prev => [...prev, { guiaNumero: g.numero, manifiestoId, action: checked ? 'checked' : 'unchecked', timestamp: new Date().toISOString() }]);
      checkQueue.current.push({ manifiestoId, guiaNumero: g.numero, checked });
    }
    processQueue();
  };

  const handleFinalize = async () => {
    // Wait for queue to drain first
    while (checkQueue.current.length > 0 || isProcessing.current) {
      await new Promise(r => setTimeout(r, 200));
    }

    const unchecked = allManifiestos.flatMap(m => m.guias.filter(g => !g.checked));
    const msg = unchecked.length > 0
      ? `Finalizar dia? ${unchecked.length} guia(s) quedan pendientes y pasan al dia siguiente.`
      : 'Finalizar dia? Todas las guias estan completas.';
    if (!confirm(msg)) return;

    setFinalizing(true);
    setFinalizeResult(null);
    try {
      const res = await fetch('/api/finalize', { method: 'POST' });
      const data = await res.json();
      if (data.record) {
        setFinalizeResult(
          `Dia finalizado: ${data.record.completedGuias}/${data.record.totalGuias} guias completadas.`
        );
        setShowPrint(true);
        await syncFromServer();
      } else {
        setFinalizeResult('Error: ' + (data.error || 'No se pudo finalizar'));
      }
    } catch {
      setFinalizeResult('Error de conexion');
    } finally {
      setFinalizing(false);
    }
  };

  const allManifiestos = [...pending, ...manifiestos];

  // Zona filter
  const filterByZona = (list: Manifiesto[]) =>
    zonaFilter === 'all' ? list : list.filter(m => (m.zona || 'puerto_madryn') === zonaFilter);

  const filteredManifiestos = filterByZona(manifiestos);
  const filteredPending = filterByZona(pending);
  const filteredAll = [...filteredPending, ...filteredManifiestos];

  // Counts for filter buttons
  const pmCount = allManifiestos.filter(m => (m.zona || 'puerto_madryn') === 'puerto_madryn').reduce((s, m) => s + m.guias.length, 0);
  const baCount = allManifiestos.filter(m => m.zona === 'buenos_aires').reduce((s, m) => s + m.guias.length, 0);

  const totalGuias = filteredAll.reduce((s, m) => s + m.guias.length, 0);
  const checkedGuias = filteredAll.reduce((s, m) => s + m.guias.filter(g => g.checked).length, 0);
  const pct = totalGuias > 0 ? (checkedGuias / totalGuias) * 100 : 0;

  const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-azul font-mono text-lg animate-pulse">Cargando manifiestos...</div>
      </div>
    );
  }

  if (allManifiestos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-6xl">📦</div>
        <div className="text-azul font-mono text-xl font-semibold">Sin manifiestos</div>
        <div className="text-gray-500 text-sm">Los manifiestos aparecen cuando el admin sube los PDFs</div>
        {finalizeResult && (
          <div className="bg-green-50 text-green-800 font-mono text-sm p-4 rounded-lg max-w-md text-center">
            {finalizeResult}
          </div>
        )}
      </div>
    );
  }

  // Print view
  if (showPrint) {
    return <PrintView manifiestos={allManifiestos} date={today} onClose={() => setShowPrint(false)} />;
  }

  return (
    <div className="py-8 px-4 no-print">
      {/* Top Bar */}
      <div className="max-w-[860px] mx-auto bg-azul text-white flex items-center justify-between px-7 py-3.5 rounded-t-xl">
        <div className="font-mono text-[22px] font-semibold tracking-[3px]">ANDREANI</div>
        <div className="flex items-center gap-4">
          <div className="font-mono text-xs opacity-65">Manifiestos de Carga &middot; {today}</div>
          <button onClick={() => setShowAudit(!showAudit)} className="text-white/60 hover:text-white font-mono text-[10px] uppercase tracking-wider">
            [{showAudit ? 'Ocultar' : 'Historial'}]
          </button>
        </div>
      </div>

      {/* Zona Filter Buttons */}
      {(pmCount > 0 || baCount > 0) && (
        <div className="max-w-[860px] mx-auto bg-[#1a3366] flex items-center gap-2 px-7 py-2">
          <span className="font-mono text-[10px] text-white/40 uppercase tracking-wider mr-2">Zona:</span>
          <button
            onClick={() => setZonaFilter('all')}
            className={`px-3 py-1 rounded-full font-mono text-[10px] font-semibold transition-colors ${zonaFilter === 'all' ? 'bg-white text-azul' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
          >
            Todas ({allManifiestos.reduce((s, m) => s + m.guias.length, 0)})
          </button>
          {pmCount > 0 && (
            <button
              onClick={() => setZonaFilter('puerto_madryn')}
              className={`px-3 py-1 rounded-full font-mono text-[10px] font-semibold transition-colors ${zonaFilter === 'puerto_madryn' ? 'bg-blue-500 text-white' : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'}`}
            >
              Puerto Madryn ({pmCount})
            </button>
          )}
          {baCount > 0 && (
            <button
              onClick={() => setZonaFilter('buenos_aires')}
              className={`px-3 py-1 rounded-full font-mono text-[10px] font-semibold transition-colors ${zonaFilter === 'buenos_aires' ? 'bg-emerald-500 text-white' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'}`}
            >
              Buenos Aires ({baCount})
            </button>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="max-w-[860px] mx-auto bg-azul-medio flex items-center gap-3.5 px-7 py-2.5">
        <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-[#4fc3f7] rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="font-mono text-[11px] text-white/80 whitespace-nowrap">{checkedGuias} / {totalGuias} guias confirmadas</div>
      </div>

      {/* Audit Log Panel */}
      {showAudit && auditLog.length > 0 && (
        <div className="max-w-[860px] mx-auto bg-gray-900 text-gray-300 px-7 py-4 max-h-48 overflow-y-auto">
          <div className="font-mono text-[10px] uppercase tracking-wider text-gray-500 mb-2">Historial ({auditLog.length})</div>
          <div className="space-y-1">
            {[...auditLog].reverse().slice(0, 50).map((entry, i) => (
              <div key={i} className="flex items-center gap-3 font-mono text-[11px]">
                <span className="text-gray-500 w-16 shrink-0">{new Date(entry.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <span className={`w-5 text-center ${entry.action === 'checked' ? 'text-green-400' : 'text-red-400'}`}>{entry.action === 'checked' ? '+' : '-'}</span>
                <span className="text-gray-400">{entry.guiaNumero}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${entry.action === 'checked' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                  {entry.action === 'checked' ? 'HECHO' : 'DESHECHO'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Container */}
      <div className="max-w-[860px] mx-auto bg-white rounded-b-xl overflow-hidden shadow-[0_8px_40px_rgba(26,46,90,0.12)]">
        {(() => {
          const pmPending = filteredPending.filter(m => (m.zona || 'puerto_madryn') === 'puerto_madryn');
          const baPending = filteredPending.filter(m => m.zona === 'buenos_aires');
          const pmToday = filteredManifiestos.filter(m => (m.zona || 'puerto_madryn') === 'puerto_madryn');
          const baToday = filteredManifiestos.filter(m => m.zona === 'buenos_aires');
          const pmAll = [...pmPending, ...pmToday];
          const baAll = [...baPending, ...baToday];

          return (
            <>
              {/* Puerto Madryn section */}
              {pmAll.length > 0 && (
                <>
                  <div className="bg-blue-50 border-b-2 border-blue-200 px-7 py-3 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                    <span className="font-mono text-xs font-semibold text-blue-800 tracking-wider uppercase">Puerto Madryn</span>
                    <span className="font-mono text-[10px] text-blue-500 ml-auto">{pmAll.reduce((s, m) => s + m.guias.filter(g => g.checked).length, 0)}/{pmAll.reduce((s, m) => s + m.guias.length, 0)} guias</span>
                  </div>
                  {pmPending.map(m => <ManifiestoCard key={m.id} manifiesto={m} onCheck={handleCheck} onSelectAll={handleSelectAll} auditLog={auditLog} isPending />)}
                  {pmToday.map(m => <ManifiestoCard key={m.id} manifiesto={m} onCheck={handleCheck} onSelectAll={handleSelectAll} auditLog={auditLog} />)}
                </>
              )}

              {/* Buenos Aires section */}
              {baAll.length > 0 && (
                <>
                  <div className="bg-emerald-50 border-b-2 border-emerald-200 px-7 py-3 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                    <span className="font-mono text-xs font-semibold text-emerald-800 tracking-wider uppercase">Buenos Aires</span>
                    <span className="font-mono text-[10px] text-emerald-500 ml-auto">{baAll.reduce((s, m) => s + m.guias.filter(g => g.checked).length, 0)}/{baAll.reduce((s, m) => s + m.guias.length, 0)} guias</span>
                  </div>
                  {baPending.map(m => <ManifiestoCard key={m.id} manifiesto={m} onCheck={handleCheck} onSelectAll={handleSelectAll} auditLog={auditLog} isPending />)}
                  {baToday.map(m => <ManifiestoCard key={m.id} manifiesto={m} onCheck={handleCheck} onSelectAll={handleSelectAll} auditLog={auditLog} />)}
                </>
              )}
            </>
          );
        })()}

        {/* Finalize + Print */}
        <div className="px-8 py-6 border-t-2 border-dashed border-[#c8d6e8] bg-[#f5f7fa]">
          {finalizeResult && (
            <div className="mb-4 p-3 rounded-lg font-mono text-sm bg-green-50 text-green-800 border border-green-200">{finalizeResult}</div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-xs text-gray-500 uppercase tracking-wider">Resumen</div>
              <div className="font-mono text-sm mt-1">
                <span className="text-verde font-semibold">{checkedGuias} completadas</span>
                {totalGuias - checkedGuias > 0 && <span className="text-rojo font-semibold ml-3">{totalGuias - checkedGuias} pendientes</span>}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPrint(true)} className="px-5 py-3 bg-gray-200 text-gray-700 font-mono text-sm font-semibold rounded-lg hover:bg-gray-300 transition-colors">
                Imprimir
              </button>
              <button onClick={handleFinalize} disabled={finalizing} className="px-6 py-3 bg-azul text-white font-mono text-sm font-semibold rounded-lg hover:bg-azul-medio disabled:opacity-50 transition-colors">
                {finalizing ? 'Finalizando...' : 'Finalizar Dia'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── MANIFIESTO CARD (checklist) ─── */
function ManifiestoCard({ manifiesto: m, onCheck, onSelectAll, auditLog, isPending }: {
  manifiesto: Manifiesto;
  onCheck: (mId: string, gNum: string, checked: boolean) => void;
  onSelectAll: (mId: string, checked: boolean) => void;
  auditLog: AuditEntry[];
  isPending?: boolean;
}) {
  const done = m.guias.filter(g => g.checked).length;
  const total = m.guias.length;
  const isComplete = done === total;
  const allChecked = done === total && total > 0;
  const noneChecked = done === 0;

  return (
    <div className={`border-b-2 border-dashed border-[#c8d6e8] px-8 py-7 last:border-b-0 ${isPending ? 'bg-amber-50/30' : ''}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[2px] text-acento">Manifiesto de Carga</div>
          <div className="font-mono text-xl font-semibold text-azul tracking-wide">N&ordm; {m.numero}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="bg-azul-claro text-azul font-mono text-xs font-semibold px-3.5 py-1.5 rounded-full">{m.fecha}</span>
          <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] px-3 py-1 rounded-full font-semibold ${isComplete ? 'bg-green-100 text-green-800' : done > 0 ? 'bg-orange-100 text-orange-800' : 'bg-orange-50 text-orange-700'}`}>
            <span className={`w-[7px] h-[7px] rounded-full ${isComplete ? 'bg-green-500' : 'bg-orange-400'}`} />
            {isComplete ? 'Completo' : done > 0 ? `En curso (${done}/${total})` : 'Pendiente'}
          </span>
        </div>
      </div>

      {/* Fixed Info */}
      <div className="bg-[#f5f7fa] border border-[#c8d6e8] rounded-lg p-3.5 mb-5 grid grid-cols-2 gap-y-1.5 gap-x-6 text-[13px]">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase text-[#7a8fab] tracking-wide">Sucursal</span>
          <span className="font-semibold">{EMPRESA.sucursal}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase text-[#7a8fab] tracking-wide">Direccion</span>
          <span className="font-semibold">{EMPRESA.direccion}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase text-[#7a8fab] tracking-wide">Email</span>
          <span className="font-semibold">{EMPRESA.email}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase text-[#7a8fab] tracking-wide">Telefono</span>
          <span className="font-semibold">{EMPRESA.telefono}</span>
        </div>
      </div>

      {/* Select All button */}
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-[#7a8fab]">Guias ({done}/{total})</div>
        <button
          onClick={() => onSelectAll(m.id, !allChecked)}
          className={`px-3 py-1.5 font-mono text-[10px] font-semibold rounded-lg transition-colors ${
            allChecked
              ? 'bg-red-50 text-red-600 hover:bg-red-100'
              : 'bg-green-50 text-green-700 hover:bg-green-100'
          }`}
        >
          {allChecked ? 'Deseleccionar todo' : noneChecked ? 'Seleccionar todo' : `Seleccionar restantes (${total - done})`}
        </button>
      </div>

      {/* Table */}
      <table className="w-full border-collapse text-[13px] mb-5">
        <thead>
          <tr className="bg-azul text-white">
            <th className="py-2 px-3 font-mono text-[10px] font-semibold tracking-wider uppercase text-center w-10">#</th>
            <th className="py-2 px-3 font-mono text-[10px] font-semibold tracking-wider uppercase text-left">Guia</th>
            <th className="py-2 px-3 font-mono text-[10px] font-semibold tracking-wider uppercase text-center w-16">Paq.</th>
            <th className="py-2 px-3 font-mono text-[10px] font-semibold tracking-wider uppercase text-center w-20">Hora</th>
            <th className="py-2 px-3 font-mono text-[10px] font-semibold tracking-wider uppercase text-center w-14">OK</th>
          </tr>
        </thead>
        <tbody>
          {m.guias.map((g, i) => (
            <tr
              key={g.numero}
              onClick={() => onCheck(m.id, g.numero, !g.checked)}
              className={`border-b border-[#e2e8f0] cursor-pointer select-none active:bg-blue-50 ${g.checked ? 'guia-checked bg-[#eafaf1]' : 'hover:bg-[#f0f4ff]'}`}
            >
              <td className="py-2 px-3 text-center">
                <span className={`guia-num-badge inline-block text-white font-mono text-[10px] font-semibold w-6 h-6 leading-6 rounded text-center ${g.checked ? 'bg-verde' : 'bg-azul'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
              </td>
              <td className={`py-2 px-3 font-mono text-xs tracking-wide ${g.checked ? 'line-through opacity-50' : ''}`}>{g.numero}</td>
              <td className="py-2 px-3 text-center font-mono text-xs">{g.paquetes}</td>
              <td className="py-2 px-3 text-center font-mono text-[10px] text-gray-400">
                {g.checked && g.checkedAt ? new Date(g.checkedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}
              </td>
              <td className="py-2 px-3">
                <div className="flex justify-center">
                  <input
                    type="checkbox"
                    className="guia-checkbox"
                    checked={g.checked}
                    readOnly
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1 border border-[#c8d6e8] rounded-lg p-2.5 flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-wide text-[#7a8fab]">Peso</span>
          <span className="font-mono text-lg font-semibold text-azul">{m.pesoTotal}</span>
        </div>
        <div className="flex-1 border border-[#c8d6e8] rounded-lg p-2.5 flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-wide text-[#7a8fab]">Paquetes</span>
          <span className="font-mono text-lg font-semibold text-azul">{m.totalPaquetes}</span>
        </div>
        <div className="flex-1 border border-[#c8d6e8] rounded-lg p-2.5 flex flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-wide text-[#7a8fab]">Confirmadas</span>
          <span className="font-mono text-lg font-semibold text-azul">{done}/{total}</span>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-5">
        <div className="border border-[#c8d6e8] rounded-lg p-3 pb-7">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-azul mb-1">Cliente</div>
          <div className="text-[10px] text-gray-400 italic">Nombre / firma / fecha</div>
          <div className="mt-5 border-b border-gray-300" />
        </div>
        <div className="border border-[#c8d6e8] rounded-lg p-3 pb-7">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-azul mb-1">Paqueteria</div>
          <div className="text-[10px] text-gray-400 italic">Nombre / firma / fecha</div>
          <div className="mt-5 border-b border-gray-300" />
        </div>
      </div>
    </div>
  );
}

/* ─── PRINT VIEW — A4 pages ─── */
function PrintView({ manifiestos, date, onClose }: { manifiestos: Manifiesto[]; date: string; onClose: () => void }) {
  const allGuias = manifiestos.flatMap(m => m.guias.map(g => ({ ...g, manifiestoNumero: m.numero, pesoTotal: m.pesoTotal })));
  const GUIAS_PER_PAGE = 35;
  const pages: typeof allGuias[] = [];
  for (let i = 0; i < allGuias.length; i += GUIAS_PER_PAGE) {
    pages.push(allGuias.slice(i, i + GUIAS_PER_PAGE));
  }

  const completed = allGuias.filter(g => g.checked).length;

  return (
    <div>
      {/* Screen controls — hidden when printing */}
      <div className="no-print bg-azul text-white px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="font-mono text-lg font-semibold tracking-[3px]">Vista de Impresion</div>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-5 py-2 bg-white/20 text-white font-mono text-sm rounded-lg hover:bg-white/30">Volver</button>
          <button onClick={() => window.print()} className="px-5 py-2 bg-white text-azul font-mono text-sm font-semibold rounded-lg hover:bg-gray-100">Imprimir</button>
        </div>
      </div>

      {/* A4 Pages */}
      {pages.map((pageGuias, pageIdx) => (
        <div key={pageIdx} className="print-page bg-white" style={{ width: '210mm', minHeight: '297mm', margin: '0 auto', padding: '12mm 15mm', pageBreakAfter: 'always', boxSizing: 'border-box' }}>
          {/* Header */}
          <div style={{ borderBottom: '2px solid #1a2e5a', paddingBottom: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, color: '#1a2e5a', letterSpacing: '3px' }}>ANDREANI</div>
              <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#666', marginTop: '2px' }}>Manifiestos de Carga — {date}</div>
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '9px', color: '#666' }}>
              <div>{EMPRESA.direccion}</div>
              <div>{EMPRESA.email} | {EMPRESA.telefono}</div>
              <div style={{ marginTop: '2px', fontWeight: 600, color: '#1a2e5a' }}>Pagina {pageIdx + 1} de {pages.length}</div>
            </div>
          </div>

          {/* Summary line */}
          <div style={{ fontFamily: 'monospace', fontSize: '10px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Manifiestos: {manifiestos.map(m => m.numero).join(', ')}</span>
            <span style={{ fontWeight: 600 }}>{completed}/{allGuias.length} completadas</span>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: '10px' }}>
            <thead>
              <tr style={{ background: '#1a2e5a', color: 'white' }}>
                <th style={{ padding: '4px 6px', textAlign: 'center', width: '30px' }}>#</th>
                <th style={{ padding: '4px 6px', textAlign: 'left' }}>Numero Guia</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', width: '50px' }}>Manif.</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', width: '35px' }}>Paq.</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', width: '45px' }}>Hora</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', width: '30px' }}>OK</th>
              </tr>
            </thead>
            <tbody>
              {pageGuias.map((g, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: g.checked ? '#eafaf1' : 'white' }}>
                  <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 600 }}>{pageIdx * GUIAS_PER_PAGE + i + 1}</td>
                  <td style={{ padding: '3px 6px', textDecoration: g.checked ? 'line-through' : 'none', opacity: g.checked ? 0.6 : 1 }}>{g.numero}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'center', fontSize: '8px', color: '#888' }}>{g.manifiestoNumero.slice(-6)}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'center' }}>{g.paquetes}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'center', fontSize: '9px', color: '#888' }}>
                    {g.checked && g.checkedAt ? new Date(g.checkedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td style={{ padding: '3px 6px', textAlign: 'center', fontSize: '14px' }}>{g.checked ? '✓' : '☐'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer on last page */}
          {pageIdx === pages.length - 1 && (
            <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ border: '1px solid #c8d6e8', borderRadius: '6px', padding: '10px 12px 30px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '10px', fontWeight: 600, color: '#1a2e5a', textTransform: 'uppercase' }}>Cliente</div>
                <div style={{ fontSize: '9px', color: '#999', fontStyle: 'italic' }}>Nombre / firma / fecha</div>
                <div style={{ marginTop: '20px', borderBottom: '1px solid #ccc' }} />
              </div>
              <div style={{ border: '1px solid #c8d6e8', borderRadius: '6px', padding: '10px 12px 30px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '10px', fontWeight: 600, color: '#1a2e5a', textTransform: 'uppercase' }}>Paqueteria</div>
                <div style={{ fontSize: '9px', color: '#999', fontStyle: 'italic' }}>Nombre / firma / fecha</div>
                <div style={{ marginTop: '20px', borderBottom: '1px solid #ccc' }} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
