'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import type { TrendPoint } from '@/lib/types';

export function DailyBarChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 font-mono text-sm">
        Sin datos historicos
      </div>
    );
  }

  const getBarColor = (score: number) => {
    if (score >= 70) return '#0f9d58';
    if (score >= 40) return '#f59e0b';
    return '#d93025';
  };

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(-14)} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fontFamily: 'IBM Plex Mono' }}
            tickFormatter={(v) => v.split('/').slice(0, 2).join('/')}
          />
          <YAxis tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              fontFamily: 'IBM Plex Mono',
              fontSize: 11,
              borderRadius: 8,
              border: '1px solid #e5e7eb',
            }}
            formatter={(value: number) => [`${value}`, 'Score']}
          />
          <Bar dataKey="score" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800}>
            {data.slice(-14).map((entry, idx) => (
              <Cell key={idx} fill={getBarColor(entry.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
