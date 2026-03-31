export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getKV } from '@/lib/bindings';

export async function GET() {
  try {
    const kv = getKV();
    const raw = await kv.get('manifiestos-data', 'text');
    const dataSize = raw ? raw.length : 0;
    const data = raw ? JSON.parse(raw) : null;

    return NextResponse.json({
      status: 'ok',
      kvConnected: true,
      dataSize,
      manifiestos: data?.manifiestos?.length || 0,
      pending: data?.pendingFromYesterday?.length || 0,
      auditLog: data?.auditLog?.length || 0,
      history: data?.history?.length || 0,
      version: data?._version || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, kvConnected: false }, { status: 500 });
  }
}
