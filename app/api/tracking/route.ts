import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const guia = request.nextUrl.searchParams.get('guia');
  if (!guia) {
    return NextResponse.json({ error: 'Falta numero de guia' }, { status: 400 });
  }

  try {
    // Try Andreani's public tracking API
    const res = await fetch(
      `https://api.andreani.com/v2/envios/${guia}/trazas`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ guia, tracking: data, source: 'api' });
    }

    // Fallback: return link to tracking page
    return NextResponse.json({
      guia,
      tracking: null,
      trackingUrl: `https://www.andreani.com/envio/${guia}`,
      source: 'link',
    });
  } catch {
    return NextResponse.json({
      guia,
      tracking: null,
      trackingUrl: `https://www.andreani.com/envio/${guia}`,
      source: 'link',
    });
  }
}
