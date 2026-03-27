'use client';

import { motion } from 'framer-motion';
import type { HeatmapCell } from '@/lib/types';

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function ActivityHeatmap({ data }: { data: HeatmapCell[] }) {
  if (data.length === 0) return <div className="h-40 flex items-center justify-center text-[var(--text-tertiary)] mono text-sm">Sin datos</div>;

  const maxValue = Math.max(...data.map(c => c.value), 1);
  const hours = Array.from(new Set(data.map(c => c.hour))).sort((a, b) => a - b);

  const getColor = (value: number) => {
    if (value === 0) return 'bg-[var(--bg-tertiary)]';
    const i = value / maxValue;
    if (i < 0.25) return 'bg-blue-900/40';
    if (i < 0.5) return 'bg-blue-800/60';
    if (i < 0.75) return 'bg-blue-600/70';
    return 'bg-blue-500';
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[300px]">
        <div className="flex ml-6 mb-0.5">
          {hours.filter((_, i) => i % 2 === 0).map(h => (
            <div key={h} style={{ flex: 2 }} className="text-center mono text-[8px] text-[var(--text-tertiary)]">{h}h</div>
          ))}
        </div>
        {DAY_LABELS.map((d, di) => (
          <div key={di} className="flex items-center gap-0.5 mb-0.5">
            <span className="w-5 mono text-[8px] text-[var(--text-tertiary)] text-right shrink-0">{d}</span>
            <div className="flex flex-1 gap-px">
              {hours.map(h => {
                const cell = data.find(c => c.day === di && c.hour === h);
                return (
                  <motion.div key={`${di}-${h}`}
                    className={`flex-1 h-3.5 rounded-sm ${getColor(cell?.value || 0)}`}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: (di * hours.length + hours.indexOf(h)) * 0.005 }}
                    title={`${d} ${h}h: ${cell?.value || 0}`} />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
