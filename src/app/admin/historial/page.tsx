'use client'

import { useState, useEffect } from 'react'

interface DiaResumen {
  id: string
  fecha: string
  finalizado: boolean
  finalizadoAt: string | null
  manifiestos: number
  totalGuias: number
  guiasChecked: number
  porcentaje: number
}

interface DiaDetalle {
  id: string
  fecha: string
  finalizado: boolean
  manifiestos: {
    id: string
    numero: string
    sucursal: string
    subidoAt: string
    totalPaquetes: number
    guias: { id: string; numero: string; orden: number; checked: boolean; checkedAt: string | null }[]
  }[]
}

export default function HistorialPage() {
  const [dias, setDias] = useState<DiaResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DiaDetalle | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  useEffect(() => {
    fetch('/api/dias')
      .then((r) => r.json())
      .then(setDias)
      .finally(() => setLoading(false))
  }, [])

  const verDetalle = async (diaId: string) => {
    setLoadingDetalle(true)
    try {
      const res = await fetch(`/api/dias/${diaId}`)
      const data = await res.json()
      setSelected(data)
    } catch {
      alert('Error cargando detalle')
    } finally {
      setLoadingDetalle(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-acento border-t-transparent rounded-full mx-auto" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-azul mb-6">Historial de Días</h2>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Lista de dias */}
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-[#7a8fab] mb-3">
            Días registrados
          </div>
          {dias.length === 0 ? (
            <p className="text-sm text-gray-400 font-mono py-4 text-center">Sin registros</p>
          ) : (
            <div className="space-y-2">
              {dias.map((d) => (
                <button
                  key={d.id}
                  onClick={() => verDetalle(d.id)}
                  className={`w-full text-left border rounded-lg p-3 transition-colors hover:bg-gray-50 ${
                    selected?.id === d.id ? 'border-acento bg-blue-50' : 'border-[#c8d6e8]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm font-semibold">
                        {new Date(d.fecha).toLocaleDateString('es-AR', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        {d.manifiestos} manifiestos · {d.totalGuias} guías
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-sm font-bold ${
                          d.porcentaje === 100 ? 'text-verde' : 'text-orange-500'
                        }`}
                      >
                        {d.porcentaje}%
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          d.finalizado
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {d.finalizado ? 'Cerrado' : 'Activo'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalle */}
        <div>
          {loadingDetalle ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-6 h-6 border-3 border-acento border-t-transparent rounded-full mx-auto" />
            </div>
          ) : selected ? (
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-[#7a8fab] mb-3">
                Detalle — {new Date(selected.fecha).toLocaleDateString('es-AR')}
              </div>
              {selected.manifiestos.map((m) => (
                <div key={m.id} className="border border-[#c8d6e8] rounded-lg p-4 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-mono text-sm font-semibold text-azul">
                      {m.numero.replace('-CO', '')}
                      {m.numero.endsWith('-CO') && (
                        <span className="text-red-500 ml-2 text-xs">CARRY-OVER</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                      Subido {new Date(m.subidoAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {m.guias.map((g) => (
                      <div
                        key={g.id}
                        className={`flex items-center gap-2 text-xs font-mono py-1 px-2 rounded ${
                          g.checked ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        <span>{g.checked ? '✓' : '✗'}</span>
                        <span className={g.checked ? 'line-through opacity-60' : ''}>
                          {g.numero}
                        </span>
                        {g.checkedAt && (
                          <span className="ml-auto text-green-500">
                            {new Date(g.checkedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 text-sm font-mono">
              Seleccioná un día para ver el detalle
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
