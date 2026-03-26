import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Manifiestos de Carga — Andreani',
  description: 'Gestión de manifiestos de carga Andreani',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-[#eef2f8] min-h-screen">{children}</body>
    </html>
  )
}
