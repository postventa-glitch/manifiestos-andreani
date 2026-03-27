'use client';

import { motion } from 'framer-motion';
import type { HeatmapCell } from '@/lib/types';

const DAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

export function ActivityHeatmap({ data }: { data: HeatmapCell[] }) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 font-mono text-sm">
        Sin datos de actividad
      </div>
    );
  }

  const maxValue = Math.max(...data.map(c => c.value), 1);
  const hours = Array.from(new Set(data.map(c => c.hour))).sort((a, b) => a - b);

  const getColor = (value: number) => {
    if (value === 0) return 'bg-gray-100';
    const intensity = value / maxValue;
    if (intensity < 0.25) return 'bg-blue-100';
    if (intensity < 0.5) return 'bg-blue-200';
    if (intensity < 0.75) return 'bg-blue-400';
    return 'bg-blue-600';
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[400px]">
        {/* Hour labels */}
        <div className="flex ml-10 mb-1">
          {hours.map(h => (
            <div key={h} className="flex-1 text-center font-mono text-[9px] text-gray-400">
              {h}h
            </div>
          ))}
        </div>

        {/* Grid */}
        {DAY_LABELS.map((dayLabel, dayIdx) => (
          <div key={dayIdx} className="flex items-center gap-1 mb-1">
            <span className="w-8 font-mono text-[10px] text-gray-500 text-right shrink-0">
              {dayLabel}
            </span>
            <div className="flex flex-1 gap-0.5">
              {hours.map(hour => {
                const cell = data.find(c => c.day === dayIdx && c.hour === hour);
                const value = cell?.value || 0;
                return (
                  <motion.div
                    key={`${dayIdx}-${hour}`}
                    className={`flex-1 h-5 rounded-sm ${getColor(value)} transition-colors`}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (dayIdx * hours.length + hours.indexOf(hour)) * 0.01 }}
                    title={`${dayLabel} ${hour}h: ${value} checks`}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center justify-end gap-2 mt-2 mr-1">
          <span className="font-mono text-[9px] text-gray-400">Menos</span>
          <div className="w-4 h-3 rounded-sm bg-gray-100" />
          <div className="w-4 h-3 rounded-sm bg-blue-100" />
          <div className="w-4 h-3 rounded-sm bg-blue-200" />
          <div className="w-4 h-3 rounded-sm bg-blue-400" />
          <div className="w-4 h-3 rounded-sm bg-blue-600" />
          <span className="font-mono text-[9px] text-gray-400">Mas</span>
        </div>
      </div>
    </div>
  );
}
