'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Manifiesto } from '@/lib/types';

interface Props {
  manifiestos: Manifiesto[];
  pending: Manifiesto[];
}

interface RiskItem {
  guiaNumero: string;
  manifiestoNumero: string;
  minutesElapsed: number;
  risk: 'high' | 'medium' | 'low';
}

export function RiskScoreWidget({ manifiestos, pending }: Props) {
  const now = Date.now();
  const allManifiestos = [...pending, ...manifiestos];

  const riskItems: RiskItem[] = allManifiestos
    .flatMap(m =>
      m.guias
        .filter(g => !g.checked)
        .map(g => {
          const minutes = Math.round((now - new Date(m.uploadedAt).getTime()) / 60000);
          return {
            guiaNumero: g.numero,
            manifiestoNumero: m.numero,
            minutesElapsed: minutes,
            risk: minutes > 120 ? 'high' as const : minutes > 60 ? 'medium' as const : 'low' as const,
          };
        })
    )
    .sort((a, b) => b.minutesElapsed - a.minutesElapsed);

  const highRisk = riskItems.filter(r => r.risk === 'high').length;

  return (
    <div className="dashboard-card">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
          Riesgo carry-over
        </div>
        {highRisk > 0 && (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
            {highRisk} alto riesgo
          </span>
        )}
      </div>

      {riskItems.length === 0 ? (
        <div className="flex items-center gap-3 py-4">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-lg">
            🎯
          </div>
          <div>
            <div className="font-mono text-sm font-semibold text-verde">Todo completado</div>
            <div className="font-mono text-[10px] text-gray-400">No hay guias pendientes</div>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          <AnimatePresence>
            {riskItems.slice(0, 6).map((item, i) => (
              <motion.div
                key={item.guiaNumero}
                layout
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50"
              >
                <div className={`w-1.5 h-6 rounded-full shrink-0 ${
                  item.risk === 'high' ? 'bg-red-500' : item.risk === 'medium' ? 'bg-amber-400' : 'bg-blue-300'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] truncate">{item.guiaNumero}</div>
                  <div className="font-mono text-[9px] text-gray-400">M. {item.manifiestoNumero}</div>
                </div>
                <span className="font-mono text-[10px] text-gray-500 shrink-0">
                  {item.minutesElapsed < 60
                    ? `${item.minutesElapsed}m`
                    : `${Math.floor(item.minutesElapsed / 60)}h${item.minutesElapsed % 60}m`}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          {riskItems.length > 6 && (
            <div className="font-mono text-[10px] text-gray-400 text-center pt-1">
              +{riskItems.length - 6} mas
            </div>
          )}
        </div>
      )}
    </div>
  );
}
