'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { AnomalyResult } from '@/lib/types';

export function AnomalyAlertWidget({ anomalies }: { anomalies: AnomalyResult[] }) {
  if (anomalies.length === 0) {
    return (
      <div className="dashboard-card">
        <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-3">
          Anomalias
        </div>
        <div className="flex items-center gap-3 py-4">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-lg">
            ✓
          </div>
          <div>
            <div className="font-mono text-sm font-semibold text-verde">Sin anomalias</div>
            <div className="font-mono text-[10px] text-gray-400">Todos los tiempos dentro del rango normal</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
          Anomalias
        </div>
        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
          {anomalies.length}
        </span>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        <AnimatePresence>
          {anomalies.slice(0, 5).map((anomaly, i) => (
            <motion.div
              key={anomaly.guiaNumero}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 p-2 rounded-lg ${
                anomaly.severity === 'critical' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
              }`}
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                anomaly.severity === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[11px] font-semibold truncate">
                  Guia {anomaly.guiaNumero}
                </div>
                <div className="font-mono text-[9px] text-gray-500">
                  Manif. {anomaly.manifiestoNumero} · {anomaly.minutesElapsed}min · z={anomaly.zScore}
                </div>
              </div>
              <span className={`shrink-0 font-mono text-[9px] px-1.5 py-0.5 rounded ${
                anomaly.severity === 'critical' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
              }`}>
                {anomaly.severity === 'critical' ? 'CRITICO' : 'AVISO'}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
