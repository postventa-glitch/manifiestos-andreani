'use client';

import { motion } from 'framer-motion';
import type { Suggestion } from '@/lib/types';

export function SuggestionWidget({ suggestions }: { suggestions: Suggestion[] }) {
  const colors = { high: 'border-[var(--red)]/20 bg-[var(--red)]/5', medium: 'border-[var(--orange)]/20 bg-[var(--orange)]/5', low: 'border-[var(--green)]/20 bg-[var(--green)]/5' };

  return (
    <div className="card">
      <div className="text-[10px] mono uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Sugerencias</div>
      <div className="space-y-1.5 max-h-36 overflow-y-auto">
        {suggestions.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}
            className={`p-2 rounded-lg border ${colors[s.priority]}`}>
            <div className="text-[11px] font-medium text-[var(--text-primary)]">{s.icon} {s.title}</div>
            <div className="text-[9px] text-[var(--text-tertiary)] mt-0.5 leading-relaxed">{s.description}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
