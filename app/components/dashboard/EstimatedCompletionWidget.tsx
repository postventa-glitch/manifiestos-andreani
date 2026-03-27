'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  estimatedTime: string | null;
  remainingMinutes: number | null;
  confidence: 'high' | 'medium' | 'low';
  completionRate: number;
}

export function EstimatedCompletionWidget({ estimatedTime, remainingMinutes, confidence, completionRate }: Props) {
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const formatRemaining = (mins: number) => {
    if (mins <= 0) return 'Completado';
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const confColors = { high: 'bg-[var(--green)]/10 text-[var(--green)]', medium: 'bg-[var(--orange)]/10 text-[var(--orange)]', low: 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]' };
  const confLabels = { high: 'Alta', medium: 'Media', low: 'Baja' };

  return (
    <div className="card">
      <div className="text-[10px] mono uppercase tracking-wider text-[var(--text-tertiary)] mb-3">ETA</div>
      <AnimatePresence mode="wait">
        {estimatedTime && remainingMinutes !== null && remainingMinutes > 0 ? (
          <motion.div key={estimatedTime} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mono text-2xl font-semibold text-[var(--text-primary)] mb-1">{formatTime(estimatedTime)}</div>
            <div className="flex items-center gap-2 mb-2">
              <span className="mono text-xs text-[var(--text-secondary)]">~{formatRemaining(remainingMinutes)}</span>
              <span className={`badge ${confColors[confidence]}`}>{confLabels[confidence]}</span>
            </div>
            {completionRate > 0 && <div className="mono text-[10px] text-[var(--text-tertiary)]">{completionRate} guias/min</div>}
          </motion.div>
        ) : remainingMinutes === 0 ? (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-2">
            <div className="mono text-[var(--green)] font-medium">Completo</div>
          </motion.div>
        ) : (
          <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4">
            <div className="text-sm text-[var(--text-tertiary)]">Necesita mas datos</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
