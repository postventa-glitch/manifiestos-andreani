export const runtime = 'edge';

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const results: Record<string, any> = { timestamp: new Date().toISOString() };

  // Test 1: getRequestContext (Pages-style)
  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages');
    const ctx = getRequestContext();
    results.m1_keys = Object.keys(ctx?.env || {});
    results.m1_hasKV = !!(ctx?.env as any)?.MANIFIESTOS_KV;
  } catch (e: any) {
    results.m1_err = e.message?.substring(0, 200);
  }

  // Test 2: process.env
  try {
    results.m2_keys = Object.keys(process.env).filter(k => k.includes('MANIF') || k.includes('KV'));
    results.m2_type = typeof (process.env as any).MANIFIESTOS_KV;
  } catch (e: any) {
    results.m2_err = e.message?.substring(0, 100);
  }

  // Test 3: globalThis
  try {
    results.m3_type = typeof (globalThis as any).MANIFIESTOS_KV;
    results.m3_envType = typeof (globalThis as any).__env__;
    if ((globalThis as any).__env__) {
      results.m3_envKeys = Object.keys((globalThis as any).__env__);
    }
  } catch (e: any) {
    results.m3_err = e.message?.substring(0, 100);
  }

  // Test 4: Check if there's a cf context on the request
  try {
    const cf = (request as any).cf;
    results.m4_hasCf = !!cf;
    results.m4_cfKeys = cf ? Object.keys(cf).slice(0, 5) : [];
  } catch (e: any) {
    results.m4_err = e.message?.substring(0, 100);
  }

  return NextResponse.json(results);
}
