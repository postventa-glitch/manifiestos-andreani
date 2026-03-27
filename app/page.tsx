'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useSSE, diffSSEStates } from '@/app/hooks/useSSE';

interface Guia { numero: string; paquetes: number; checked: boolean; checkedAt: string | null; }
interface Manifiesto { id: string; numero: string; fecha: string; sucursal: string; direccion: string; email: string; telefono: string; guias: Guia[]; pesoTotal: string; totalPaquetes: number; uploadedAt: string; }

export default function PublicPage() {
  const [manifiestos, setManifiestos] = useState<Manifiesto[]>([]);
  const [pending, setPending] = useState<Manifiesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const pendingChecks = useRef<Set<string>>(new Set());
  const [highlightedGuia, setHighlightedGuia] = useState<string | null>(null);

  const { connected } = useSSE({
    onUpdate: (prev, next) => {
      if (pendingChecks.current.size > 0) return;
      setManifiestos(next.manifiestos || []);
      setPending(next.pending || []);
      setLoading(false);

      if (prev) {
        const changes = diffSSEStates(prev, next);
        for (const c of changes) {
          if (c.type === 'guia_checked') {
            toast.success(c.detail, { duration: 1500 });
            const num = c.detail.match(/Guia (\d+)/)?.[1];
            if (num) { setHighlightedGuia(num); setTimeout(() => setHighlightedGuia(null), 1500); }
          } else if (c.type === 'manifest_added') toast.info(c.detail, { duration: 2000 });
        }
      }
    },
  });

  const handleCheck = async (manifiestoId: string, guiaNumero: string, checked: boolean) => {
    const key = `${manifiestoId}-${guiaNumero}`;
    pendingChecks.current.add(key);

    const update = (list: Manifiesto[]) => list.map(m =>
      m.id === manifiestoId ? { ...m, guias: m.guias.map(g => g.numero === guiaNumero ? { ...g, checked, checkedAt: checked ? new Date().toISOString() : null } : g) } : m
    );
    setManifiestos(prev => update(prev));
    setPending(prev => update(prev));

    try {
      const res = await fetch('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manifiestoId, guiaNumero, checked }) });
      const data = await res.json();
      setManifiestos(data.manifiestos || []);
      setPending(data.pending || []);
    } finally {
      pendingChecks.current.delete(key);
    }
  };

  const handleFinalize = async () => {
    const unchecked = allManifiestos.flatMap(m => m.guias.filter(g => !g.checked));
    if (!confirm(unchecked.length > 0 ? `Finalizar? ${unchecked.length} guia(s) quedan pendientes.` : 'Finalizar dia?')) return;
    setFinalizing(true);
    try {
      const res = await fetch('/api/finalize', { method: 'POST' });
      const data = await res.json();
      if (data.record) toast.success('Dia finalizado');
    } finally {
      setFinalizing(false);
    }
  };

  const allManifiestos = [...pending, ...manifiestos];
  const totalGuias = allManifiestos.reduce((s, m) => s + m.guias.length, 0);
  const checkedGuias = allManifiestos.reduce((s, m) => s + m.guias.filter(g => g.checked).length, 0);
  const pct = totalGuias > 0 ? Math.round((checkedGuias / totalGuias) * 100) : 0;

  if (loading) {
    return (
      <div className="light-theme min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-tertiary)] mono text-sm animate-pulse">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="light-theme min-h-screen bg-[var(--bg-primary)]">
      {/* Minimal header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="mono text-sm font-semibold tracking-[2px] text-[var(--text-primary)]">ANDREANI</span>
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'}`} />
          </div>
          {totalGuias > 0 && (
            <div className="flex items-center gap-3">
              <div className="w-24 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="mono text-[11px] text-[var(--text-secondary)]">{checkedGuias}/{totalGuias}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-6">
        {allManifiestos.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3 opacity-30">📦</div>
            <div className="text-sm text-[var(--text-tertiary)]">Sin manifiestos cargados</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending from yesterday */}
            {pending.length > 0 && (
              <div>
                <div className="text-[10px] mono uppercase tracking-wider text-orange-500 mb-3 px-1">Pendientes del dia anterior</div>
                {pending.map(m => (
                  <ManifiestoBlock key={m.id} m={m} onCheck={handleCheck} highlightedGuia={highlightedGuia} />
                ))}
              </div>
            )}

            {manifiestos.length > 0 && (
              <div>
                {pending.length > 0 && (
                  <div className="text-[10px] mono uppercase tracking-wider text-[var(--text-tertiary)] mb-3 px-1">Hoy</div>
                )}
                {manifiestos.map(m => (
                  <ManifiestoBlock key={m.id} m={m} onCheck={handleCheck} highlightedGuia={highlightedGuia} />
                ))}
              </div>
            )}

            {/* Finalize */}
            <div className="pt-4 border-t border-[var(--border)]">
              <div className="flex items-center justify-between">
                <div className="mono text-xs text-[var(--text-secondary)]">
                  <span className="text-green-600 font-medium">{checkedGuias}</span> completadas
                  {totalGuias - checkedGuias > 0 && <> · <span className="text-orange-500 font-medium">{totalGuias - checkedGuias}</span> pendientes</>}
                </div>
                <button onClick={handleFinalize} disabled={finalizing}
                  className="px-5 py-2 bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {finalizing ? 'Finalizando...' : 'Finalizar Dia'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ManifiestoBlock({ m, onCheck, highlightedGuia }: {
  m: Manifiesto; onCheck: (mId: string, gNum: string, checked: boolean) => void; highlightedGuia: string | null;
}) {
  const done = m.guias.filter(g => g.checked).length;
  const total = m.guias.length;
  const pct = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="mb-5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
      {/* Manifest header */}
      <div className="px-5 py-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Manifiesto</div>
            <div className="mono text-sm font-semibold text-[var(--text-primary)]">{m.numero}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="mono text-[10px] text-[var(--text-tertiary)]">{m.fecha}</span>
            <span className={`badge ${pct === 100 ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
              {done}/{total}
            </span>
          </div>
        </div>
        {/* Thin progress */}
        <div className="w-full h-0.5 bg-[var(--bg-tertiary)] rounded-full mt-2 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Info row */}
      <div className="px-5 py-2 border-b border-[var(--border)] flex gap-6 text-[11px] text-[var(--text-secondary)]">
        <span>{m.sucursal}</span>
        <span>{m.pesoTotal}</span>
        <span>{m.totalPaquetes} bultos</span>
      </div>

      {/* Guias list */}
      <div>
        {m.guias.map((g, i) => {
          const isHighlighted = highlightedGuia === g.numero;
          return (
            <motion.div
              key={g.numero}
              animate={isHighlighted ? { backgroundColor: ['rgba(34,197,94,0.08)', 'transparent'] } : {}}
              transition={{ duration: 1.2 }}
              className={`flex items-center gap-4 px-5 py-2.5 border-b border-[var(--border-subtle)] last:border-b-0 ${
                g.checked ? 'opacity-50' : ''
              } hover:bg-[var(--bg-hover)] transition-colors`}
            >
              <input
                type="checkbox"
                className="guia-checkbox"
                checked={g.checked}
                onChange={e => onCheck(m.id, g.numero, e.target.checked)}
              />
              <span className={`mono text-xs flex-1 ${g.checked ? 'line-through' : ''}`}>{g.numero}</span>
              <span className="mono text-[10px] text-[var(--text-tertiary)] w-6 text-center">{g.paquetes}</span>
              {g.checked && g.checkedAt && (
                <span className="mono text-[9px] text-green-600">
                  {new Date(g.checkedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
