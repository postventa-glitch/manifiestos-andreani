export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { saveTracking, saveBulkTracking, getAllTracking } from '@/lib/store';
import { getKV } from '@/lib/bindings';
import type { GuiaTracking, TrackingStatus } from '@/lib/types';

function parseStatus(text: string): { status: TrackingStatus; statusText: string } {
  const lower = text.toLowerCase();
  if (lower.includes('entregado') && !lower.includes('no entregado')) return { status: 'entregado', statusText: 'Entregado' };
  if (lower.includes('no entregado')) return { status: 'no_entregado', statusText: 'No entregado' };
  if (lower.includes('devuelto') || lower.includes('devoluc')) return { status: 'devuelto', statusText: 'Devuelto' };
  if (lower.includes('en distribuci')) return { status: 'en_distribucion', statusText: 'En distribución' };
  if (lower.includes('en camino') || lower.includes('en tránsito') || lower.includes('en transito')) return { status: 'en_camino', statusText: 'En camino' };
  if (lower.includes('en sucursal')) return { status: 'en_camino', statusText: 'En sucursal' };
  if (lower.includes('ingresado') || lower.includes('recibido')) return { status: 'ingresado', statusText: 'Ingresado' };
  if (lower.includes('pendiente')) return { status: 'pendiente', statusText: 'Pendiente de ingreso' };
  return { status: 'desconocido', statusText: text.substring(0, 50) || 'Desconocido' };
}

async function scrapeAndreani(guia: string): Promise<{ status: TrackingStatus; statusText: string; empresa?: string }> {
  try {
    const res = await fetch(`https://www.andreani.com/envio/${guia}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return { status: 'desconocido', statusText: 'Error HTTP ' + res.status };
    const html = await res.text();

    // Try __NEXT_DATA__ first
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const pageData = JSON.parse(nextDataMatch[1]);
        const props = pageData?.props?.pageProps;
        if (props?.estado) {
          return parseStatus(props.estado);
        }
        if (props?.envio?.estado) {
          return parseStatus(props.envio.estado);
        }
      } catch {}
    }

    // Parse meta/title for status keywords
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaMatch = html.match(/<meta[^>]*content="([^"]*(?:entregado|camino|ingresado|pendiente|distribuci)[^"]*)"/i);
    const statusSource = metaMatch?.[1] || titleMatch?.[1] || '';

    // Look for status in visible text patterns in HTML
    const statusPatterns = [
      /(?:Pendiente de ingreso)/i,
      /(?:Ingresado)/i,
      /(?:En camino)/i,
      /(?:En tránsito)/i,
      /(?:En distribuci[oó]n)/i,
      /(?:Entregado)/i,
      /(?:No entregado)/i,
      /(?:Devuelto)/i,
      /(?:En sucursal)/i,
    ];

    for (const pattern of statusPatterns) {
      const match = html.match(pattern);
      if (match) {
        const parsed = parseStatus(match[0]);
        // Try to find empresa
        const empresaMatch = html.match(/Env[ií]o de\s+([A-Z\s.]+(?:S\.?A\.?|S\.?R\.?L\.?|S\.?A\.?S\.?))/i);
        return { ...parsed, empresa: empresaMatch?.[1]?.trim() };
      }
    }

    if (statusSource) {
      return parseStatus(statusSource);
    }

    return { status: 'desconocido', statusText: 'No se pudo determinar' };
  } catch {
    return { status: 'desconocido', statusText: 'Error de conexión' };
  }
}

// GET single guia or all tracking data
export async function GET(request: NextRequest) {
  const kv = getKV();
  const guia = request.nextUrl.searchParams.get('guia');
  const all = request.nextUrl.searchParams.get('all');

  // Return all stored tracking data
  if (all === '1') {
    const trackings = await getAllTracking(kv);
    return NextResponse.json({ trackings });
  }

  if (!guia) {
    return NextResponse.json({ error: 'Falta numero de guia' }, { status: 400 });
  }

  // Scrape Andreani
  const result = await scrapeAndreani(guia);

  // Save to KV
  const tracking: GuiaTracking = {
    guiaNumero: guia,
    status: result.status,
    statusText: result.statusText,
    lastChecked: new Date().toISOString(),
    empresa: result.empresa,
  };
  await saveTracking(kv, tracking);

  return NextResponse.json({
    guia,
    ...result,
    trackingUrl: `https://www.andreani.com/#!/informacionEnvio/${guia}`,
    saved: true,
  });
}

// POST: bulk scan multiple guias
export async function POST(request: NextRequest) {
  const kv = getKV();
  const { guias } = await request.json() as { guias: string[] };

  if (!guias || guias.length === 0) {
    return NextResponse.json({ error: 'No guias provided' }, { status: 400 });
  }

  // Limit to 10 at a time to avoid timeout
  const batch = guias.slice(0, 10);
  const results: GuiaTracking[] = [];

  for (const guia of batch) {
    const result = await scrapeAndreani(guia);
    results.push({
      guiaNumero: guia,
      status: result.status,
      statusText: result.statusText,
      lastChecked: new Date().toISOString(),
      empresa: result.empresa,
    });
  }

  await saveBulkTracking(kv, results);

  return NextResponse.json({ results, scanned: results.length, total: guias.length });
}
