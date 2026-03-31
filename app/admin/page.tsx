'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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

interface TimelineStep {
  label: string;
  date: string | null;
  done: boolean;
}

interface GuiaTracking {
  guiaNumero: string;
  status: string;
  statusText: string;
  lastChecked: string;
  empresa?: string;
  timeline?: TimelineStep[];
}

type Tab = 'upload' | 'dashboard' | 'tracking' | 'entregas' | 'audit' | 'history';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('upload');
  const [manifiestos, setManifiestos] = useState<Manifiesto[]>([]);
  const [pending, setPending] = useState<Manifiesto[]>([]);
  const [history, setHistory] = useState<DayRecord[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<any[]>([]);
  const lastVersion = useRef<number>(0);

  const fetchData = useCallback(async () => {
    try {
      const [mRes, hRes] = await Promise.all([
        fetch('/api/manifiestos'),
        fetch('/api/finalize'),
      ]);
      const mData = await mRes.json();
      const hData = await hRes.json();
      const serverVersion = mData._version || 0;
      const hasServerData = (mData.manifiestos?.length > 0 || mData.pending?.length > 0);
      const hasLocalData = lastVersion.current > 0;

      // NEVER replace good data with empty response
      if (hasServerData || !hasLocalData) {
        if (serverVersion >= lastVersion.current || hasServerData) {
          setManifiestos(mData.manifiestos || []);
          setPending(mData.pending || []);
          setAuditLog(mData.auditLog || []);
          lastVersion.current = Math.max(serverVersion, lastVersion.current);
        }
      }
      setHistory(hData.history || []);
    } catch {
      // silent on error — keep existing data
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
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const files = fileInput?.files;

    if (!files || files.length === 0) {
      setUploadResults([{ success: false, error: 'No se seleccionaron archivos' }]);
      setUploading(false);
      return;
    }

    try {
      // Extract text client-side using pdf.js from CDN
      const pdfjsLib = await loadPdfJs();
      const formData = new FormData();

      for (const file of Array.from(files)) {
        const arrayBuffer = await file.arrayBuffer();
        try {
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let fullText = '';
          for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            const pageText = content.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
          }
          formData.append('texts', fullText);
          formData.append('pdfs', file);
        } catch {
          // If pdf.js fails, send file without text — server will try fallback
          formData.append('pdfs', file);
        }
      }

      const res = await fetch('/api/manifiestos', { method: 'POST', body: formData });
      const data = await res.json();
      setUploadResults(data.results || []);
      setManifiestos(data.manifiestos || []);
      form.reset();
    } catch (err) {
      setUploadResults([{ success: false, error: 'Error: ' + String(err) }]);
    } finally {
      setUploading(false);
    }
  };

  // Lazy-load pdf.js from CDN
  const loadPdfJs = async () => {
    if ((window as any).__pdfjsLib) return (window as any).__pdfjsLib;
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    document.head.appendChild(script);
    await new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load pdf.js'));
    });
    const lib = (window as any).pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    (window as any).__pdfjsLib = lib;
    return lib;
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
    { key: 'entregas', label: 'Entregas' },
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
        {tab === 'entregas' && <EntregasTab allManifiestos={allManifiestos} />}
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
// Client-side HTML parser for Andreani tracking
function parseAndreaniHTML(html: string, guia: string): Omit<GuiaTracking, 'lastChecked'> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const text = doc.body?.innerText || html;

  const statusOrder = ['Pendiente de ingreso', 'Ingresado', 'En camino', 'En sucursal', 'Entregado'];
  const statusMap: Record<string, string> = {
    'Pendiente de ingreso': 'pendiente',
    'Ingresado': 'ingresado',
    'En camino': 'en_camino',
    'En sucursal': 'en_camino',
    'Entregado': 'entregado',
    'No entregado': 'no_entregado',
    'Devuelto': 'devuelto',
  };

  // Build timeline
  const timeline: TimelineStep[] = [];
  let mainStatus = 'desconocido';
  let mainStatusText = 'Desconocido';

  for (const label of statusOrder) {
    const idx = text.indexOf(label);
    if (idx > -1) {
      const after = text.substring(idx + label.length, idx + label.length + 30);
      const dateMatch = after.match(/(\d{2}-\d{2}-\d{4})/);
      timeline.push({ label, date: dateMatch?.[1] || null, done: dateMatch !== null });
    } else {
      timeline.push({ label, date: null, done: false });
    }
  }

  // Main status: find the primary heading (appears before the timeline)
  const mainMatch = text.match(/(No entregado|Devuelto|Entregado|En distribuci[oó]n|En camino|En sucursal|Ingresado|Pendiente de ingreso)/);
  if (mainMatch) {
    mainStatusText = mainMatch[1];
    mainStatus = statusMap[mainMatch[1]] || 'desconocido';
  }

  // Empresa
  const empresaMatch = text.match(/(?:envío|Envío|envio) de\s+([A-Z\s.]+?(?:S\.?A\.?|S\.?R\.?L\.?|S\.?A\.?S\.?|INC\.?))/i);

  return {
    guiaNumero: guia,
    status: mainStatus as any,
    statusText: mainStatusText,
    empresa: empresaMatch?.[1]?.trim(),
    timeline,
  };
}

function TrackingTab({ allManifiestos }: { allManifiestos: Manifiesto[] }) {
  const [selectedGuia, setSelectedGuia] = useState('');
  const [customGuia, setCustomGuia] = useState('');
  const [trackingData, setTrackingData] = useState<Record<string, GuiaTracking>>({});
  const [loadingGuia, setLoadingGuia] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const allGuias = allManifiestos.flatMap(m =>
    m.guias.map(g => ({ ...g, manifiestoNumero: m.numero, manifiestoId: m.id, uploadedAt: m.uploadedAt }))
  );

  useEffect(() => {
    fetch('/api/tracking?all=1').then(r => r.json()).then(data => {
      const map: Record<string, GuiaTracking> = {};
      (data.trackings || []).forEach((t: GuiaTracking) => { map[t.guiaNumero] = t; });
      setTrackingData(map);
    }).catch(() => {});
  }, []);

  // Scrape a single guia via proxy + DOMParser
  const scrapeGuia = async (guia: string): Promise<GuiaTracking | null> => {
    try {
      const res = await fetch(`/api/tracking?proxy=1&guia=${guia}`);
      const html = await res.text();
      if (!html || html.length < 100) return null;
      const parsed = parseAndreaniHTML(html, guia);
      const tracking: GuiaTracking = { ...parsed, lastChecked: new Date().toISOString() };
      // Save to server
      await fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tracking),
      });
      return tracking;
    } catch {
      return null;
    }
  };

  const fetchTracking = async (guia: string) => {
    setLoadingGuia(guia);
    const result = await scrapeGuia(guia);
    if (result) {
      setTrackingData(prev => ({ ...prev, [guia]: result }));
    }
    setLoadingGuia('');
  };

  const scanAll = async () => {
    setScanning(true);
    const nums = allGuias.map(g => g.numero);
    for (let i = 0; i < nums.length; i++) {
      setScanProgress(`${i + 1}/${nums.length}`);
      const result = await scrapeGuia(nums[i]);
      if (result) {
        setTrackingData(prev => ({ ...prev, [nums[i]]: result }));
      }
      // Small delay to avoid rate limiting
      if (i < nums.length - 1) await new Promise(r => setTimeout(r, 500));
    }
    setScanProgress('');
    setScanning(false);
  };

  const handleSelect = (guia: string) => {
    setSelectedGuia(guia);
    setCustomGuia(guia);
    fetchTracking(guia);
  };

  const trackingUrl = selectedGuia ? `https://www.andreani.com/#!/informacionEnvio/${selectedGuia}` : '';

  const statusColor = (status: string) => {
    switch (status) {
      case 'entregado': return 'bg-green-50 border-green-200 text-green-700';
      case 'en_camino': case 'en_distribucion': return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'ingresado': return 'bg-cyan-50 border-cyan-200 text-cyan-700';
      case 'pendiente': return 'bg-gray-50 border-gray-200 text-gray-500';
      case 'no_entregado': case 'devuelto': return 'bg-red-50 border-red-200 text-red-700';
      default: return 'bg-gray-50 border-gray-200 text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Search + Scan */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-lg font-semibold text-azul">Consultar Tracking Andreani</h2>
          {allGuias.length > 0 && (
            <button
              onClick={scanAll}
              disabled={scanning}
              className="px-4 py-2 bg-acento text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {scanning ? `Escaneando ${scanProgress}...` : `Escanear todas (${allGuias.length})`}
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <input type="text" value={customGuia} onChange={e => setCustomGuia(e.target.value)} placeholder="Numero de guia..." className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-acento" onKeyDown={e => e.key === 'Enter' && customGuia && handleSelect(customGuia)} />
          <button onClick={() => handleSelect(customGuia)} disabled={!customGuia} className="px-6 py-2.5 bg-acento text-white font-mono text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">Buscar</button>
        </div>
      </div>

      {/* Quick links with status */}
      {allGuias.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-mono text-sm font-semibold text-azul mb-3 uppercase tracking-wider">Guias — Click para ver estado</h3>
          <div className="flex flex-wrap gap-2">
            {allGuias.map(g => {
              const t = trackingData[g.numero];
              return (
                <button key={g.numero} onClick={() => handleSelect(g.numero)} className={`px-3 py-1.5 font-mono text-xs rounded-lg border transition-colors ${selectedGuia === g.numero ? 'bg-acento border-acento text-white' : t ? statusColor(t.status) : g.checked ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-acento'}`}>
                  {g.numero}
                  {t && t.status !== 'desconocido' && <span className="ml-1.5 text-[9px] opacity-75">({t.statusText})</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tracking flow */}
      {selectedGuia && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          {allGuias.find(g => g.numero === selectedGuia) && (() => {
            const g = allGuias.find(x => x.numero === selectedGuia)!;
            const t = trackingData[selectedGuia];
            const tl = t?.timeline || [];
            const getTimelineDate = (label: string) => tl.find(s => s.label === label)?.date || null;
            const isTimelineDone = (label: string) => tl.find(s => s.label === label)?.done || false;

            // Determine step completion from stored status
            const st = t?.status || 'desconocido';
            const stReached = (target: string[]) => target.includes(st);
            const ingresadoDone = stReached(['ingresado', 'en_camino', 'en_distribucion', 'entregado', 'no_entregado']);
            const enCaminoDone = stReached(['en_camino', 'en_distribucion', 'entregado', 'no_entregado']);
            const entregadoDone = st === 'entregado';

            const steps = [
              { label: 'Carga manifiesto', sub: new Date(g.uploadedAt).toLocaleString('es-AR'), done: true, dotColor: 'bg-green-500', bgColor: 'bg-green-50 border-green-200' },
              { label: 'Empaquetado', sub: g.checkedAt ? new Date(g.checkedAt).toLocaleString('es-AR') : 'Pendiente', done: g.checked, dotColor: g.checked ? 'bg-green-500' : 'bg-gray-300', bgColor: g.checked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200' },
              { label: 'Ingresado', sub: getTimelineDate('Ingresado') || (ingresadoDone ? 'Si' : 'Pendiente'), done: ingresadoDone, dotColor: ingresadoDone ? 'bg-cyan-500' : 'bg-gray-300', bgColor: ingresadoDone ? 'bg-cyan-50 border-cyan-200' : 'bg-gray-50 border-gray-200' },
              { label: 'En camino', sub: getTimelineDate('En camino') || (enCaminoDone ? t?.statusText || 'Si' : 'Pendiente'), done: enCaminoDone, dotColor: enCaminoDone ? 'bg-blue-500' : 'bg-gray-300', bgColor: enCaminoDone ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200' },
              { label: 'Entregado', sub: getTimelineDate('Entregado') || (entregadoDone ? 'Confirmado' : st === 'no_entregado' ? 'No entregado' : 'Pendiente'), done: entregadoDone, dotColor: entregadoDone ? 'bg-green-500' : st === 'no_entregado' ? 'bg-red-500' : 'bg-gray-300', bgColor: entregadoDone ? 'bg-green-50 border-green-200' : st === 'no_entregado' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200' },
            ];

            return (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-mono text-xs font-semibold text-azul uppercase tracking-wider">Flujo completo — {selectedGuia}</h4>
                  <button onClick={() => fetchTracking(selectedGuia)} disabled={loadingGuia === selectedGuia} className="font-mono text-[10px] text-acento hover:underline disabled:opacity-50">
                    {loadingGuia === selectedGuia ? 'Consultando Andreani...' : 'Actualizar estado'}
                  </button>
                </div>
                {/* Flow boxes */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {steps.map((s, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${s.bgColor} relative`}>
                      {i > 0 && <div className="absolute -left-2 top-1/2 -translate-y-1/2 text-gray-300 text-xs">&rarr;</div>}
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dotColor}`} />
                        <span className="font-mono text-[10px] font-semibold leading-tight">{s.label}</span>
                      </div>
                      <span className="font-mono text-[9px] text-gray-500">{s.sub}</span>
                    </div>
                  ))}
                </div>
                {t && (
                  <div className="font-mono text-[10px] text-gray-400">
                    Ultima consulta: {new Date(t.lastChecked).toLocaleString('es-AR')}
                    {t.empresa && <span className="ml-3">Empresa: {t.empresa}</span>}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Quick status buttons */}
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h4 className="font-mono text-[10px] font-semibold text-amber-800 uppercase tracking-wider mb-2">Setear estado (verifica en el iframe de abajo)</h4>
            <div className="flex flex-wrap gap-2">
              {[
                { val: 'pendiente', text: 'Pendiente', color: 'bg-gray-100 hover:bg-gray-200 text-gray-700' },
                { val: 'ingresado', text: 'Ingresado', color: 'bg-cyan-100 hover:bg-cyan-200 text-cyan-800' },
                { val: 'en_camino', text: 'En camino', color: 'bg-blue-100 hover:bg-blue-200 text-blue-800' },
                { val: 'en_sucursal', text: 'En sucursal', color: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800' },
                { val: 'entregado', text: 'Entregado', color: 'bg-green-100 hover:bg-green-200 text-green-800' },
                { val: 'no_entregado', text: 'No entregado', color: 'bg-red-100 hover:bg-red-200 text-red-800' },
              ].map(btn => {
                const statusMap: Record<string, { status: string; text: string }> = {
                  pendiente: { status: 'pendiente', text: 'Pendiente de ingreso' },
                  ingresado: { status: 'ingresado', text: 'Ingresado' },
                  en_camino: { status: 'en_camino', text: 'En camino' },
                  en_sucursal: { status: 'en_camino', text: 'En sucursal' },
                  entregado: { status: 'entregado', text: 'Entregado' },
                  no_entregado: { status: 'no_entregado', text: 'No entregado' },
                };
                const current = trackingData[selectedGuia];
                const isActive = current && (current.status === statusMap[btn.val]?.status || (btn.val === 'en_sucursal' && current.statusText === 'En sucursal'));
                return (
                  <button
                    key={btn.val}
                    onClick={async () => {
                      const s = statusMap[btn.val];
                      const tracking = { guiaNumero: selectedGuia, status: s.status, statusText: s.text };
                      setTrackingData(prev => ({ ...prev, [selectedGuia]: { ...tracking, lastChecked: new Date().toISOString() } }));
                      await fetch('/api/tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tracking) });
                    }}
                    className={`px-3 py-1.5 font-mono text-[11px] font-semibold rounded-lg transition-colors ${isActive ? 'ring-2 ring-offset-1 ring-azul' : ''} ${btn.color}`}
                  >
                    {btn.text}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Andreani embed */}
          <h4 className="font-mono text-xs font-semibold text-azul mb-3 uppercase tracking-wider">Tracking Andreani</h4>
          <div className="flex gap-2 mb-4">
            <a href={`https://www.andreani.com/#!/informacionEnvio/${selectedGuia}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-acento text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">Abrir en Andreani.com &rarr;</a>
            <a href={`https://www.andreani.com/envio/${selectedGuia}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-gray-100 text-gray-700 font-mono text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors">Link alternativo &rarr;</a>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '500px' }}>
            <iframe ref={iframeRef} src={trackingUrl} className="w-full h-full" sandbox="allow-scripts allow-same-origin allow-popups" title={`Tracking ${selectedGuia}`} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ENTREGAS TAB ─── */
function EntregasTab({ allManifiestos }: { allManifiestos: Manifiesto[] }) {
  const [trackingData, setTrackingData] = useState<GuiaTracking[]>([]);
  const [loading, setLoading] = useState(true);

  const allGuias = allManifiestos.flatMap(m =>
    m.guias.map(g => ({ ...g, manifiestoNumero: m.numero, uploadedAt: m.uploadedAt }))
  );

  useEffect(() => {
    fetch('/api/tracking?all=1').then(r => r.json()).then(data => {
      setTrackingData(data.trackings || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const trackingMap = new Map(trackingData.map(t => [t.guiaNumero, t]));

  const entregados = allGuias.filter(g => trackingMap.get(g.numero)?.status === 'entregado');
  const enCamino = allGuias.filter(g => {
    const t = trackingMap.get(g.numero);
    return t && ['en_camino', 'en_distribucion', 'ingresado'].includes(t.status);
  });
  const demorados = allGuias.filter(g => {
    const t = trackingMap.get(g.numero);
    // Demorado: checked (empaquetado) hace mas de 48hs y no entregado
    if (!g.checked || !g.checkedAt) return false;
    const checkedDate = new Date(g.checkedAt);
    const hoursAgo = (Date.now() - checkedDate.getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 48) return false;
    if (t?.status === 'entregado') return false;
    return true;
  });
  const noEntregados = allGuias.filter(g => {
    const t = trackingMap.get(g.numero);
    return t && ['no_entregado', 'devuelto'].includes(t.status);
  });
  const sinEstado = allGuias.filter(g => !trackingMap.has(g.numero));

  if (loading) {
    return <div className="bg-white rounded-xl p-12 shadow-sm text-center font-mono text-sm text-gray-500 animate-pulse">Cargando datos de entregas...</div>;
  }

  const Section = ({ title, items, color, icon }: { title: string; items: typeof allGuias; color: string; icon: string }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
          <span>{icon}</span>
          <span className={color}>{title}</span>
          <span className="text-gray-400 font-normal">({items.length})</span>
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="font-mono text-xs text-gray-400">Sin guias en esta categoria</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2 text-left font-mono text-[10px] text-gray-500 uppercase">Guia</th>
              <th className="py-2 text-left font-mono text-[10px] text-gray-500 uppercase">Manifiesto</th>
              <th className="py-2 text-left font-mono text-[10px] text-gray-500 uppercase">Estado Andreani</th>
              <th className="py-2 text-left font-mono text-[10px] text-gray-500 uppercase">Empaquetado</th>
              <th className="py-2 text-left font-mono text-[10px] text-gray-500 uppercase">Ult. Consulta</th>
              <th className="py-2 text-center font-mono text-[10px] text-gray-500 uppercase w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(g => {
              const t = trackingMap.get(g.numero);
              return (
                <tr key={g.numero} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 font-mono">{g.numero}</td>
                  <td className="py-2 font-mono text-gray-500">{g.manifiestoNumero}</td>
                  <td className="py-2">
                    <span className={`inline-block px-2 py-0.5 rounded font-mono text-[10px] font-semibold ${
                      t?.status === 'entregado' ? 'bg-green-100 text-green-800' :
                      t?.status === 'en_camino' || t?.status === 'en_distribucion' ? 'bg-blue-100 text-blue-800' :
                      t?.status === 'no_entregado' || t?.status === 'devuelto' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {t?.statusText || 'Sin consultar'}
                    </span>
                  </td>
                  <td className="py-2 font-mono text-[10px] text-gray-500">
                    {g.checkedAt ? new Date(g.checkedAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="py-2 font-mono text-[10px] text-gray-400">
                    {t?.lastChecked ? new Date(t.lastChecked).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="py-2 text-center">
                    <a href={`https://www.andreani.com/#!/informacionEnvio/${g.numero}`} target="_blank" rel="noopener noreferrer" className="text-acento hover:underline font-mono text-[10px]">Ver</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Entregados', count: entregados.length, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'En camino', count: enCamino.length, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Demorados', count: demorados.length, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'No entregados', count: noEntregados.length, color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Sin estado', count: sinEstado.length, color: 'text-gray-500', bg: 'bg-gray-50' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4 text-center`}>
            <div className={`font-mono text-2xl font-bold ${k.color}`}>{k.count}</div>
            <div className="font-mono text-[10px] text-gray-500 uppercase tracking-wider mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <Section title="Entregados" items={entregados} color="text-green-700" icon="&#x2705;" />
      <Section title="En camino" items={enCamino} color="text-blue-700" icon="&#x1F69A;" />
      <Section title="Demorados (+48hs)" items={demorados} color="text-amber-700" icon="&#x26A0;" />
      <Section title="No entregados / Devueltos" items={noEntregados} color="text-red-700" icon="&#x274C;" />
      {sinEstado.length > 0 && <Section title="Sin estado consultado" items={sinEstado} color="text-gray-500" icon="&#x2753;" />}
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
