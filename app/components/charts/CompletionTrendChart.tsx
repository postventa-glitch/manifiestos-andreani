'use client';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { TrendPoint } from '@/lib/types';

export function CompletionTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-[var(--text-tertiary)] mono text-sm">Sin datos</div>;

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a', fontFamily: 'IBM Plex Mono' }} tickFormatter={v => v.split('/').slice(0, 2).join('/')} />
          <YAxis tick={{ fontSize: 10, fill: '#71717a', fontFamily: 'IBM Plex Mono' }} domain={[0, 100]} />
          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#fafafa' }}
            formatter={(v: number, n: string) => [`${v}%`, n === 'completionRate' ? 'Completitud' : 'Score']} />
          <Area type="monotone" dataKey="completionRate" stroke="#3b82f6" strokeWidth={1.5} fill="url(#gc)" isAnimationActive animationDuration={800} />
          <Area type="monotone" dataKey="score" stroke="#22c55e" strokeWidth={1.5} fill="url(#gs)" isAnimationActive animationDuration={800} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
