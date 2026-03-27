'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  estimatedTime: string | null;
  remainingMinutes: number | null;
  confidence: 'high' | 'medium' | 'low';
  completionRate: number;
}

export function EstimatedCompletionWidget({ estimatedTime, remainingMinutes, confidence, completionRate }: Props) {
  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatRemaining = (mins: number) => {
    if (mins <= 0) return 'Completado';
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    return `${hrs}h ${m}m`;
  };

  const confidenceColors = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-500',
  };

  const confidenceLabels = {
    high: 'Alta confianza',
    medium: 'Confianza media',
    low: 'Poca data',
  };

  return (
    <div className="dashboard-card">
      <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-3">
        Estimacion de finalizacion
      </div>

      <AnimatePresence mode="wait">
        {estimatedTime && remainingMinutes !== null && remainingMinutes > 0 ? (
          <motion.div
            key={estimatedTime}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="font-mono text-3xl font-semibold text-azul mb-1">
              {formatTime(estimatedTime)}
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-sm text-gray-500">
                Faltan ~{formatRemaining(remainingMinutes)}
              </span>
              <span className={`font-mono text-[9px] px-2 py-0.5 rounded-full ${confidenceColors[confidence]}`}>
                {confidenceLabels[confidence]}
              </span>
            </div>
            {completionRate > 0 && (
              <div className="font-mono text-[10px] text-gray-400">
                Ritmo: {completionRate} guias/min
              </div>
            )}
          </motion.div>
        ) : remainingMinutes === 0 ? (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-2"
          >
            <div className="text-3xl mb-1">🎉</div>
            <div className="font-mono text-verde font-semibold">Dia completo</div>
          </motion.div>
        ) : (
          <motion.div
            key="no-data"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-4"
          >
            <div className="font-mono text-gray-400 text-sm">
              Se necesitan mas checks para estimar
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
