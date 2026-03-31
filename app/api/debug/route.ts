export const runtime = 'edge';

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Try to get bindings
    let kvInfo = 'not tested';
    let envKeys: string[] = [];
    let ctxError = '';

    try {
      const { getRequestContext } = await import('@cloudflare/next-on-pages');
      const ctx = getRequestContext();
      envKeys = Object.keys(ctx.env || {});
      const kv = (ctx.env as any).MANIFIESTOS_KV;
      if (kv) {
        const testRead = await kv.get('manifiestos-data', 'text');
        kvInfo = testRead ? `connected, data size: ${testRead.length}` : 'connected, no data';
      } else {
        kvInfo = 'binding not found';
      }
    } catch (e: any) {
      ctxError = e.message;
      kvInfo = 'context error';
    }

    return NextResponse.json({
      status: 'ok',
      kvInfo,
      envKeys,
      ctxError,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack?.substring(0, 500) }, { status: 500 });
  }
}
