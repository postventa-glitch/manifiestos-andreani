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
}

export default function PublicPage() {
  const [manifiestos, setManifiestos] = useState<Manifiesto[]>([]);
  const [pending, setPending] = useState<Manifiesto[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAudit, setShowAudit] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState<string | null>(null);
  const lastVersion = useRef<number>(0);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sequential queue: checks run one at a time to avoid KV race conditions
  const checkQueue = useRef<Array<{ manifiestoId: string; guiaNumero: string; checked: boolean }>>([]);
  const isProcessing = useRef(false);

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
      } catch {
        // silent — optimistic state is already shown
      }
    }

    isProcessing.current = false;
    // After all queued writes done, schedule a full sync
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(syncFromServer, 1500);
  }, []);

  // Sync with server — only when queue is empty
  const syncFromServer = useCallback(async () => {
    if (checkQueue.current.length > 0 || isProcessing.current) return;
    try {
      const res = await fetch('/api/manifiestos');
      const data = await res.json();
      const serverVersion = data._version || 0;
      if (checkQueue.current.length === 0 && !isProcessing.current && serverVersion >= lastVersion.current) {
        setManifiestos(data.manifiestos || []);
        setPending(data.pending || []);
        setAuditLog(data.auditLog || []);
        lastVersion.current = serverVersion;
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    syncFromServer();
    const interval = setInterval(syncFromServer, 5000);
    return () => { clearInterval(interval); if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [syncFromServer]);

  const handleCheck = (manifiestoId: string, guiaNumero: string, checked: boolean) => {
    // INSTANT optimistic update
    const updateList = (list: Manifiesto[]) =>
      list.map(m =>
        m.id === manifiestoId
          ? {
              ...m,
              guias: m.guias.map(g =>
                g.numero === guiaNumero
                  ? { ...g, checked, checkedAt: checked ? new Date().toISOString() : null }
                  : g
              ),
            }
          : m
      );

    setManifiestos(prev => updateList(prev));
    setPending(prev => updateList(prev));
    setAuditLog(prev => [
      ...prev,
      { guiaNumero, manifiestoId, action: checked ? 'checked' : 'unchecked', timestamp: new Date().toISOString() },
    ]);

    // Add to sequential queue — processes one at a time
    checkQueue.current.push({ manifiestoId, guiaNumero, checked });
    processQueue();
  };

  const handleFinalize = async () => {
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
          `Dia finalizado: ${data.record.completedGuias}/${data.record.totalGuias} guias completadas. ` +
          (data.record.totalGuias - data.record.completedGuias > 0
            ? `${data.record.totalGuias - data.record.completedGuias} pasan al dia siguiente.`
            : 'Todo completo!')
        );
        await fetchData();
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
  const totalGuias = allManifiestos.reduce((s, m) => s + m.guias.length, 0);
  const checkedGuias = allManifiestos.reduce((s, m) => s + m.guias.filter(g => g.checked).length, 0);
  const pct = totalGuias > 0 ? (checkedGuias / totalGuias) * 100 : 0;

  const today = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

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

  return (
    <div className="py-8 px-4">
      {/* Top Bar */}
      <div className="max-w-[860px] mx-auto bg-azul text-white flex items-center justify-between px-7 py-3.5 rounded-t-xl">
        <div className="font-mono text-[22px] font-semibold tracking-[3px]">ANDREANI</div>
        <div className="flex items-center gap-4">
          <div className="font-mono text-xs opacity-65">Manifiestos de Carga &middot; {today}</div>
          <button
            onClick={() => setShowAudit(!showAudit)}
            className="text-white/60 hover:text-white font-mono text-[10px] uppercase tracking-wider transition-colors"
            title="Ver historial de cambios"
          >
            [{showAudit ? 'Ocultar' : 'Historial'}]
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="max-w-[860px] mx-auto bg-azul-medio flex items-center gap-3.5 px-7 py-2.5">
        <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4fc3f7] rounded-full transition-all duration-400"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="font-mono text-[11px] text-white/80 whitespace-nowrap">
          {checkedGuias} / {totalGuias} guias confirmadas
        </div>
      </div>

      {/* Audit Log Panel */}
      {showAudit && auditLog.length > 0 && (
        <div className="max-w-[860px] mx-auto bg-gray-900 text-gray-300 px-7 py-4 max-h-48 overflow-y-auto">
          <div className="font-mono text-[10px] uppercase tracking-wider text-gray-500 mb-2">
            Historial de cambios ({auditLog.length})
          </div>
          <div className="space-y-1">
            {[...auditLog].reverse().map((entry, i) => (
              <div key={i} className="flex items-center gap-3 font-mono text-[11px]">
                <span className="text-gray-500 w-16 shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`w-5 text-center ${entry.action === 'checked' ? 'text-green-400' : 'text-red-400'}`}>
                  {entry.action === 'checked' ? '+' : '-'}
                </span>
                <span className="text-gray-400">{entry.guiaNumero}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  entry.action === 'checked' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                }`}>
                  {entry.action === 'checked' ? 'HECHO' : 'DESHECHO'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Container */}
      <div className="max-w-[860px] mx-auto bg-white rounded-b-xl overflow-hidden shadow-[0_8px_40px_rgba(26,46,90,0.12)]">
        {/* Pending from yesterday */}
        {pending.length > 0 && (
          <div className="bg-amber-50 border-b-2 border-amber-200 px-7 py-3">
            <span className="font-mono text-xs font-semibold text-amber-700 tracking-wider uppercase">
              Pendientes del dia anterior
            </span>
          </div>
        )}

        {pending.map(m => (
          <ManifiestoCard key={m.id} manifiesto={m} onCheck={handleCheck} auditLog={auditLog} isPending />
        ))}

        {pending.length > 0 && manifiestos.length > 0 && (
          <div className="bg-azul-claro px-7 py-3">
            <span className="font-mono text-xs font-semibold text-azul tracking-wider uppercase">
              Manifiestos de hoy
            </span>
          </div>
        )}

        {manifiestos.map(m => (
          <ManifiestoCard key={m.id} manifiesto={m} onCheck={handleCheck} auditLog={auditLog} />
        ))}

        {/* Finalize Day Button */}
        <div className="px-8 py-6 border-t-2 border-dashed border-[#c8d6e8] bg-[#f5f7fa]">
          {finalizeResult && (
            <div className="mb-4 p-3 rounded-lg font-mono text-sm bg-green-50 text-green-800 border border-green-200">
              {finalizeResult}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-xs text-gray-500 uppercase tracking-wider">Resumen</div>
              <div className="font-mono text-sm mt-1">
                <span className="text-verde font-semibold">{checkedGuias} completadas</span>
                {totalGuias - checkedGuias > 0 && (
                  <span className="text-rojo font-semibold ml-3">{totalGuias - checkedGuias} pendientes</span>
                )}
              </div>
            </div>
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className="px-6 py-3 bg-azul text-white font-mono text-sm font-semibold rounded-lg hover:bg-azul-medio disabled:opacity-50 transition-colors"
            >
              {finalizing ? 'Finalizando...' : 'Finalizar Dia'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManifiestoCard({
  manifiesto: m,
  onCheck,
  auditLog,
  isPending,
}: {
  manifiesto: Manifiesto;
  onCheck: (mId: string, gNum: string, checked: boolean) => void;
  auditLog: AuditEntry[];
  isPending?: boolean;
}) {
  const done = m.guias.filter(g => g.checked).length;
  const total = m.guias.length;
  const isComplete = done === total;

  // Get audit entries for this manifest's guides
  const getGuiaAudit = (guiaNumero: string) =>
    auditLog.filter(e => e.guiaNumero === guiaNumero && e.manifiestoId === m.id);

  return (
    <div className={`border-b-2 border-dashed border-[#c8d6e8] px-8 py-7 last:border-b-0 ${isPending ? 'bg-amber-50/30' : ''}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[2px] text-acento">
            Manifiesto de Carga
          </div>
          <div className="font-mono text-xl font-semibold text-azul tracking-wide">
            N&ordm; {m.numero}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="bg-azul-claro text-azul font-mono text-xs font-semibold px-3.5 py-1.5 rounded-full">
            {m.fecha}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 font-mono text-[11px] px-3 py-1 rounded-full font-semibold ${
              isComplete
                ? 'bg-green-100 text-green-800'
                : done > 0
                ? 'bg-orange-100 text-orange-800'
                : 'bg-orange-50 text-orange-700'
            }`}
          >
            <span className={`w-[7px] h-[7px] rounded-full ${isComplete ? 'bg-green-500' : 'bg-orange-400'}`} />
            {isComplete ? 'Completo' : done > 0 ? `En curso (${done}/${total})` : 'Pendiente'}
          </span>
        </div>
      </div>

      {/* Info Block */}
      <div className="bg-[#f5f7fa] border border-[#c8d6e8] rounded-lg p-3.5 mb-5 grid grid-cols-2 gap-y-1.5 gap-x-6 text-[13px]">
        <div className="col-span-2 flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase text-[#7a8fab] tracking-wide">Sucursal</span>
          <span className="font-semibold">{m.sucursal}</span>
        </div>
        <div className="col-span-2 flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase text-[#7a8fab] tracking-wide">Direccion</span>
          <span className="font-semibold">{m.direccion}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase text-[#7a8fab] tracking-wide">Email</span>
          <span className="font-semibold">{m.email}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase text-[#7a8fab] tracking-wide">Telefono</span>
          <span className="font-semibold">{m.telefono}</span>
        </div>
      </div>

      {/* Table */}
      <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-[#7a8fab] mb-2">
        Numeros de Guia
      </div>
      <table className="w-full border-collapse text-[13px] mb-5">
        <thead>
          <tr className="bg-azul text-white">
            <th className="py-2.5 px-3.5 font-mono text-[10px] font-semibold tracking-wider uppercase text-center w-12">#</th>
            <th className="py-2.5 px-3.5 font-mono text-[10px] font-semibold tracking-wider uppercase text-left">Numero Guia</th>
            <th className="py-2.5 px-3.5 font-mono text-[10px] font-semibold tracking-wider uppercase text-center w-20">Paquetes</th>
            <th className="py-2.5 px-3.5 font-mono text-[10px] font-semibold tracking-wider uppercase text-center w-24">Estado</th>
            <th className="py-2.5 px-3.5 font-mono text-[10px] font-semibold tracking-wider uppercase text-center w-16">OK</th>
          </tr>
        </thead>
        <tbody>
          {m.guias.map((g, i) => {
            const audit = getGuiaAudit(g.numero);
            const wasUnchecked = audit.some(e => e.action === 'unchecked');
            return (
              <tr
                key={g.numero}
                onClick={() => onCheck(m.id, g.numero, !g.checked)}
                className={`border-b border-[#c8d6e8] cursor-pointer select-none active:bg-blue-50 ${
                  g.checked ? 'guia-checked bg-[#eafaf1]' : wasUnchecked ? 'bg-red-50/30' : 'hover:bg-azul-claro'
                }`}
                style={{ transition: 'background-color 0.12s ease' }}
              >
                <td className="py-2.5 px-3.5 text-center">
                  <span className={`guia-num-badge inline-block text-white font-mono text-[10px] font-semibold px-2 py-0.5 rounded tracking-wide ${g.checked ? 'bg-verde' : 'bg-azul'}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </td>
                <td className={`py-2.5 px-3.5 font-mono text-xs tracking-wide ${g.checked ? 'line-through opacity-50' : ''}`}>
                  {g.numero}
                </td>
                <td className="py-2.5 px-3.5 text-center">{g.paquetes}</td>
                <td className="py-2.5 px-3.5 text-center">
                  {audit.length > 0 ? (
                    <div className="flex flex-col items-center gap-0.5">
                      {audit.length > 1 && (
                        <span className="font-mono text-[9px] text-amber-600 font-semibold">
                          {audit.length} cambios
                        </span>
                      )}
                      <span className={`font-mono text-[9px] ${
                        g.checked ? 'text-verde' : wasUnchecked ? 'text-rojo' : 'text-gray-400'
                      }`}>
                        {g.checked
                          ? new Date(g.checkedAt!).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                          : wasUnchecked ? 'Deshecho' : ''}
                      </span>
                    </div>
                  ) : (
                    <span className="font-mono text-[9px] text-gray-300">-</span>
                  )}
                </td>
                <td className="py-2.5 px-3.5">
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      className="guia-checkbox"
                      checked={g.checked}
                      onChange={e => { e.stopPropagation(); onCheck(m.id, g.numero, e.target.checked); }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 border border-[#c8d6e8] rounded-lg p-3 flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase tracking-wide text-[#7a8fab]">Peso Total</span>
          <span className="font-mono text-xl font-semibold text-azul">{m.pesoTotal}</span>
        </div>
        <div className="flex-1 border border-[#c8d6e8] rounded-lg p-3 flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase tracking-wide text-[#7a8fab]">Total Paquetes</span>
          <span className="font-mono text-xl font-semibold text-azul">{m.totalPaquetes}</span>
        </div>
        <div className="flex-1 border border-[#c8d6e8] rounded-lg p-3 flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase tracking-wide text-[#7a8fab]">Guias confirmadas</span>
          <span className="font-mono text-xl font-semibold text-azul">{done} / {total}</span>
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
