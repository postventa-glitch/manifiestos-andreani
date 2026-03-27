import { NextResponse } from 'next/server';
import { getAll, getHistory } from '@/lib/store';
import {
  predictCompletionTime,
  detectAnomalies,
  scoreDayPerformance,
  identifyPatterns,
  generateSuggestions,
  computeHeatmap,
  computeTrends,
} from '@/lib/analytics';
import { mean, standardDeviation } from 'simple-statistics';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [current, history] = await Promise.all([
      getAll(),
      getHistory(),
    ]);

    const { manifiestos, pending } = current;

    // Calculate historical averages from past days
    const historicalCheckTimes: number[] = [];
    for (const day of history) {
      for (const m of day.manifiestos) {
        for (const g of m.guias) {
          if (g.checked && g.checkedAt) {
            const diff = (new Date(g.checkedAt).getTime() - new Date(m.uploadedAt).getTime()) / 60000;
            if (diff > 0 && diff < 1440) { // max 24 hours
              historicalCheckTimes.push(diff);
            }
          }
        }
      }
    }

    const historicalAvg = historicalCheckTimes.length > 0 ? mean(historicalCheckTimes) : undefined;
    const historicalStd = historicalCheckTimes.length > 2 ? standardDeviation(historicalCheckTimes) : undefined;

    // Compute all analytics
    const predictions = predictCompletionTime(manifiestos, pending);
    const anomalies = detectAnomalies(manifiestos, pending, historicalAvg, historicalStd);
    const score = scoreDayPerformance(manifiestos, pending, historicalAvg);
    const patterns = identifyPatterns(history);
    const suggestions = generateSuggestions(manifiestos, pending, anomalies, score, patterns);
    const heatmapData = computeHeatmap(history);
    const trendData = computeTrends(history);

    return NextResponse.json({
      predictions,
      anomalies,
      score,
      patterns,
      suggestions,
      heatmapData,
      trendData,
      computedAt: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 's-maxage=15, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error computing analytics' }, { status: 500 });
  }
}
