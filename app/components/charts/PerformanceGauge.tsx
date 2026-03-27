'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

export function PerformanceGauge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const data = [{ value: score }, { value: 100 - score }];
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Excelente' : score >= 60 ? 'Bueno' : score >= 40 ? 'Regular' : 'Bajo';
  const dim = size === 'sm' ? 120 : size === 'md' ? 150 : 200;
  const ir = size === 'sm' ? 38 : size === 'md' ? 48 : 68;
  const or = size === 'sm' ? 52 : size === 'md' ? 65 : 88;

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: dim, height: dim * 0.55 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} startAngle={180} endAngle={0} innerRadius={ir} outerRadius={or} paddingAngle={0} dataKey="value" isAnimationActive animationDuration={1000}>
              <Cell fill={color} />
              <Cell fill="#27272a" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <motion.div className="flex flex-col items-center -mt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={score}>
        <span className="mono text-2xl font-semibold" style={{ color }}>{score}</span>
        <span className="mono text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider">{label}</span>
      </motion.div>
    </div>
  );
}
