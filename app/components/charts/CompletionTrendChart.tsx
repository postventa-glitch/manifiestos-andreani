'use client';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { TrendPoint } from '@/lib/types';

export function CompletionTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return <EmptyChart message="Sin datos historicos" />;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="gradCompletion" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0057d9" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0057d9" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0f9d58" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0f9d58" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }}
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
            formatter={(value: number, name: string) => [
              `${value}%`,
              name === 'completionRate' ? 'Completitud' : 'Score',
            ]}
          />
          <Area
            type="monotone"
            dataKey="completionRate"
            stroke="#0057d9"
            strokeWidth={2}
            fill="url(#gradCompletion)"
            name="completionRate"
            isAnimationActive={true}
            animationDuration={800}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#0f9d58"
            strokeWidth={2}
            fill="url(#gradScore)"
            name="score"
            isAnimationActive={true}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-64 flex items-center justify-center text-gray-400 font-mono text-sm">
      {message}
    </div>
  );
}
