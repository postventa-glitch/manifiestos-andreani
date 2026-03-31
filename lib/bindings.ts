import { getRequestContext } from '@cloudflare/next-on-pages';

export function getKV(): KVNamespace {
  const { env } = getRequestContext();
  return (env as any).MANIFIESTOS_KV as KVNamespace;
}
