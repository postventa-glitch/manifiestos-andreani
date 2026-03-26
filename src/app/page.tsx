'use client'

import { useEffect, useState, useCallback } from 'react'
import ManifestCard from '@/components/ManifestCard'
import ProgressBar from '@/components/ProgressBar'

interface Guia {
  id: string
  numero: string
  orden: number
  paquetes: number
  checked: boolean
  checkedAt: string | null
  carryOver: boolean
}

interface Manifiesto {
  id: string
  numero: string
  fecha: string
  sucursal: string
  direccion: string
  email: string
  telefono: string
  pesoTotal: number
  totalPaquetes: number
  subidoAt: string
  guias: Guia[]
}

interface DiaData {
  id: string
  fecha: string
  finalizado: boolean
}

export default function Home() {
  const [manifiestos, setManifiestos] = useState<Manifiesto[]>([])
  const [dia, setDia] = useState<DiaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/manifiestos')
      const data = await res.json()
      setManifiestos(data.manifiestos || [])
      setDia(data.dia)

      // Build checked set
      const ids = new Set<string>()
      for (const m of data.manifiestos || []) {
        for (const g of m.guias) {
          if (g.checked) ids.add(g.id)
        }
      }
      setCheckedIds(ids)
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Auto-refresh every 30s
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleGuiaToggle = (guiaId: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(guiaId)
      else next.delete(guiaId)
      return next
    })
  }

  const totalGuias = manifiestos.reduce((sum, m) => sum + m.guias.length, 0)
  const totalChecked = checkedIds.size

  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-azul border-t-transparent rounded-full mx-auto mb-3" />
          <p className="font-mono text-sm text-gray-500">Cargando manifiestos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 pb-16">
      {/* Topbar */}
      <div className="bg-azul text-white flex items-center justify-between px-7 py-3.5 rounded-t-[10px] max-w-[860px] mx-auto">
        <div className="font-mono text-[22px] font-semibold tracking-[3px]">ANDREANI</div>
        <div className="text-xs opacity-65 font-mono">Manifiestos de Carga · {today}</div>
      </div>

      {/* Progress */}
      <ProgressBar checked={totalChecked} total={totalGuias} />

      {/* Container */}
      <div className="max-w-[860px] mx-auto bg-white rounded-b-[10px] overflow-hidden shadow-[0_8px_40px_rgba(26,46,90,0.12)]">
        {manifiestos.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4 opacity-30">📦</div>
            <p className="font-mono text-sm text-gray-400">No hay manifiestos para hoy</p>
            <p className="text-xs text-gray-300 mt-2">
              Los manifiestos aparecerán aquí cuando se suban desde el panel de administración
            </p>
          </div>
        ) : (
          manifiestos.map((m) => (
            <ManifestCard key={m.id} manifiesto={m} onGuiaToggle={handleGuiaToggle} />
          ))
        )}
      </div>

      {dia && (
        <div className="max-w-[860px] mx-auto mt-2 text-right text-[10px] text-gray-400 font-mono">
          Día: {dia.id.slice(0, 8)} · Auto-refresh cada 30s
        </div>
      )}
    </div>
  )
}
