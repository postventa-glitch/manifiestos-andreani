'use client'

import { useState, useEffect } from 'react'

interface DashboardData {
  hoy: {
    totalGuias: number
    guiasChecked: number
    porcentaje: number
    manifiestos: number
    tiempoEmpaquetadoPromedio: number
    diaId: string | null
  }
  historico: {
    id: string
    fecha: string
    totalGuias: number
    guiasChecked: number
    porcentaje: number
    manifiestos: number
    tiempoPromedio: number
  }[]
}

function formatTime(ms: number): string {
  if (!ms || ms <= 0) return '—'
  const mins = Math.floor(ms / 60000)
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  if (hours > 0) return `${hours}h ${rem}m`
  return `${mins}m`
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-acento border-t-transparent rounded-full mx-auto" />
      </div>
    )
  }

  if (!data) return <div className="p-8 text-center text-gray-400">Error cargando datos</div>

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-azul mb-6">Dashboard & KPIs</h2>

      {/* KPI Cards - Hoy */}
      <div className="text-xs font-mono uppercase tracking-wider text-[#7a8fab] mb-3">
        Día Activo
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-azul-claro rounded-xl p-4">
          <div className="text-[10px] font-mono uppercase text-[#7a8fab] tracking-wide">Manifiestos</div>
          <div className="font-mono text-3xl font-bold text-azul mt-1">{data.hoy.manifiestos}</div>
        </div>
        <div className="bg-azul-claro rounded-xl p-4">
          <div className="text-[10px] font-mono uppercase text-[#7a8fab] tracking-wide">Guías Totales</div>
          <div className="font-mono text-3xl font-bold text-azul mt-1">{data.hoy.totalGuias}</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <div className="text-[10px] font-mono uppercase text-green-600 tracking-wide">Completadas</div>
          <div className="font-mono text-3xl font-bold text-green-700 mt-1">
            {data.hoy.porcentaje}%
          </div>
          <div className="text-xs text-green-600 font-mono">
            {data.hoy.guiasChecked}/{data.hoy.totalGuias}
          </div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <div className="text-[10px] font-mono uppercase text-purple-600 tracking-wide">
            Tiempo Prom. Empaquetado
          </div>
          <div className="font-mono text-3xl font-bold text-purple-700 mt-1">
            {formatTime(data.hoy.tiempoEmpaquetadoPromedio)}
          </div>
        </div>
      </div>

      {/* Barra de progreso grande */}
      <div className="mb-8">
        <div className="flex justify-between text-xs font-mono text-gray-500 mb-1">
          <span>Progreso del día</span>
          <span>{data.hoy.porcentaje}%</span>
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              data.hoy.porcentaje === 100 ? 'bg-verde' : 'bg-acento'
            }`}
            style={{ width: `${data.hoy.porcentaje}%` }}
          />
        </div>
      </div>

      {/* Historico */}
      <div className="text-xs font-mono uppercase tracking-wider text-[#7a8fab] mb-3">
        Histórico (últimos 30 días)
      </div>
      {data.historico.length === 0 ? (
        <p className="text-sm text-gray-400 font-mono py-4 text-center">Sin datos históricos</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-azul text-white">
              <th className="py-2 px-3 text-left font-mono text-[10px] uppercase tracking-wider">Fecha</th>
              <th className="py-2 px-3 text-center font-mono text-[10px] uppercase tracking-wider">Manifiestos</th>
              <th className="py-2 px-3 text-center font-mono text-[10px] uppercase tracking-wider">Guías</th>
              <th className="py-2 px-3 text-center font-mono text-[10px] uppercase tracking-wider">Completadas</th>
              <th className="py-2 px-3 text-center font-mono text-[10px] uppercase tracking-wider">%</th>
              <th className="py-2 px-3 text-center font-mono text-[10px] uppercase tracking-wider">Tiempo Prom.</th>
            </tr>
          </thead>
          <tbody>
            {data.historico.map((d) => (
              <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2.5 px-3 font-mono text-xs">
                  {new Date(d.fecha).toLocaleDateString('es-AR')}
                </td>
                <td className="py-2.5 px-3 text-center">{d.manifiestos}</td>
                <td className="py-2.5 px-3 text-center">{d.totalGuias}</td>
                <td className="py-2.5 px-3 text-center">{d.guiasChecked}</td>
                <td className="py-2.5 px-3 text-center">
                  <span
                    className={`font-mono font-semibold ${
                      d.porcentaje === 100 ? 'text-verde' : 'text-orange-500'
                    }`}
                  >
                    {d.porcentaje}%
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-xs">
                  {formatTime(d.tiempoPromedio)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
