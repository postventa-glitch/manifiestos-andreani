'use client';

import { motion } from 'framer-motion';
import { PerformanceGauge } from '@/app/components/charts/PerformanceGauge';
import type { DayScore } from '@/lib/types';

export function ScoreWidget({ score }: { score: DayScore }) {
  const items = [
    { label: 'Completitud', value: score.completion, weight: '40%' },
    { label: 'Velocidad', value: score.speed, weight: '30%' },
    { label: 'Sin anomalias', value: score.anomalyRate, weight: '20%' },
    { label: 'Consistencia', value: score.consistency, weight: '10%' },
  ];

  return (
    <div className="dashboard-card flex flex-col items-center">
      <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-2 self-start">
        Score del dia
      </div>
      <PerformanceGauge score={score.total} size="md" />
      <div className="w-full mt-4 space-y-1.5">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <span className="font-mono text-[10px] text-gray-400 w-20 shrink-0">{item.label}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  backgroundColor: item.value >= 70 ? '#0f9d58' : item.value >= 40 ? '#f59e0b' : '#d93025',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${item.value}%` }}
                transition={{ duration: 0.8, delay: i * 0.1 }}
              />
            </div>
            <span className="font-mono text-[10px] text-gray-500 w-8 text-right">{item.value}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
