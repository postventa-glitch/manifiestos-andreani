'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

interface PerformanceGaugeProps {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
}

export function PerformanceGauge({ score, size = 'md' }: PerformanceGaugeProps) {
  const data = [
    { value: score },
    { value: 100 - score },
  ];

  const getColor = (s: number) => {
    if (s >= 70) return '#0f9d58';
    if (s >= 40) return '#f59e0b';
    return '#d93025';
  };

  const getLabel = (s: number) => {
    if (s >= 80) return 'Excelente';
    if (s >= 60) return 'Bueno';
    if (s >= 40) return 'Regular';
    return 'Bajo';
  };

  const color = getColor(score);
  const dimensions = size === 'sm' ? 120 : size === 'md' ? 160 : 200;
  const innerRadius = size === 'sm' ? 38 : size === 'md' ? 52 : 68;
  const outerRadius = size === 'sm' ? 52 : size === 'md' ? 70 : 88;

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: dimensions, height: dimensions * 0.6 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              startAngle={180}
              endAngle={0}
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={0}
              dataKey="value"
              isAnimationActive={true}
              animationDuration={1000}
            >
              <Cell fill={color} />
              <Cell fill="#f3f4f6" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <motion.div
        className="flex flex-col items-center -mt-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        key={score}
      >
        <span className="font-mono text-3xl font-semibold" style={{ color }}>
          {score}
        </span>
        <span className="font-mono text-[10px] text-gray-400 uppercase tracking-wider">
          {getLabel(score)}
        </span>
      </motion.div>
    </div>
  );
}
