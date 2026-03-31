interface CloudflareEnv {
  MANIFIESTOS_KV: KVNamespace;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined;
    }
  }
}
