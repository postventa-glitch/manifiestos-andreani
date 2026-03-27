'use client';

import { useState, useEffect, useCallback } from 'react';

interface Guia {
  numero: string;
  paquetes: number;
  checked: boolean;
  checkedAt: string | null;
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

interface AuditEntry {
  guiaNumero: string;
  manifiestoId: string;
  action: 'checked' | 'unchecked' | 'deleted';
  timestamp: string;
  detail?: string;
}

interface DayRecord {
  date: string;
  manifiestos: Manifiesto[];
  finalizedAt: string;
  totalGuias: number;
  completedGuias: number;
}

type Tab = 'upload' | 'dashboard' | 'tracking' | 'audit' | 'history';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('upload');
  const [manifiestos, setManifiestos] = useState<Manifiesto[]>([]);
  const [pending, setPending] = useState<Manifiesto[]>([]);
  const [history, setHistory] = useState<DayRecord[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [mRes, hRes] = await Promise.all([
        fetch('/api/manifiestos'),
        fetch('/api/finalize'),
      ]);
      const mData = await mRes.json();
      const hData = await hRes.json();
      setManifiestos(mData.manifiestos || []);
      setPending(mData.pending || []);
      setAuditLog(mData.auditLog || []);
      setHistory(hData.history || []);
    } catch {
      // silent on error
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    setUploadResults([]);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch('/api/manifiestos', { method: 'POST', body: formData });
      const data = await res.json();
      setUploadResults(data.results || []);
      setManifiestos(data.manifiestos || []);
      form.reset();
    } catch {
      setUploadResults([{ success: false, error: 'Error de conexion' }]);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (manifiestoId: string, numero: string) => {
    if (!confirm(`Eliminar manifiesto ${numero}? Esta accion no se puede deshacer.`)) return;
    try {
      const res = await fetch('/api/manifiestos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifiestoId }),
      });
      const data = await res.json();
      if (res.ok) {
        setManifiestos(data.manifiestos || []);
        setPending(data.pending || []);
        setAuditLog(data.auditLog || []);
      }
    } catch {
      // silent
    }
  };

  const handleFinalize = async () => {
    if (!confirm('Finalizar el dia? Las guias pendientes pasaran al dia siguiente.')) return;
    const res = await fetch('/api/finalize', { method: 'POST' });
    const data = await res.json();
    if (data.record) {
      setHistory(data.history);
      await fetchData();
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'upload', label: 'Subir Manifiestos' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'tracking', label: 'Tracking' },
    { key: 'audit', label: 'Cambios' },
    { key: 'history', label: 'Historial' },
  ];

  const allManifiestos = [...pending, ...manifiestos];
  const totalGuias = allManifiestos.reduce((s, m) => s + m.guias.length, 0);
  const checkedGuias = allManifiestos.reduce((s, m) => s + m.guias.filter(g => g.checked).length, 0);

  return (
    <div className="min-h-screen bg-[#eef2f8]">
      {/* Header */}
      <div className="bg-azul text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-mono text-xl font-semibold tracking-[3px]">ANDREANI</span>
          <span className="text-white/50 font-mono text-xs">Panel Admin</span>
        </div>
        <a href="/" className="text-white/70 hover:text-white font-mono text-xs transition-colors">
          Ver Frontend Publico &rarr;
        </a>
      </div>

      {/* Tabs */}
      <div className="bg-azul-medio px-6 flex gap-0 border-b border-azul">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 font-mono text-xs tracking-wider uppercase transition-colors ${
              tab === t.key
                ? 'bg-white text-azul font-semibold rounded-t-lg'
                : 'text-white/70 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        {manifiestos.length > 0 && (
          <button
            onClick={handleFinalize}
            className="my-1.5 px-4 py-1.5 bg-rojo text-white font-mono text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Finalizar Dia
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        {tab === 'upload' && (
          <UploadTab
            uploading={uploading}
            uploadResults={uploadResults}
            manifiestos={manifiestos}
            pending={pending}
            onUpload={handleUpload}
            onDelete={handleDelete}
          />
        )}
        {tab === 'dashboard' && (
          <DashboardTab
            manifiestos={manifiestos}
            pending={pending}
            totalGuias={totalGuias}
            checkedGuias={checkedGuias}
          />
        )}
        {tab === 'tracking' && <TrackingTab allManifiestos={allManifiestos} />}
        {tab === 'audit' && <AuditTab auditLog={auditLog} allManifiestos={allManifiestos} />}
        {tab === 'history' && <HistoryTab history={history} />}
      </div>
    </div>
  );
}

/* ─── UPLOAD TAB ─── */
function UploadTab({
  uploading,
  uploadResults,
  manifiestos,
  pending,
  onUpload,
  onDelete,
}: {
  uploading: boolean;
  uploadResults: any[];
  manifiestos: Manifiesto[];
  pending: Manifiesto[];
  onUpload: (e: React.FormEvent<HTMLFormElement>) => void;
  onDelete: (id: string, numero: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="font-mono text-lg font-semibold text-azul mb-4">Subir PDFs de Manifiestos</h2>
        <form onSubmit={onUpload} className="space-y-4">
          <div className="border-2 border-dashed border-azul-claro rounded-lg p-8 text-center hover:border-acento transition-colors">
            <input
              type="file"
              name="pdfs"
              multiple
              accept=".pdf"
              className="block mx-auto text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-azul file:text-white hover:file:bg-azul-medio cursor-pointer"
            />
            <p className="mt-2 text-xs text-gray-400 font-mono">Se pueden subir varios PDFs a la vez</p>
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="w-full py-3 bg-acento text-white font-mono font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {uploading ? 'Procesando...' : 'Subir y Procesar PDFs'}
          </button>
        </form>

        {uploadResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploadResults.map((r, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg font-mono text-sm ${
                  r.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}
              >
                {r.success
                  ? `Manifiesto ${r.numero} — ${r.guias} guias cargadas`
                  : `Error: ${r.error} ${r.file ? `(${r.file})` : ''}`}
                {!r.success && r.debug && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs opacity-70">Ver texto raw del PDF (debug)</summary>
                    <pre className="mt-1 text-[10px] bg-red-100 p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">{r.debug}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current manifests */}
      {(manifiestos.length > 0 || pending.length > 0) && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          {pending.length > 0 && (
            <>
              <h3 className="font-mono text-sm font-semibold text-amber-700 mb-3 uppercase tracking-wider">
                Pendientes del dia anterior ({pending.length})
              </h3>
              <div className="space-y-3 mb-5">
                {pending.map(m => (
                  <ManifiestoRow key={m.id} m={m} onDelete={onDelete} isPending />
                ))}
              </div>
            </>
          )}
          {manifiestos.length > 0 && (
            <>
              <h3 className="font-mono text-sm font-semibold text-azul mb-3 uppercase tracking-wider">
                Manifiestos cargados hoy ({manifiestos.length})
              </h3>
              <div className="space-y-3">
                {manifiestos.map(m => (
                  <ManifiestoRow key={m.id} m={m} onDelete={onDelete} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── DASHBOARD TAB ─── */
function DashboardTab({
  manifiestos,
  pending,
  totalGuias,
  checkedGuias,
}: {
  manifiestos: Manifiesto[];
  pending: Manifiesto[];
  totalGuias: number;
  checkedGuias: number;
}) {
  const pct = totalGuias > 0 ? Math.round((checkedGuias / totalGuias) * 100) : 0;

  // KPI: Calculate avg time between upload and check
  const allGuias = [...manifiestos, ...pending].flatMap(m =>
    m.guias
      .filter(g => g.checked && g.checkedAt)
      .map(g => ({
        ...g,
        uploadedAt: m.uploadedAt,
        manifiestoNumero: m.numero,
      }))
  );

  const avgPackTime =
    allGuias.length > 0
      ? allGuias.reduce((sum, g) => {
          const upload = new Date(g.uploadedAt).getTime();
          const check = new Date(g.checkedAt!).getTime();
          return sum + (check - upload);
        }, 0) / allGuias.length
      : 0;

  const formatDuration = (ms: number) => {
    if (ms === 0) return '--';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    if (mins > 60) {
      const hrs = Math.floor(mins / 60);
      return `${hrs}h ${mins % 60}m`;
    }
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Total Guias" value={totalGuias.toString()} />
        <KpiCard label="Completadas" value={checkedGuias.toString()} color="green" />
        <KpiCard label="Pendientes" value={(totalGuias - checkedGuias).toString()} color={totalGuias - checkedGuias > 0 ? 'orange' : 'green'} />
        <KpiCard label="Avance" value={`${pct}%`} color={pct === 100 ? 'green' : 'blue'} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Manifiestos Hoy" value={manifiestos.length.toString()} />
        <KpiCard label="Pendientes Ayer" value={pending.length.toString()} color={pending.length > 0 ? 'orange' : 'green'} />
        <KpiCard label="Tiempo Promedio Empaquetado" value={formatDuration(avgPackTime)} color="blue" />
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-mono text-sm font-semibold text-azul mb-4 uppercase tracking-wider">
          Progreso del dia
        </h3>
        <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pct === 100 ? 'bg-verde' : 'bg-acento'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="font-mono text-xs text-gray-500 text-right">{checkedGuias}/{totalGuias} guias confirmadas</p>
      </div>

      {/* Per-manifest progress */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-mono text-sm font-semibold text-azul mb-4 uppercase tracking-wider">
          Detalle por Manifiesto
        </h3>
        <div className="space-y-3">
          {[...pending, ...manifiestos].map(m => {
            const done = m.guias.filter(g => g.checked).length;
            const total = m.guias.length;
            const p = total > 0 ? (done / total) * 100 : 0;
            return (
              <div key={m.id} className="flex items-center gap-4">
                <span className="font-mono text-xs font-semibold text-azul w-36 shrink-0">
                  {m.numero}
                </span>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${p === 100 ? 'bg-verde' : 'bg-acento'}`}
                    style={{ width: `${p}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-gray-500 w-16 text-right">
                  {done}/{total}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time log per guia */}
      {allGuias.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-mono text-sm font-semibold text-azul mb-4 uppercase tracking-wider">
            KPI: Tiempo subida &rarr; empaquetado
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 text-left font-mono text-[10px] text-gray-500 uppercase">Manifiesto</th>
                <th className="py-2 text-left font-mono text-[10px] text-gray-500 uppercase">Guia</th>
                <th className="py-2 text-left font-mono text-[10px] text-gray-500 uppercase">Hora Subida</th>
                <th className="py-2 text-left font-mono text-[10px] text-gray-500 uppercase">Hora Check</th>
                <th className="py-2 text-left font-mono text-[10px] text-gray-500 uppercase">Tiempo</th>
              </tr>
            </thead>
            <tbody>
              {allGuias.map((g, i) => {
                const upload = new Date(g.uploadedAt);
                const check = new Date(g.checkedAt!);
                const diff = check.getTime() - upload.getTime();
                return (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 font-mono">{g.manifiestoNumero}</td>
                    <td className="py-2 font-mono">{g.numero}</td>
                    <td className="py-2 font-mono text-gray-500">{upload.toLocaleTimeString('es-AR')}</td>
                    <td className="py-2 font-mono text-gray-500">{check.toLocaleTimeString('es-AR')}</td>
                    <td className="py-2 font-mono font-semibold text-acento">{formatDuration(diff)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  const colorClasses: Record<string, string> = {
    green: 'text-verde',
    orange: 'text-orange-500',
    blue: 'text-acento',
    red: 'text-rojo',
  };
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="font-mono text-[10px] uppercase tracking-wider text-gray-400 mb-1">{label}</div>
      <div className={`font-mono text-2xl font-semibold ${color ? colorClasses[color] || 'text-azul' : 'text-azul'}`}>
        {value}
      </div>
    </div>
  );
}

/* ─── TRACKING TAB ─── */
function TrackingTab({ allManifiestos }: { allManifiestos: Manifiesto[] }) {
  const [selectedGuia, setSelectedGuia] = useState('');
  const [customGuia, setCustomGuia] = useState('');

  const allGuias = allManifiestos.flatMap(m =>
    m.guias.map(g => ({ ...g, manifiestoNumero: m.numero, manifiestoId: m.id, uploadedAt: m.uploadedAt }))
  );

  const trackingUrl = selectedGuia
    ? `https://www.andreani.com/#!/informacionEnvio/${selectedGuia}`
    : '';

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="font-mono text-lg font-semibold text-azul mb-4">Consultar Tracking Andreani</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={customGuia}
            onChange={e => setCustomGuia(e.target.value)}
            placeholder="Numero de guia..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-acento"
            onKeyDown={e => e.key === 'Enter' && customGuia && setSelectedGuia(customGuia)}
          />
          <button
            onClick={() => setSelectedGuia(customGuia)}
            disabled={!customGuia}
            className="px-6 py-2.5 bg-acento text-white font-mono text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Quick links for all guides */}
      {allGuias.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-mono text-sm font-semibold text-azul mb-3 uppercase tracking-wider">
            Guias cargadas — Click para consultar
          </h3>
          <div className="flex flex-wrap gap-2">
            {allGuias.map(g => (
              <button
                key={g.numero}
                onClick={() => { setSelectedGuia(g.numero); setCustomGuia(g.numero); }}
                className={`px-3 py-1.5 font-mono text-xs rounded-lg border transition-colors ${
                  selectedGuia === g.numero
                    ? 'bg-acento border-acento text-white'
                    : g.checked
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-acento hover:text-acento'
                }`}
              >
                {g.numero}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tracking result */}
      {selectedGuia && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          {/* Internal flow */}
          {allGuias.find(g => g.numero === selectedGuia) && (
            <div className="mb-6">
              <h4 className="font-mono text-xs font-semibold text-azul mb-3 uppercase tracking-wider">
                Flujo interno — {selectedGuia}
              </h4>
              {(() => {
                const g = allGuias.find(x => x.numero === selectedGuia)!;
                const steps = [
                  { label: 'Carga de manifiesto', time: new Date(g.uploadedAt).toLocaleString('es-AR'), done: true },
                  { label: 'Checklist (empaquetado)', time: g.checkedAt ? new Date(g.checkedAt).toLocaleString('es-AR') : 'Pendiente', done: g.checked },
                ];
                return (
                  <div className="flex gap-4 mb-4">
                    {steps.map((s, i) => (
                      <div key={i} className={`flex-1 p-3 rounded-lg border ${s.done ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2.5 h-2.5 rounded-full ${s.done ? 'bg-verde' : 'bg-gray-300'}`} />
                          <span className="font-mono text-xs font-semibold">{s.label}</span>
                        </div>
                        <span className="font-mono text-[10px] text-gray-500">{s.time}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* External tracking link + iframe */}
          <h4 className="font-mono text-xs font-semibold text-azul mb-3 uppercase tracking-wider">
            Tracking Andreani
          </h4>
          <div className="flex gap-2 mb-4">
            <a
              href={`https://www.andreani.com/#!/informacionEnvio/${selectedGuia}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-acento text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Abrir en Andreani.com &rarr;
            </a>
            <a
              href={`https://www.andreani.com/envio/${selectedGuia}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gray-100 text-gray-700 font-mono text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors"
            >
              Link alternativo &rarr;
            </a>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '500px' }}>
            <iframe
              src={trackingUrl}
              className="w-full h-full"
              sandbox="allow-scripts allow-same-origin allow-popups"
              title={`Tracking ${selectedGuia}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── MANIFIESTO ROW ─── */
function ManifiestoRow({ m, onDelete, isPending }: { m: Manifiesto; onDelete: (id: string, numero: string) => void; isPending?: boolean }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg ${isPending ? 'bg-amber-50 border border-amber-200' : 'bg-[#f5f7fa]'}`}>
      <div>
        <span className="font-mono text-sm font-semibold text-azul">N&ordm; {m.numero}</span>
        <span className="ml-3 text-xs text-gray-500">{m.sucursal}</span>
        {isPending && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-mono">pendiente</span>}
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs text-gray-500">
          {m.guias.filter(g => g.checked).length}/{m.guias.length} guias
        </span>
        <span className="font-mono text-[10px] text-gray-400">
          Subido: {new Date(m.uploadedAt).toLocaleTimeString('es-AR')}
        </span>
        <button
          onClick={() => onDelete(m.id, m.numero)}
          className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors font-mono text-xs font-bold"
          title="Eliminar manifiesto"
        >
          X
        </button>
      </div>
    </div>
  );
}

/* ─── AUDIT TAB ─── */
function AuditTab({ auditLog, allManifiestos }: { auditLog: AuditEntry[]; allManifiestos: Manifiesto[] }) {
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterManifiesto, setFilterManifiesto] = useState<string>('all');

  const filtered = auditLog.filter(e => {
    if (filterAction !== 'all' && e.action !== filterAction) return false;
    if (filterManifiesto !== 'all' && e.manifiestoId !== filterManifiesto) return false;
    return true;
  });

  const sorted = [...filtered].reverse();

  const actionColors: Record<string, string> = {
    checked: 'bg-green-100 text-green-800',
    unchecked: 'bg-red-100 text-red-800',
    deleted: 'bg-gray-100 text-gray-800',
  };

  const actionLabels: Record<string, string> = {
    checked: 'HECHO',
    unchecked: 'DESHECHO',
    deleted: 'ELIMINADO',
  };

  if (auditLog.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 shadow-sm text-center">
        <div className="text-4xl mb-3">📝</div>
        <p className="text-gray-500 font-mono text-sm">No hay cambios registrados aun</p>
        <p className="text-gray-400 font-mono text-xs mt-1">Los cambios aparecen cuando se marcan/desmarcan guias o se eliminan manifiestos</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="font-mono text-lg font-semibold text-azul mb-4">Historial de Cambios</h2>
        <div className="flex gap-4">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Accion</label>
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg font-mono text-xs focus:outline-none focus:border-acento"
            >
              <option value="all">Todas</option>
              <option value="checked">Hecho</option>
              <option value="unchecked">Deshecho</option>
              <option value="deleted">Eliminado</option>
            </select>
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Manifiesto</label>
            <select
              value={filterManifiesto}
              onChange={e => setFilterManifiesto(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg font-mono text-xs focus:outline-none focus:border-acento"
            >
              <option value="all">Todos</option>
              {allManifiestos.map(m => (
                <option key={m.id} value={m.id}>{m.numero}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <span className="font-mono text-xs text-gray-400">{sorted.length} registros</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl p-6 shadow-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2 text-left font-mono text-[10px] text-gray-500 uppercase">Hora</th>
              <th className="py-2 text-left font-mono text-[10px] text-gray-500 uppercase">Accion</th>
              <th className="py-2 text-left font-mono text-[10px] text-gray-500 uppercase">Guia</th>
              <th className="py-2 text-left font-mono text-[10px] text-gray-500 uppercase">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2.5 font-mono text-gray-500">
                  {new Date(entry.timestamp).toLocaleString('es-AR', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    day: '2-digit', month: '2-digit',
                  })}
                </td>
                <td className="py-2.5">
                  <span className={`inline-block px-2 py-0.5 rounded font-mono text-[10px] font-semibold ${actionColors[entry.action] || 'bg-gray-100'}`}>
                    {actionLabels[entry.action] || entry.action}
                  </span>
                </td>
                <td className="py-2.5 font-mono">{entry.guiaNumero === '-' ? '-' : entry.guiaNumero}</td>
                <td className="py-2.5 font-mono text-gray-500">{entry.detail || entry.manifiestoId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── HISTORY TAB ─── */
function HistoryTab({ history }: { history: DayRecord[] }) {
  if (history.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 shadow-sm text-center">
        <div className="text-4xl mb-3">📋</div>
        <p className="text-gray-500 font-mono text-sm">No hay dias finalizados aun</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((day, i) => (
        <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono text-lg font-semibold text-azul">{day.date}</h3>
            <div className="flex items-center gap-4">
              <span className="font-mono text-xs text-gray-400">
                Finalizado: {new Date(day.finalizedAt).toLocaleTimeString('es-AR')}
              </span>
              <span className={`font-mono text-xs font-semibold px-3 py-1 rounded-full ${
                day.completedGuias === day.totalGuias
                  ? 'bg-green-50 text-green-700'
                  : 'bg-orange-50 text-orange-700'
              }`}>
                {day.completedGuias}/{day.totalGuias} guias
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {day.manifiestos.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-xs font-mono">
                <span className="font-semibold text-azul">N&ordm; {m.numero}</span>
                <span className="text-gray-500">{m.sucursal}</span>
                <span>
                  {m.guias.filter(g => g.checked).length}/{m.guias.length} guias
                </span>
                <span className="text-gray-400">
                  Subido: {new Date(m.uploadedAt).toLocaleTimeString('es-AR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
