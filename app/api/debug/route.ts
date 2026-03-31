export const runtime = 'edge';

import { NextResponse } from 'next/server';

export async function GET() {
  const results: Record<string, any> = { timestamp: new Date().toISOString() };

  // Test 1: getRequestContext
  try {
    const mod = require('@cloudflare/next-on-pages');
    const ctx = mod.getRequestContext();
    results.method1_keys = Object.keys(ctx?.env || {});
    results.method1_hasKV = !!(ctx?.env as any)?.MANIFIESTOS_KV;
    if (results.method1_hasKV) {
      const kv = (ctx.env as any).MANIFIESTOS_KV;
      const data = await kv.get('manifiestos-data', 'text');
      results.method1_kv = data ? `data size: ${data.length}` : 'empty';
    }
  } catch (e: any) {
    results.method1_error = e.message;
  }

  // Test 2: process.env
  try {
    const kv = (process.env as any).MANIFIESTOS_KV;
    results.method2_type = typeof kv;
    results.method2_hasGet = kv && typeof kv.get === 'function';
  } catch (e: any) {
    results.method2_error = e.message;
  }

  // Test 3: globalThis
  try {
    const kv = (globalThis as any).MANIFIESTOS_KV;
    results.method3_type = typeof kv;
    results.method3_hasGet = kv && typeof kv.get === 'function';
  } catch (e: any) {
    results.method3_error = e.message;
  }

  return NextResponse.json(results);
}
