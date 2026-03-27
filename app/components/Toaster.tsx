'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="dark"
      toastOptions={{
        style: {
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '12px',
          background: '#18181b',
          border: '1px solid #27272a',
          color: '#fafafa',
        },
      }}
    />
  );
}
