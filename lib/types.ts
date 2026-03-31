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

export type TrackingStatus = 'pendiente' | 'ingresado' | 'en_camino' | 'en_distribucion' | 'entregado' | 'no_entregado' | 'devuelto' | 'desconocido';

export interface GuiaTracking {
  guiaNumero: string;
  status: TrackingStatus;
  statusText: string;
  lastChecked: string;
  empresa?: string;
}
