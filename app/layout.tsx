import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/app/components/Toaster';

export const metadata: Metadata = {
  title: 'Manifiestos Andreani',
  description: 'Sistema de control de manifiestos de carga Andreani',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
