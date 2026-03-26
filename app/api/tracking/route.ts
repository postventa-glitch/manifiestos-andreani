import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const guia = request.nextUrl.searchParams.get('guia');
  if (!guia) {
    return NextResponse.json({ error: 'Falta numero de guia' }, { status: 400 });
  }

  // Try multiple Andreani API endpoints
  const endpoints = [
    `https://api.andreani.com/v1/envios/${guia}/trazas`,
    `https://api.andreani.com/v2/envios/${guia}/trazas`,
    `https://api.andreani.com/v1/envios/${guia}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ guia, tracking: data, source: 'api' });
      }
    } catch {
      // continue to next endpoint
    }
  }

  // Try scraping the tracking page
  try {
    const pageRes = await fetch(`https://www.andreani.com/envio/${guia}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/html',
      },
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      // Try to extract tracking data from the page
      const jsonMatch = html.match(/__NEXT_DATA__.*?<\/script>/s);
      if (jsonMatch) {
        try {
          const dataStr = jsonMatch[0].replace('__NEXT_DATA__', '').replace('</script>', '').replace(/^[^{]*/, '');
          const pageData = JSON.parse(dataStr);
          if (pageData?.props?.pageProps) {
            return NextResponse.json({
              guia,
              tracking: pageData.props.pageProps,
              source: 'scrape',
            });
          }
        } catch {
          // parsing failed
        }
      }
    }
  } catch {
    // scrape failed
  }

  // Fallback: return tracking URLs for the user
  return NextResponse.json({
    guia,
    tracking: null,
    trackingUrl: `https://www.andreani.com/envio/${guia}`,
    altUrls: [
      `https://www.andreani.com/#!/informacionEnvio/${guia}`,
      `https://www.andreani.com/envio/${guia}`,
    ],
    source: 'link',
  });
}
