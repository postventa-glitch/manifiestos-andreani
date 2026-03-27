'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      toastOptions={{
        style: {
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '12px',
        },
      }}
    />
  );
}
