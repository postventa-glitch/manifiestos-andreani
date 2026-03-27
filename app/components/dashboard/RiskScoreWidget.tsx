'use client';

import { motion } from 'framer-motion';
import type { Manifiesto } from '@/lib/types';

interface Props { manifiestos: Manifiesto[]; pending: Manifiesto[]; }

export function RiskScoreWidget({ manifiestos, pending }: Props) {
  const now = Date.now();
  const items = [...pending, ...manifiestos]
    .flatMap(m => m.guias.filter(g => !g.checked).map(g => ({
      numero: g.numero,
      mins: Math.round((now - new Date(m.uploadedAt).getTime()) / 60000),
    })))
    .sort((a, b) => b.mins - a.mins)
    .slice(0, 5);

  return (
    <div className="card">
      <div className="text-[10px] mono uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Riesgo</div>
      {items.length === 0 ? (
        <div className="py-2">
          <div className="text-xs text-[var(--green)]">Sin riesgo</div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Todo completo</div>
        </div>
      ) : (
        <div className="space-y-1 max-h-36 overflow-y-auto">
          {items.map((item, i) => (
            <motion.div key={item.numero} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between py-1">
              <span className="mono text-[10px] text-[var(--text-secondary)] truncate">{item.numero.slice(-8)}</span>
              <span className={`mono text-[10px] ${item.mins > 120 ? 'text-[var(--red)]' : item.mins > 60 ? 'text-[var(--orange)]' : 'text-[var(--text-tertiary)]'}`}>
                {item.mins < 60 ? `${item.mins}m` : `${Math.floor(item.mins / 60)}h${item.mins % 60}m`}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
