import { getRequestContext } from '@cloudflare/next-on-pages';

export function getKV(): KVNamespace {
  try {
    const ctx = getRequestContext();
    const kv = (ctx.env as any).MANIFIESTOS_KV;
    if (!kv) {
      throw new Error('MANIFIESTOS_KV binding not found in env. Available: ' + Object.keys(ctx.env || {}).join(', '));
    }
    return kv as KVNamespace;
  } catch (e: any) {
    // Fallback: try global scope (Workers runtime)
    const globalKV = (globalThis as any).MANIFIESTOS_KV;
    if (globalKV) return globalKV as KVNamespace;

    // Fallback: try process.env (shouldn't work but try)
    const processKV = (process as any).env?.MANIFIESTOS_KV;
    if (processKV) return processKV as KVNamespace;

    throw new Error('KV binding not available: ' + e.message);
  }
}
