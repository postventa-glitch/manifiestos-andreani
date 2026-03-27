import {
  linearRegression,
  linearRegressionLine,
  standardDeviation,
  mean,
  zScore,
} from 'simple-statistics';
import type {
  Manifiesto,
  DayRecord,
  AuditEntry,
  AnalyticsData,
  AnomalyResult,
  DayScore,
  PatternInsight,
  Suggestion,
  HeatmapCell,
  TrendPoint,
} from './types';

// ── Prediction: Estimated completion time ──

export function predictCompletionTime(
  manifiestos: Manifiesto[],
  pending: Manifiesto[]
): { estimatedCompletionTime: string | null; estimatedRemainingMinutes: number | null; completionRate: number; confidence: 'high' | 'medium' | 'low' } {
  const allManifiestos = [...pending, ...manifiestos];
  const totalGuias = allManifiestos.reduce((s, m) => s + m.guias.length, 0);
  const checkedGuias = allManifiestos.flatMap(m => m.guias.filter(g => g.checked && g.checkedAt));

  if (checkedGuias.length < 2 || totalGuias === 0) {
    return { estimatedCompletionTime: null, estimatedRemainingMinutes: null, completionRate: 0, confidence: 'low' };
  }

  if (checkedGuias.length === totalGuias) {
    return { estimatedCompletionTime: null, estimatedRemainingMinutes: 0, completionRate: 0, confidence: 'high' };
  }

  // Sort by checkedAt timestamp
  const sorted = checkedGuias
    .map(g => new Date(g.checkedAt!).getTime())
    .sort((a, b) => a - b);

  const startTime = sorted[0];
  // Create data points: [minutes since first check, cumulative count]
  const points: [number, number][] = sorted.map((t, i) => [
    (t - startTime) / 60000,
    i + 1,
  ]);

  try {
    const reg = linearRegression(points);
    const line = linearRegressionLine(reg);

    // Rate: guides per minute
    const rate = reg.m;
    if (rate <= 0) {
      return { estimatedCompletionTime: null, estimatedRemainingMinutes: null, completionRate: 0, confidence: 'low' };
    }

    const remaining = totalGuias - checkedGuias.length;
    const minutesNeeded = remaining / rate;
    const now = Date.now();
    const estimatedTime = new Date(now + minutesNeeded * 60000);

    // Confidence based on how much data we have
    const confidence = checkedGuias.length >= totalGuias * 0.5 ? 'high' :
      checkedGuias.length >= totalGuias * 0.2 ? 'medium' : 'low';

    return {
      estimatedCompletionTime: estimatedTime.toISOString(),
      estimatedRemainingMinutes: Math.round(minutesNeeded),
      completionRate: Math.round(rate * 100) / 100,
      confidence,
    };
  } catch {
    return { estimatedCompletionTime: null, estimatedRemainingMinutes: null, completionRate: 0, confidence: 'low' };
  }
}

// ── Anomaly Detection ──

export function detectAnomalies(
  manifiestos: Manifiesto[],
  pending: Manifiesto[],
  historicalAvgMinutes?: number,
  historicalStdDev?: number
): AnomalyResult[] {
  const now = Date.now();
  const allManifiestos = [...pending, ...manifiestos];

  // Calculate current day average check time from completed guides
  const checkTimes: number[] = [];
  for (const m of allManifiestos) {
    for (const g of m.guias) {
      if (g.checked && g.checkedAt) {
        const uploadTime = new Date(m.uploadedAt).getTime();
        const checkTime = new Date(g.checkedAt).getTime();
        checkTimes.push((checkTime - uploadTime) / 60000);
      }
    }
  }

  const avgMins = historicalAvgMinutes ?? (checkTimes.length > 0 ? mean(checkTimes) : 30);
  const stdDev = historicalStdDev ?? (checkTimes.length > 2 ? standardDeviation(checkTimes) : avgMins * 0.5);

  const anomalies: AnomalyResult[] = [];

  for (const m of allManifiestos) {
    for (const g of m.guias) {
      if (!g.checked) {
        const uploadTime = new Date(m.uploadedAt).getTime();
        const minutesElapsed = (now - uploadTime) / 60000;

        if (stdDev > 0) {
          const z = (minutesElapsed - avgMins) / stdDev;
          if (z > 1.5) {
            anomalies.push({
              guiaNumero: g.numero,
              manifiestoId: m.id,
              manifiestoNumero: m.numero,
              minutesElapsed: Math.round(minutesElapsed),
              zScore: Math.round(z * 10) / 10,
              severity: z > 2.5 ? 'critical' : 'warning',
            });
          }
        }
      }
    }
  }

  return anomalies.sort((a, b) => b.zScore - a.zScore);
}

// ── Day Score ──

export function scoreDayPerformance(
  manifiestos: Manifiesto[],
  pending: Manifiesto[],
  historicalAvgMinutes?: number
): DayScore {
  const allManifiestos = [...pending, ...manifiestos];
  const totalGuias = allManifiestos.reduce((s, m) => s + m.guias.length, 0);
  const checkedGuias = allManifiestos.reduce((s, m) => s + m.guias.filter(g => g.checked).length, 0);

  if (totalGuias === 0) {
    return { total: 0, completion: 0, speed: 0, anomalyRate: 100, consistency: 100 };
  }

  // Completion score (40%)
  const completion = Math.round((checkedGuias / totalGuias) * 100);

  // Speed score (30%) - based on average time vs historical
  const checkTimes: number[] = [];
  for (const m of allManifiestos) {
    for (const g of m.guias) {
      if (g.checked && g.checkedAt) {
        const diff = (new Date(g.checkedAt).getTime() - new Date(m.uploadedAt).getTime()) / 60000;
        checkTimes.push(diff);
      }
    }
  }

  let speed = 50;
  if (checkTimes.length > 0) {
    const avgTime = mean(checkTimes);
    const histAvg = historicalAvgMinutes || 60;
    speed = Math.min(100, Math.max(0, Math.round(100 - (avgTime / histAvg) * 50)));
  }

  // Anomaly rate (20%) - fewer anomalies = higher score
  const anomalies = detectAnomalies(manifiestos, pending, historicalAvgMinutes);
  const uncheckedCount = totalGuias - checkedGuias;
  const anomalyRate = uncheckedCount > 0
    ? Math.round(100 - (anomalies.length / uncheckedCount) * 100)
    : 100;

  // Consistency (10%) - lower std dev = higher score
  let consistency = 50;
  if (checkTimes.length > 2) {
    const std = standardDeviation(checkTimes);
    const avg = mean(checkTimes);
    const cv = avg > 0 ? std / avg : 1; // coefficient of variation
    consistency = Math.min(100, Math.max(0, Math.round(100 - cv * 100)));
  }

  const total = Math.round(
    completion * 0.4 + speed * 0.3 + anomalyRate * 0.2 + consistency * 0.1
  );

  return { total, completion, speed, anomalyRate, consistency };
}

// ── Pattern Recognition ──

export function identifyPatterns(history: DayRecord[]): PatternInsight[] {
  const insights: PatternInsight[] = [];

  if (history.length < 3) {
    return [{ type: 'volume_trend', message: 'Se necesitan al menos 3 dias finalizados para detectar patrones', data: {} }];
  }

  // Weekday analysis
  const weekdayStats: Record<number, { count: number; totalRate: number; totalTime: number }> = {};
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

  for (const day of history) {
    const date = parseDate(day.date);
    if (!date) continue;
    const wd = date.getDay();
    if (!weekdayStats[wd]) weekdayStats[wd] = { count: 0, totalRate: 0, totalTime: 0 };
    weekdayStats[wd].count++;
    weekdayStats[wd].totalRate += day.totalGuias > 0 ? day.completedGuias / day.totalGuias : 0;
  }

  // Find best and worst days
  const avgRates = Object.entries(weekdayStats)
    .map(([wd, stats]) => ({ wd: parseInt(wd), avgRate: stats.totalRate / stats.count }))
    .sort((a, b) => b.avgRate - a.avgRate);

  if (avgRates.length >= 2) {
    const best = avgRates[0];
    const worst = avgRates[avgRates.length - 1];
    if (best.avgRate - worst.avgRate > 0.1) {
      insights.push({
        type: 'weekday_trend',
        message: `${dayNames[best.wd]} es el dia mas eficiente (${Math.round(best.avgRate * 100)}% completitud). ${dayNames[worst.wd]} es el mas lento (${Math.round(worst.avgRate * 100)}%).`,
        data: { best: dayNames[best.wd], worst: dayNames[worst.wd] },
      });
    }
  }

  // Volume trend
  if (history.length >= 5) {
    const recent = history.slice(-5);
    const older = history.slice(-10, -5);
    if (older.length > 0) {
      const recentAvg = mean(recent.map(d => d.totalGuias));
      const olderAvg = mean(older.map(d => d.totalGuias));
      const change = ((recentAvg - olderAvg) / olderAvg) * 100;
      if (Math.abs(change) > 10) {
        insights.push({
          type: 'volume_trend',
          message: `El volumen de guias ${change > 0 ? 'aumento' : 'disminuyo'} ${Math.abs(Math.round(change))}% en los ultimos 5 dias.`,
          data: { change: Math.round(change) },
        });
      }
    }
  }

  // Speed trend
  const rates = history.map(d => d.totalGuias > 0 ? d.completedGuias / d.totalGuias : 0);
  if (rates.length >= 5) {
    const recent = mean(rates.slice(-3));
    const overall = mean(rates);
    if (recent > overall + 0.05) {
      insights.push({ type: 'speed_trend', message: 'La eficiencia esta mejorando en los ultimos dias', data: {} });
    } else if (recent < overall - 0.05) {
      insights.push({ type: 'speed_trend', message: 'La eficiencia bajo en los ultimos dias, revisar posibles cuellos de botella', data: {} });
    }
  }

  return insights;
}

// ── Suggestions ──

export function generateSuggestions(
  manifiestos: Manifiesto[],
  pending: Manifiesto[],
  anomalies: AnomalyResult[],
  score: DayScore,
  patterns: PatternInsight[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const allManifiestos = [...pending, ...manifiestos];

  // Suggestion based on pending from yesterday
  if (pending.length > 0) {
    const pendingGuias = pending.reduce((s, m) => s + m.guias.filter(g => !g.checked).length, 0);
    suggestions.push({
      icon: '⚡',
      title: 'Priorizar pendientes de ayer',
      description: `Hay ${pendingGuias} guias pendientes del dia anterior. Completarlas primero evita acumulacion.`,
      priority: 'high',
    });
  }

  // Suggestion based on anomalies
  const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
  if (criticalAnomalies.length > 0) {
    suggestions.push({
      icon: '🚨',
      title: 'Guias con demora critica',
      description: `${criticalAnomalies.length} guia(s) llevan mucho mas tiempo del esperado. Verificar si hay algun problema.`,
      priority: 'high',
    });
  }

  // Suggestion based on score
  if (score.speed < 40) {
    suggestions.push({
      icon: '🏃',
      title: 'Ritmo por debajo del promedio',
      description: 'El tiempo de empaquetado esta siendo mas lento que lo habitual. Considerar redistribuir recursos.',
      priority: 'medium',
    });
  }

  // Suggestion based on completion
  const totalGuias = allManifiestos.reduce((s, m) => s + m.guias.length, 0);
  const checkedGuias = allManifiestos.reduce((s, m) => s + m.guias.filter(g => g.checked).length, 0);
  const now = new Date();
  if (now.getHours() >= 15 && totalGuias > 0 && checkedGuias / totalGuias < 0.5) {
    suggestions.push({
      icon: '⏰',
      title: 'Riesgo de no completar hoy',
      description: 'Son mas de las 15hs y queda mas de la mitad pendiente. Considerar reforzar el equipo.',
      priority: 'high',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      icon: '✅',
      title: 'Todo en orden',
      description: 'El progreso del dia esta dentro de los parametros normales.',
      priority: 'low',
    });
  }

  return suggestions;
}

// ── Heatmap Data ──

export function computeHeatmap(history: DayRecord[]): HeatmapCell[] {
  const cells: Map<string, number> = new Map();

  for (const day of history) {
    const date = parseDate(day.date);
    if (!date) continue;
    const dayOfWeek = (date.getDay() + 6) % 7; // 0=Lunes

    for (const m of day.manifiestos) {
      for (const g of m.guias) {
        if (g.checked && g.checkedAt) {
          const hour = new Date(g.checkedAt).getHours();
          const key = `${dayOfWeek}-${hour}`;
          cells.set(key, (cells.get(key) || 0) + 1);
        }
      }
    }
  }

  const result: HeatmapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 6; hour < 22; hour++) {
      result.push({
        day,
        hour,
        value: cells.get(`${day}-${hour}`) || 0,
      });
    }
  }

  return result;
}

// ── Trend Data ──

export function computeTrends(history: DayRecord[]): TrendPoint[] {
  return history.slice(-30).map(day => {
    const rate = day.totalGuias > 0 ? Math.round((day.completedGuias / day.totalGuias) * 100) : 0;

    // Avg time
    const times: number[] = [];
    for (const m of day.manifiestos) {
      for (const g of m.guias) {
        if (g.checked && g.checkedAt) {
          times.push((new Date(g.checkedAt).getTime() - new Date(m.uploadedAt).getTime()) / 60000);
        }
      }
    }

    const avgTime = times.length > 0 ? Math.round(mean(times)) : 0;
    const score = scoreDayPerformance(day.manifiestos, []);

    return {
      date: day.date,
      completionRate: rate,
      avgTimeMinutes: avgTime,
      score: score.total,
      totalGuias: day.totalGuias,
    };
  });
}

// ── Helpers ──

function parseDate(dateStr: string): Date | null {
  // Parse dd/mm/yyyy format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return null;
}
