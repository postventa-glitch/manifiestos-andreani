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

interface DayRecord {
  date: string;
  manifiestos: Manifiesto[];
  finalizedAt: string;
  totalGuias: number;
  completedGuias: number;
}

type Tab = 'upload' | 'dashboard' | 'tracking' | 'history';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('upload');
  const [manifiestos, setManifiestos] = useState<Manifiesto[]>([]);
  const [pending, setPending] = useState<Manifiesto[]>([]);
  const [history, setHistory] = useState<DayRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    const [mRes, hRes] = await Promise.all([
      fetch('/api/manifiestos'),
      fetch('/api/finalize'),
    ]);
    const mData = await mRes.json();
    const hData = await hRes.json();
    setManifiestos(mData.manifiestos || []);
    setPending(mData.pending || []);
    setHistory(hData.history || []);
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
            onUpload={handleUpload}
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
  onUpload,
}: {
  uploading: boolean;
  uploadResults: any[];
  manifiestos: Manifiesto[];
  onUpload: (e: React.FormEvent<HTMLFormElement>) => void;
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current manifests */}
      {manifiestos.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-mono text-sm font-semibold text-azul mb-3 uppercase tracking-wider">
            Manifiestos cargados hoy ({manifiestos.length})
          </h3>
          <div className="space-y-3">
            {manifiestos.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-[#f5f7fa] rounded-lg">
                <div>
                  <span className="font-mono text-sm font-semibold text-azul">N&ordm; {m.numero}</span>
                  <span className="ml-3 text-xs text-gray-500">{m.sucursal}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-gray-500">
                    {m.guias.filter(g => g.checked).length}/{m.guias.length} guias
                  </span>
                  <span className="font-mono text-[10px] text-gray-400">
                    Subido: {new Date(m.uploadedAt).toLocaleTimeString('es-AR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
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
  const [guia, setGuia] = useState('');
  const [tracking, setTracking] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const allGuias = allManifiestos.flatMap(m =>
    m.guias.map(g => ({ ...g, manifiestoNumero: m.numero, manifiestoId: m.id, uploadedAt: m.uploadedAt }))
  );

  const handleTrack = async (guiaNum: string) => {
    setLoading(true);
    setGuia(guiaNum);
    try {
      const res = await fetch(`/api/tracking?guia=${guiaNum}`);
      const data = await res.json();
      setTracking(data);
    } catch {
      setTracking({ error: 'Error consultando tracking' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="font-mono text-lg font-semibold text-azul mb-4">Consultar Tracking</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={guia}
            onChange={e => setGuia(e.target.value)}
            placeholder="Numero de guia..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-acento"
          />
          <button
            onClick={() => handleTrack(guia)}
            disabled={!guia || loading}
            className="px-6 py-2.5 bg-acento text-white font-mono text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Consultando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Quick links for all guides */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-mono text-sm font-semibold text-azul mb-3 uppercase tracking-wider">
          Guias cargadas — Click para consultar
        </h3>
        <div className="flex flex-wrap gap-2">
          {allGuias.map(g => (
            <button
              key={g.numero}
              onClick={() => handleTrack(g.numero)}
              className={`px-3 py-1.5 font-mono text-xs rounded-lg border transition-colors ${
                g.checked
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-acento hover:text-acento'
              }`}
            >
              {g.numero}
            </button>
          ))}
        </div>
      </div>

      {/* Tracking result */}
      {tracking && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-mono text-sm font-semibold text-azul mb-3 uppercase tracking-wider">
            Resultado para {tracking.guia}
          </h3>
          {tracking.source === 'api' && tracking.tracking ? (
            <div className="space-y-2">
              {Array.isArray(tracking.tracking) ? (
                tracking.tracking.map((t: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-acento mt-1.5 shrink-0" />
                    <div>
                      <div className="font-mono text-xs font-semibold">{t.Estado || t.estado || 'Movimiento'}</div>
                      <div className="text-xs text-gray-500">{t.Fecha || t.fecha || ''}</div>
                      <div className="text-xs text-gray-400">{t.Motivo || t.detalle || t.Sucursal || ''}</div>
                    </div>
                  </div>
                ))
              ) : (
                <pre className="text-xs font-mono bg-gray-50 p-4 rounded-lg overflow-auto">
                  {JSON.stringify(tracking.tracking, null, 2)}
                </pre>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-3">No se pudo obtener tracking via API.</p>
              <a
                href={tracking.trackingUrl || `https://www.andreani.com/envio/${tracking.guia}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-2.5 bg-acento text-white font-mono text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ver en Andreani.com &rarr;
              </a>
            </div>
          )}

          {/* Internal flow */}
          {allGuias.find(g => g.numero === tracking.guia) && (
            <div className="mt-6 border-t pt-4">
              <h4 className="font-mono text-xs font-semibold text-azul mb-3 uppercase tracking-wider">
                Flujo interno
              </h4>
              {(() => {
                const g = allGuias.find(x => x.numero === tracking.guia)!;
                const steps = [
                  {
                    label: 'Carga de manifiesto',
                    time: new Date(g.uploadedAt).toLocaleString('es-AR'),
                    done: true,
                  },
                  {
                    label: 'Checklist (empaquetado)',
                    time: g.checkedAt ? new Date(g.checkedAt).toLocaleString('es-AR') : 'Pendiente',
                    done: g.checked,
                  },
                ];
                return (
                  <div className="space-y-2">
                    {steps.map((s, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${s.done ? 'bg-verde' : 'bg-gray-300'}`} />
                        <span className="font-mono text-xs font-semibold w-40">{s.label}</span>
                        <span className="font-mono text-xs text-gray-500">{s.time}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
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
