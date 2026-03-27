'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { AnomalyResult } from '@/lib/types';

export function AnomalyAlertWidget({ anomalies }: { anomalies: AnomalyResult[] }) {
  if (anomalies.length === 0) {
    return (
      <div className="card">
        <div className="text-[10px] mono uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Anomalias</div>
        <div className="py-2">
          <div className="text-xs text-[var(--green)]">Sin anomalias</div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Todo normal</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] mono uppercase tracking-wider text-[var(--text-tertiary)]">Anomalias</div>
        <span className="badge bg-[var(--red)]/10 text-[var(--red)]">{anomalies.length}</span>
      </div>
      <div className="space-y-1.5 max-h-36 overflow-y-auto">
        <AnimatePresence>
          {anomalies.slice(0, 4).map((a, i) => (
            <motion.div key={a.guiaNumero} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
              className={`p-2 rounded-lg text-[10px] mono ${a.severity === 'critical' ? 'bg-[var(--red)]/10' : 'bg-[var(--orange)]/10'}`}>
              <div className="flex items-center justify-between">
                <span className="truncate">{a.guiaNumero}</span>
                <span className={a.severity === 'critical' ? 'text-[var(--red)]' : 'text-[var(--orange)]'}>{a.minutesElapsed}m</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
