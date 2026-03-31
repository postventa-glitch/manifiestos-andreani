export function getKV(): KVNamespace {
  // Method 1: @cloudflare/next-on-pages context (Pages deployment)
  try {
    const { getRequestContext } = require('@cloudflare/next-on-pages');
    const ctx = getRequestContext();
    if (ctx?.env?.MANIFIESTOS_KV) {
      return ctx.env.MANIFIESTOS_KV as KVNamespace;
    }
  } catch {}

  // Method 2: process.env (Workers deployment with nodejs_compat)
  try {
    const kv = (process.env as any).MANIFIESTOS_KV;
    if (kv && typeof kv.get === 'function') return kv as KVNamespace;
  } catch {}

  // Method 3: globalThis (Workers global bindings)
  try {
    const kv = (globalThis as any).MANIFIESTOS_KV;
    if (kv && typeof kv.get === 'function') return kv as KVNamespace;
  } catch {}

  // Method 4: Try dynamic import
  throw new Error(
    'MANIFIESTOS_KV not found. Tried: getRequestContext, process.env, globalThis'
  );
}
