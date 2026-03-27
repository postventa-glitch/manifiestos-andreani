'use client';

import { motion } from 'framer-motion';
import type { Suggestion } from '@/lib/types';

export function SuggestionWidget({ suggestions }: { suggestions: Suggestion[] }) {
  const priorityColors = {
    high: 'border-red-200 bg-red-50/50',
    medium: 'border-amber-200 bg-amber-50/50',
    low: 'border-green-200 bg-green-50/50',
  };

  return (
    <div className="dashboard-card">
      <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-3">
        Sugerencias IA
      </div>
      <div className="space-y-2">
        {suggestions.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`p-3 rounded-lg border ${priorityColors[s.priority]}`}
          >
            <div className="flex items-start gap-2">
              <span className="text-base shrink-0">{s.icon}</span>
              <div>
                <div className="font-mono text-[11px] font-semibold text-azul">{s.title}</div>
                <div className="font-mono text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                  {s.description}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
