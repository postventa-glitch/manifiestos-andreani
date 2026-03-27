'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useSSE, diffSSEStates } from '@/app/hooks/useSSE';
import { ScoreWidget } from '@/app/components/dashboard/ScoreWidget';
import { EstimatedCompletionWidget } from '@/app/components/dashboard/EstimatedCompletionWidget';
import { AnomalyAlertWidget } from '@/app/components/dashboard/AnomalyAlertWidget';
import { RiskScoreWidget } from '@/app/components/dashboard/RiskScoreWidget';
import { SuggestionWidget } from '@/app/components/dashboard/SuggestionWidget';
import { CompletionTrendChart } from '@/app/components/charts/CompletionTrendChart';
import { ActivityHeatmap } from '@/app/components/charts/ActivityHeatmap';
import { DailyBarChart } from '@/app/components/charts/DailyBarChart';
import type { AnalyticsData } from '@/lib/types';

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

type Tab = 'upload' | 'dashboard' | 'tracking' | 'history';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('upload');
  const [manifiestos, setManifiestos] = useState<Manifiesto[]>([]);
  const [pending, setPending] = useState<Manifiesto[]>([]);
  const [history, setHistory] = useState<DayRecord[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const { connected } = useSSE({
    onUpdate: (prev, next) => {
      setManifiestos(next.manifiestos || []);
      setPending(next.pending || []);
      setAuditLog(next.auditLog || []);

      if (prev) {
        const changes = diffSSEStates(prev, next);
        for (const change of changes) {
          if (change.type === 'guia_checked') toast.success(change.detail, { duration: 2000 });
          else if (change.type === 'guia_unchecked') toast.warning(change.detail, { duration: 2000 });
        }
        if (changes.length > 0) fetchAnalytics();
      }
    },
  });

  useEffect(() => {
    fetch('/api/finalize').then(r => r.json()).then(d => setHistory(d.history || [])).catch(() => {});
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      if (!data.error) setAnalytics(data);
    } catch {}
  };

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
      const ok = (data.results || []).filter((r: any) => r.success).length;
      if (ok > 0) toast.success(`${ok} manifiesto(s) cargado(s)`);
    } catch {
      setUploadResults([{ success: false, error: 'Error de conexion' }]);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (manifiestoId: string, numero: string) => {
    if (!confirm(`Eliminar manifiesto ${numero}?`)) return;
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
        toast.info(`Manifiesto ${numero} eliminado`);
      }
    } catch {}
  };

  const handleFinalize = async () => {
    if (!confirm('Finalizar el dia?')) return;
    const res = await fetch('/api/finalize', { method: 'POST' });
    const data = await res.json();
    if (data.record) {
      setHistory(data.history);
      toast.success('Dia finalizado');
    }
  };

  const allManifiestos = [...pending, ...manifiestos];
  const totalGuias = allManifiestos.reduce((s, m) => s + m.guias.length, 0);
  const checkedGuias = allManifiestos.reduce((s, m) => s + m.guias.filter(g => g.checked).length, 0);
  const pct = totalGuias > 0 ? Math.round((checkedGuias / totalGuias) * 100) : 0;

  const navItems: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'upload', label: 'Manifiestos', icon: <IconDoc /> },
    { key: 'dashboard', label: 'Dashboard', icon: <IconChart /> },
    { key: 'tracking', label: 'Tracking', icon: <IconSearch /> },
    { key: 'history', label: 'Historial', icon: <IconClock /> },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col border-r border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[var(--border)]">
          <div className="mono text-sm font-semibold tracking-[3px] text-[var(--text-primary)]">ANDREANI</div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Panel de Control</div>
        </div>

        {/* Status */}
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[var(--green)]' : 'bg-[var(--red)]'}`} />
            <span className="text-[10px] text-[var(--text-tertiary)] mono">
              {connected ? 'Conectado' : 'Reconectando...'}
            </span>
          </div>
          {totalGuias > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] mono text-[var(--text-tertiary)] mb-1">
                <span>{checkedGuias}/{totalGuias}</span>
                <span>{pct}%</span>
              </div>
              <div className="w-full h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(n => (
            <button
              key={n.key}
              onClick={() => setTab(n.key)}
              className={`nav-item w-full ${tab === n.key ? 'active' : ''}`}
            >
              {n.icon}
              {n.label}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-[var(--border)] space-y-2">
          {manifiestos.length > 0 && (
            <button
              onClick={handleFinalize}
              className="w-full py-2 bg-[var(--red)]/10 text-[var(--red)] text-xs mono font-medium rounded-lg hover:bg-[var(--red)]/20 transition-colors"
            >
              Finalizar Dia
            </button>
          )}
          <a
            href="/"
            className="block text-center text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Ver Frontend &rarr;
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="p-6 max-w-6xl"
          >
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
                analytics={analytics}
              />
            )}
            {tab === 'tracking' && <TrackingTab allManifiestos={allManifiestos} />}
            {tab === 'history' && <HistoryTab history={history} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

/* ─── UPLOAD TAB ─── */
function UploadTab({ uploading, uploadResults, manifiestos, pending, onUpload, onDelete }: {
  uploading: boolean; uploadResults: any[]; manifiestos: Manifiesto[]; pending: Manifiesto[];
  onUpload: (e: React.FormEvent<HTMLFormElement>) => void; onDelete: (id: string, n: string) => void;
}) {
  return (
    <div className="space-y-5">
      <PageHeader title="Manifiestos" subtitle="Subir y gestionar manifiestos de carga" />

      <div className="card">
        <form onSubmit={onUpload} className="space-y-4">
          <div className="border border-dashed border-[var(--border)] rounded-lg p-6 text-center hover:border-[var(--accent)] transition-colors">
            <input
              type="file"
              name="pdfs"
              multiple
              accept=".pdf"
              className="block mx-auto text-sm text-[var(--text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[var(--accent)] file:text-white hover:file:bg-[var(--accent-hover)] cursor-pointer"
            />
            <p className="mt-2 text-[11px] text-[var(--text-tertiary)] mono">Arrastra PDFs o hace click para seleccionar</p>
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="w-full py-2.5 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            {uploading ? 'Procesando...' : 'Subir PDFs'}
          </button>
        </form>

        {uploadResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploadResults.map((r: any, i: number) => (
              <div key={i} className={`p-3 rounded-lg mono text-xs ${r.success ? 'bg-[var(--green)]/10 text-[var(--green)]' : 'bg-[var(--red)]/10 text-[var(--red)]'}`}>
                {r.success ? `Manifiesto ${r.numero} — ${r.guias} guias` : `Error: ${r.error}`}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loaded manifests */}
      {(manifiestos.length > 0 || pending.length > 0) && (
        <div className="space-y-3">
          {pending.length > 0 && (
            <div>
              <div className="text-[10px] mono uppercase tracking-wider text-[var(--orange)] mb-2 px-1">
                Pendientes del dia anterior
              </div>
              {pending.map(m => <ManifiestoRow key={m.id} m={m} onDelete={onDelete} isPending />)}
            </div>
          )}
          {manifiestos.length > 0 && (
            <div>
              <div className="text-[10px] mono uppercase tracking-wider text-[var(--text-tertiary)] mb-2 px-1">
                Cargados hoy
              </div>
              {manifiestos.map(m => <ManifiestoRow key={m.id} m={m} onDelete={onDelete} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── DASHBOARD TAB ─── */
function DashboardTab({ manifiestos, pending, totalGuias, checkedGuias, analytics }: {
  manifiestos: Manifiesto[]; pending: Manifiesto[]; totalGuias: number; checkedGuias: number; analytics: AnalyticsData | null;
}) {
  const pct = totalGuias > 0 ? Math.round((checkedGuias / totalGuias) * 100) : 0;

  const allChecked = [...manifiestos, ...pending].flatMap(m =>
    m.guias.filter(g => g.checked && g.checkedAt).map(g => ({ ...g, uploadedAt: m.uploadedAt }))
  );
  const avgMs = allChecked.length > 0
    ? allChecked.reduce((s, g) => s + (new Date(g.checkedAt!).getTime() - new Date(g.uploadedAt).getTime()), 0) / allChecked.length
    : 0;

  const fmtDur = (ms: number) => {
    if (!ms) return '--';
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    return m > 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${s}s`;
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" subtitle="Metricas en tiempo real e inteligencia predictiva" />

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Total Guias" value={totalGuias} />
        <KpiCard label="Completadas" value={checkedGuias} color="green" />
        <KpiCard label="Pendientes" value={totalGuias - checkedGuias} color={totalGuias - checkedGuias > 0 ? 'orange' : 'green'} />
        <KpiCard label="Tiempo Prom." value={fmtDur(avgMs)} color="blue" />
      </div>

      {/* Progress */}
      <div className="card-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] mono uppercase tracking-wider text-[var(--text-tertiary)]">Progreso</span>
          <span className="text-xs mono text-[var(--text-secondary)]">{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${pct === 100 ? 'bg-[var(--green)]' : 'bg-[var(--accent)]'}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
      </div>

      {/* Score + Prediction */}
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-3">
          {analytics ? <ScoreWidget score={analytics.score} /> : <div className="card animate-pulse h-48" />}
        </div>
        <div className="col-span-3">
          {analytics ? (
            <EstimatedCompletionWidget
              estimatedTime={analytics.predictions.estimatedCompletionTime}
              remainingMinutes={analytics.predictions.estimatedRemainingMinutes}
              confidence={analytics.predictions.confidence}
              completionRate={analytics.predictions.completionRate}
            />
          ) : <div className="card animate-pulse h-48" />}
        </div>
        <div className="col-span-6 grid grid-cols-3 gap-3">
          {analytics ? (
            <>
              <AnomalyAlertWidget anomalies={analytics.anomalies} />
              <RiskScoreWidget manifiestos={manifiestos} pending={pending} />
              <SuggestionWidget suggestions={analytics.suggestions} />
            </>
          ) : (
            <>
              <div className="card animate-pulse h-48" />
              <div className="card animate-pulse h-48" />
              <div className="card animate-pulse h-48" />
            </>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-7 card">
          <div className="text-[10px] mono uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Tendencia 30 dias</div>
          {analytics ? <CompletionTrendChart data={analytics.trendData} /> : <div className="h-64 animate-pulse" />}
        </div>
        <div className="col-span-5 card">
          <div className="text-[10px] mono uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Actividad</div>
          {analytics ? <ActivityHeatmap data={analytics.heatmapData} /> : <div className="h-48 animate-pulse" />}
        </div>
      </div>

      {analytics && analytics.trendData.length > 0 && (
        <div className="card">
          <div className="text-[10px] mono uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Score diario</div>
          <DailyBarChart data={analytics.trendData} />
        </div>
      )}
    </div>
  );
}

/* ─── TRACKING TAB ─── */
function TrackingTab({ allManifiestos }: { allManifiestos: Manifiesto[] }) {
  const [query, setQuery] = useState('');
  const [selectedGuia, setSelectedGuia] = useState('');
  const [trackingData, setTrackingData] = useState<any>(null);
  const [loadingTrack, setLoadingTrack] = useState(false);

  const allGuias = allManifiestos.flatMap(m =>
    m.guias.map(g => ({ ...g, manifiestoNumero: m.numero, manifiestoId: m.id, uploadedAt: m.uploadedAt }))
  );

  // Group guias by manifest
  const groupedByManifest = allManifiestos.map(m => ({
    numero: m.numero,
    fecha: m.fecha,
    guias: m.guias,
  }));

  const doTrack = async (guia: string) => {
    setSelectedGuia(guia);
    setTrackingData(null);
    setLoadingTrack(true);
    try {
      const res = await fetch(`/api/tracking?guia=${guia}`);
      const data = await res.json();
      setTrackingData(data);
    } catch {
      setTrackingData({ error: 'Error de conexion' });
    } finally {
      setLoadingTrack(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Tracking" subtitle="Consultar estado de guias en Andreani" />

      {/* Search */}
      <div className="card">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Numero de guia..."
            className="flex-1 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
            onKeyDown={e => e.key === 'Enter' && query && doTrack(query)}
          />
          <button
            onClick={() => query && doTrack(query)}
            disabled={!query}
            className="px-5 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Guias grouped by manifest */}
      {groupedByManifest.length > 0 && (
        <div className="space-y-3">
          {groupedByManifest.map(group => (
            <div key={group.numero} className="card-sm">
              <div className="flex items-center gap-3 mb-3">
                <span className="mono text-xs font-medium text-[var(--text-primary)]">Manifiesto {group.numero}</span>
                <span className="badge bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">{group.fecha}</span>
                <span className="badge bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
                  {group.guias.filter(g => g.checked).length}/{group.guias.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.guias.map(g => (
                  <button
                    key={g.numero}
                    onClick={() => { setQuery(g.numero); doTrack(g.numero); }}
                    className={`px-2.5 py-1 mono text-[11px] rounded-md border transition-all ${
                      selectedGuia === g.numero
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                        : g.checked
                        ? 'bg-[var(--green)]/10 border-[var(--green)]/30 text-[var(--green)]'
                        : 'bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                    }`}
                  >
                    {g.numero}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tracking Result */}
      {selectedGuia && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="mono text-sm font-medium">Guia {selectedGuia}</h3>
            <div className="flex gap-2">
              <a href={`https://www.andreani.com/envio/${selectedGuia}`} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-[var(--accent)] hover:underline mono">
                Ver en Andreani &rarr;
              </a>
            </div>
          </div>

          {/* Internal status */}
          {(() => {
            const g = allGuias.find(x => x.numero === selectedGuia);
            if (!g) return null;
            return (
              <div className="flex gap-3">
                <StatusStep label="Cargado" time={new Date(g.uploadedAt).toLocaleString('es-AR')} done />
                <StatusStep label="Empaquetado" time={g.checkedAt ? new Date(g.checkedAt).toLocaleString('es-AR') : 'Pendiente'} done={g.checked} />
              </div>
            );
          })()}

          {/* Scraped tracking data */}
          {loadingTrack && (
            <div className="flex items-center gap-2 py-4">
              <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[var(--text-secondary)]">Consultando Andreani...</span>
            </div>
          )}

          {trackingData && !loadingTrack && (
            <div>
              {trackingData.tracking && trackingData.source !== 'link' ? (
                <div className="space-y-3">
                  <div className="text-[10px] mono uppercase tracking-wider text-[var(--text-tertiary)]">
                    Datos de Andreani ({trackingData.source === 'api' ? 'API' : 'Scraping'})
                  </div>

                  {/* If it's an array of events/trazas */}
                  {Array.isArray(trackingData.tracking) ? (
                    <div className="space-y-1.5">
                      {trackingData.tracking.map((ev: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-[var(--bg-tertiary)]">
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${i === 0 ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
                          <div>
                            <div className="text-xs">{ev.Estado || ev.estado || ev.Descripcion || ev.descripcion || JSON.stringify(ev).slice(0, 120)}</div>
                            <div className="text-[10px] mono text-[var(--text-tertiary)] mt-0.5">
                              {ev.Fecha || ev.fecha || ev.FechaHora || ''} {ev.Sucursal || ev.sucursal || ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : typeof trackingData.tracking === 'object' ? (
                    /* If it's an object with properties */
                    <div className="space-y-2">
                      {/* Try to show envio status */}
                      {trackingData.tracking.envio && (
                        <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                          <div className="text-xs font-medium text-[var(--text-primary)] mb-1">
                            Estado: {trackingData.tracking.envio.Estado || trackingData.tracking.envio.estado || 'Desconocido'}
                          </div>
                          {trackingData.tracking.envio.UltimoEvento && (
                            <div className="text-[10px] text-[var(--text-secondary)]">
                              {trackingData.tracking.envio.UltimoEvento}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Show trazas if present */}
                      {(trackingData.tracking.trazas || trackingData.tracking.eventos) && (
                        <div className="space-y-1.5">
                          {(trackingData.tracking.trazas || trackingData.tracking.eventos || []).map((ev: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-[var(--bg-tertiary)]">
                              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${i === 0 ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
                              <div>
                                <div className="text-xs">{ev.Estado || ev.estado || ev.Descripcion || ev.descripcion || ''}</div>
                                <div className="text-[10px] mono text-[var(--text-tertiary)] mt-0.5">
                                  {ev.Fecha || ev.fecha || ''} {ev.Sucursal || ev.sucursal || ''}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Fallback: show raw JSON prettified */}
                      {!trackingData.tracking.envio && !trackingData.tracking.trazas && !trackingData.tracking.eventos && (
                        <pre className="text-[10px] mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)] p-3 rounded-lg overflow-auto max-h-60">
                          {JSON.stringify(trackingData.tracking, null, 2)}
                        </pre>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-[var(--text-secondary)]">{String(trackingData.tracking)}</div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-[var(--bg-tertiary)] text-center">
                  <div className="text-sm text-[var(--text-secondary)] mb-2">No se pudo obtener datos de la API de Andreani</div>
                  <div className="text-[10px] text-[var(--text-tertiary)] mb-3">Podes consultar directamente en la web:</div>
                  <div className="flex justify-center gap-2">
                    <a href={`https://www.andreani.com/envio/${selectedGuia}`} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-[var(--accent)] text-white text-xs rounded-lg hover:bg-[var(--accent-hover)] transition-colors">
                      andreani.com/envio &rarr;
                    </a>
                    <a href={`https://www.andreani.com/#!/informacionEnvio/${selectedGuia}`} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-xs rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
                      Link alternativo &rarr;
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── HISTORY TAB ─── */
function HistoryTab({ history }: { history: DayRecord[] }) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  if (history.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="Historial" subtitle="Dias finalizados" />
        <div className="card text-center py-12">
          <div className="text-2xl mb-2 opacity-50">📋</div>
          <p className="text-sm text-[var(--text-tertiary)]">No hay dias finalizados</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Historial" subtitle={`${history.length} dias finalizados`} />
      <div className="space-y-2">
        {[...history].reverse().map((day, i) => {
          const isExpanded = expandedDay === i;
          const rate = day.totalGuias > 0 ? Math.round((day.completedGuias / day.totalGuias) * 100) : 0;
          return (
            <div key={i} className="card-sm">
              <button
                onClick={() => setExpandedDay(isExpanded ? null : i)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="mono text-sm font-medium">{day.date}</span>
                  <span className={`badge ${rate === 100 ? 'bg-[var(--green)]/10 text-[var(--green)]' : 'bg-[var(--orange)]/10 text-[var(--orange)]'}`}>
                    {day.completedGuias}/{day.totalGuias}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)] mono">{rate}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[var(--text-tertiary)] mono">
                    {new Date(day.finalizedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-[var(--text-tertiary)] text-xs">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-2">
                      {day.manifiestos.map(m => (
                        <div key={m.id} className="p-2.5 rounded-lg bg-[var(--bg-tertiary)]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="mono text-xs font-medium">M. {m.numero}</span>
                            <span className="text-[10px] text-[var(--text-tertiary)]">{m.sucursal}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {m.guias.map(g => (
                              <span key={g.numero} className={`inline-block px-1.5 py-0.5 rounded text-[9px] mono ${
                                g.checked
                                  ? 'bg-[var(--green)]/10 text-[var(--green)]'
                                  : 'bg-[var(--red)]/10 text-[var(--red)]'
                              }`}>
                                {g.numero.slice(-6)}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── SHARED COMPONENTS ─── */
function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-1">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-xs text-[var(--text-tertiary)]">{subtitle}</p>
    </div>
  );
}

function ManifiestoRow({ m, onDelete, isPending }: { m: Manifiesto; onDelete: (id: string, n: string) => void; isPending?: boolean }) {
  const done = m.guias.filter(g => g.checked).length;
  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="card-sm flex items-center justify-between mb-2"
    >
      <div className="flex items-center gap-3">
        <span className="mono text-xs font-medium">{m.numero}</span>
        <span className="text-[10px] text-[var(--text-tertiary)]">{m.sucursal}</span>
        {isPending && <span className="badge bg-[var(--orange)]/10 text-[var(--orange)]">pendiente</span>}
      </div>
      <div className="flex items-center gap-4">
        <span className="mono text-[11px] text-[var(--text-tertiary)]">{done}/{m.guias.length}</span>
        <span className="text-[10px] text-[var(--text-tertiary)] mono">
          {new Date(m.uploadedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <button onClick={() => onDelete(m.id, m.numero)}
          className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--red)] hover:bg-[var(--red)]/10 transition-colors text-xs mono font-bold">
          ×
        </button>
      </div>
    </motion.div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const c = color === 'green' ? 'text-[var(--green)]' : color === 'orange' ? 'text-[var(--orange)]' : color === 'blue' ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]';
  return (
    <div className="card-sm">
      <div className="text-[10px] mono uppercase tracking-wider text-[var(--text-tertiary)] mb-1">{label}</div>
      <div className={`mono text-xl font-semibold ${c}`}>{value}</div>
    </div>
  );
}

function StatusStep({ label, time, done }: { label: string; time: string; done: boolean }) {
  return (
    <div className={`flex-1 p-3 rounded-lg border ${done ? 'bg-[var(--green)]/5 border-[var(--green)]/20' : 'bg-[var(--bg-tertiary)] border-[var(--border)]'}`}>
      <div className="flex items-center gap-2 mb-0.5">
        <div className={`w-2 h-2 rounded-full ${done ? 'bg-[var(--green)]' : 'bg-[var(--border)]'}`} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-[10px] mono text-[var(--text-tertiary)]">{time}</span>
    </div>
  );
}

/* ─── ICONS (minimal SVG) ─── */
function IconDoc() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
}
function IconChart() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}
function IconSearch() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}
function IconClock() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
