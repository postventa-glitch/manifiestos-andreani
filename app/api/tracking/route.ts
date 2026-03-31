export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { saveTracking, saveBulkTracking, getAllTracking } from '@/lib/store';
import { getKV } from '@/lib/bindings';
import type { GuiaTracking, TrackingStatus, TimelineStep } from '@/lib/types';

const ENVIA_API = 'https://queries.envia.com/shipments/generaltrack?is_landing=true';

function mapStatus(enviaStatus: string, events: any[]): { status: TrackingStatus; statusText: string } {
  const s = (enviaStatus || '').toLowerCase();
  const lastEvent = events?.[events.length - 1]?.description?.toLowerCase() || '';

  if (s === 'delivered' || lastEvent.includes('entregado')) return { status: 'entregado', statusText: 'Entregado' };
  if (s === 'returned' || lastEvent.includes('devuel')) return { status: 'devuelto', statusText: 'Devuelto' };
  if (s === 'exception' || lastEvent.includes('no entregado')) return { status: 'no_entregado', statusText: 'No entregado' };
  if (s === 'shipped' || s === 'in_transit' || lastEvent.includes('viaje') || lastEvent.includes('salida')) return { status: 'en_camino', statusText: 'En camino' };
  if (lastEvent.includes('sucursal') && !lastEvent.includes('salida')) return { status: 'en_camino', statusText: 'En sucursal' };
  if (s === 'information_received' || lastEvent.includes('ingreso') || lastEvent.includes('circuito')) return { status: 'ingresado', statusText: 'Ingresado' };
  if (s === 'pending' || lastEvent.includes('pendiente')) return { status: 'pendiente', statusText: 'Pendiente de ingreso' };
  return { status: 'desconocido', statusText: enviaStatus || 'Desconocido' };
}

function buildTimeline(events: any[]): TimelineStep[] {
  const steps: TimelineStep[] = [
    { label: 'Pendiente de ingreso', date: null, done: false },
    { label: 'Ingresado', date: null, done: false },
    { label: 'En camino', date: null, done: false },
    { label: 'En sucursal', date: null, done: false },
    { label: 'Entregado', date: null, done: false },
  ];

  if (!events || events.length === 0) return steps;

  for (const ev of events) {
    const desc = (ev.description || '').toLowerCase();
    const date = ev.date ? ev.date.split(' ')[0] : null; // YYYY-MM-DD
    const formatted = date ? date.split('-').reverse().join('-') : null; // DD-MM-YYYY

    if (desc.includes('pendiente') || desc.includes('ingresado al sistema')) {
      steps[0].done = true;
      if (!steps[0].date) steps[0].date = formatted;
    }
    if (desc.includes('ingreso al circuito') || desc.includes('ingresado') || desc.includes('recibido')) {
      steps[0].done = true;
      steps[1].done = true;
      if (!steps[1].date) steps[1].date = formatted;
    }
    if (desc.includes('viaje') || desc.includes('salida') || desc.includes('tránsito') || desc.includes('transito')) {
      steps[0].done = true;
      steps[1].done = true;
      steps[2].done = true;
      if (!steps[2].date) steps[2].date = formatted;
    }
    if (desc.includes('sucursal') && !desc.includes('salida')) {
      steps[0].done = true;
      steps[1].done = true;
      steps[2].done = true;
      steps[3].done = true;
      if (!steps[3].date) steps[3].date = formatted;
    }
    if (desc.includes('entregado') || desc.includes('delivered')) {
      steps[0].done = true;
      steps[1].done = true;
      steps[2].done = true;
      steps[3].done = true;
      steps[4].done = true;
      if (!steps[4].date) steps[4].date = formatted;
    }
  }

  return steps;
}

async function fetchFromEnvia(guias: string[]): Promise<GuiaTracking[]> {
  const res = await fetch(ENVIA_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Origin': 'https://envia.com',
      'Referer': 'https://envia.com/',
      'Accept-Language': 'es-AR',
    },
    body: JSON.stringify({ trackingNumbers: guias }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data.map((item: any) => {
    const events = item.eventHistory || [];
    const { status, statusText } = mapStatus(item.parentStatus || item.status, events);
    const timeline = buildTimeline(events);

    return {
      guiaNumero: item.trackingNumber,
      status,
      statusText,
      lastChecked: new Date().toISOString(),
      empresa: item.company || item.companyInfo?.name,
      timeline,
    } as GuiaTracking;
  });
}

// GET: single guia or all stored tracking data
export async function GET(request: NextRequest) {
  const kv = getKV();
  const guia = request.nextUrl.searchParams.get('guia');
  const all = request.nextUrl.searchParams.get('all');

  if (all === '1') {
    const trackings = await getAllTracking(kv);
    return NextResponse.json({ trackings });
  }

  if (!guia) {
    return NextResponse.json({ error: 'Falta numero de guia' }, { status: 400 });
  }

  // Fetch from envia.com API
  const results = await fetchFromEnvia([guia]);
  if (results.length > 0) {
    await saveTracking(kv, results[0]);
    return NextResponse.json({ ...results[0], source: 'envia' });
  }

  // Fallback: return stored data
  const trackings = await getAllTracking(kv);
  const stored = trackings.find(t => t.guiaNumero === guia);
  return NextResponse.json({
    guia,
    stored: stored || null,
    status: 'desconocido',
    statusText: 'No encontrado en envia.com',
    trackingUrl: `https://envia.com/tracking?label=${guia}`,
  });
}

// POST: save manual status or bulk scan
export async function POST(request: NextRequest) {
  const kv = getKV();
  const body = await request.json();

  // Bulk scan via envia.com API
  if (body.guias && Array.isArray(body.guias)) {
    const allResults: GuiaTracking[] = [];
    // envia.com can handle batches, but let's chunk to 20
    const chunks: string[][] = [];
    for (let i = 0; i < body.guias.length; i += 20) {
      chunks.push(body.guias.slice(i, i + 20));
    }
    for (const chunk of chunks) {
      const results = await fetchFromEnvia(chunk);
      allResults.push(...results);
    }
    if (allResults.length > 0) {
      await saveBulkTracking(kv, allResults);
    }
    return NextResponse.json({ results: allResults, scanned: allResults.length, total: body.guias.length });
  }

  // Manual status save
  if (body.guiaNumero) {
    const tracking: GuiaTracking = {
      guiaNumero: body.guiaNumero,
      status: body.status || 'desconocido',
      statusText: body.statusText || 'Desconocido',
      lastChecked: new Date().toISOString(),
      empresa: body.empresa,
      timeline: body.timeline,
    };
    await saveTracking(kv, tracking);
    return NextResponse.json({ saved: true, tracking });
  }

  return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
}
