export interface Guia {
  numero: string;
  paquetes: number;
  checked: boolean;
  checkedAt: string | null;
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
}

export interface TrackingEvent {
  fecha: string;
  estado: string;
  detalle: string;
  sucursal: string;
}
