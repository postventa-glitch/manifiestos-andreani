export interface Guia {
  numero: string;
  paquetes: number;
  checked: boolean;
  checkedAt: string | null;
}

export interface AuditEntry {
  guiaNumero: string;
  manifiestoId: string;
  action: 'checked' | 'unchecked' | 'deleted';
  timestamp: string;
  detail?: string;
}

export interface Manifiesto {
  id: string;
  numero: string;
  fecha: string;
  sucursal: string;
  direccion: string;
  email: string;
  telefono: string;
  guias: Guia[];
  pesoTotal: string;
  totalPaquetes: number;
  uploadedAt: string;
}

export interface DayRecord {
  date: string;
  manifiestos: Manifiesto[];
  finalizedAt: string;
  totalGuias: number;
  completedGuias: number;
  auditLog: AuditEntry[];
}

export interface TrackingEvent {
  fecha: string;
  estado: string;
  detalle: string;
  sucursal: string;
}

// ── SSE Event Types ──

export interface SSEEvent {
  id: string;
  type: 'guia_checked' | 'guia_unchecked' | 'manifest_added' | 'manifest_deleted' | 'day_finalized' | 'state_sync';
  payload: any;
  timestamp: string;
}

// ── Analytics Types ──

export interface AnalyticsData {
  predictions: {
    estimatedCompletionTime: string | null;
    estimatedRemainingMinutes: number | null;
    completionRate: number; // guides per minute
    confidence: 'high' | 'medium' | 'low';
  };
  anomalies: AnomalyResult[];
  score: DayScore;
  patterns: PatternInsight[];
  suggestions: Suggestion[];
  heatmapData: HeatmapCell[];
  trendData: TrendPoint[];
  computedAt: string;
}

export interface AnomalyResult {
  guiaNumero: string;
  manifiestoId: string;
  manifiestoNumero: string;
  minutesElapsed: number;
  zScore: number;
  severity: 'warning' | 'critical';
}

export interface DayScore {
  total: number; // 0-100
  completion: number;
  speed: number;
  anomalyRate: number;
  consistency: number;
}

export interface PatternInsight {
  type: 'weekday_trend' | 'hour_peak' | 'speed_trend' | 'volume_trend';
  message: string;
  data: any;
}

export interface Suggestion {
  icon: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface HeatmapCell {
  day: number; // 0=Lunes ... 6=Domingo
  hour: number; // 0-23
  value: number; // count of checks
}

export interface TrendPoint {
  date: string;
  completionRate: number;
  avgTimeMinutes: number;
  score: number;
  totalGuias: number;
}
