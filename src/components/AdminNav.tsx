'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { label: 'Manifiestos', href: '' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Tracking', href: '/tracking' },
  { label: 'Historial', href: '/historial' },
]

export default function AdminNav({ basePath }: { basePath: string }) {
  const pathname = usePathname()

  return (
    <div className="bg-azul text-white max-w-[1000px] mx-auto rounded-t-[10px] px-6 pt-4 pb-0">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-xl font-semibold tracking-[3px]">ANDREANI</div>
        <div className="text-xs opacity-65 font-mono">Panel de Administración</div>
      </div>
      <div className="flex gap-1">
        {tabs.map((tab) => {
          const href = `${basePath}${tab.href}`
          const isActive = pathname === href || (tab.href === '' && pathname === basePath)
          return (
            <Link
              key={tab.href}
              href={href}
              className={`px-4 py-2 text-sm font-mono rounded-t-lg transition-colors ${
                isActive
                  ? 'bg-white text-azul font-semibold'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
