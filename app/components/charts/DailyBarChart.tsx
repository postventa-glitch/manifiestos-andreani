'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import type { TrendPoint } from '@/lib/types';

export function DailyBarChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <div className="h-40 flex items-center justify-center text-[var(--text-tertiary)] mono text-sm">Sin datos</div>;
  const getColor = (s: number) => s >= 70 ? '#22c55e' : s >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(-14)} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#71717a', fontFamily: 'IBM Plex Mono' }} tickFormatter={v => v.split('/').slice(0, 2).join('/')} />
          <YAxis tick={{ fontSize: 10, fill: '#71717a', fontFamily: 'IBM Plex Mono' }} domain={[0, 100]} />
          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#fafafa' }}
            formatter={(v: number) => [`${v}`, 'Score']} />
          <Bar dataKey="score" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={800}>
            {data.slice(-14).map((e, i) => <Cell key={i} fill={getColor(e.score)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
