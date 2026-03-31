export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { saveTracking, saveBulkTracking, getAllTracking } from '@/lib/store';
import { getKV } from '@/lib/bindings';
import type { GuiaTracking, TrackingStatus } from '@/lib/types';

// GET: fetch tracking for a guia or return all stored
export async function GET(request: NextRequest) {
  const kv = getKV();
  const guia = request.nextUrl.searchParams.get('guia');
  const all = request.nextUrl.searchParams.get('all');
  const proxy = request.nextUrl.searchParams.get('proxy');

  // Return all stored tracking data
  if (all === '1') {
    const trackings = await getAllTracking(kv);
    return NextResponse.json({ trackings });
  }

  // Proxy mode: fetch andreani page HTML and return it for client-side parsing
  if (proxy === '1' && guia) {
    try {
      const res = await fetch(`https://www.andreani.com/envio/${guia}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-AR,es;q=0.9',
        },
      });
      const html = await res.text();
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    } catch {
      return NextResponse.json({ error: 'Failed to proxy' }, { status: 502 });
    }
  }

  if (!guia) {
    return NextResponse.json({ error: 'Falta numero de guia' }, { status: 400 });
  }

  // Return stored tracking if available
  const trackings = await getAllTracking(kv);
  const stored = trackings.find(t => t.guiaNumero === guia);
  return NextResponse.json({
    guia,
    stored: stored || null,
    trackingUrl: `https://www.andreani.com/#!/informacionEnvio/${guia}`,
  });
}

// POST: save tracking results (called from client after parsing)
export async function POST(request: NextRequest) {
  const kv = getKV();
  const body = await request.json();

  // Single save
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

  // Bulk save
  if (body.trackings && Array.isArray(body.trackings)) {
    const items: GuiaTracking[] = body.trackings.map((t: any) => ({
      guiaNumero: t.guiaNumero,
      status: t.status || 'desconocido',
      statusText: t.statusText || 'Desconocido',
      lastChecked: new Date().toISOString(),
      empresa: t.empresa,
      timeline: t.timeline,
    }));
    await saveBulkTracking(kv, items);
    return NextResponse.json({ saved: true, count: items.length });
  }

  return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
}
