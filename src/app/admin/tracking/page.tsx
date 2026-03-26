'use client'

import { useState, useEffect } from 'react'

interface TrackingEvent {
  fecha: string
  hora: string
  estado: string
  detalle: string
  sucursal: string
}

interface TrackingResult {
  guia: string
  eventos: TrackingEvent[]
  estadoActual: string
  error?: string
}

interface GuiaInfo {
  id: string
  numero: string
  checked: boolean
  checkedAt: string | null
  manifiesto: { numero: string; subidoAt: string }
}

export default function TrackingPage() {
  const [guiaInput, setGuiaInput] = useState('')
  const [tracking, setTracking] = useState<TrackingResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [allGuias, setAllGuias] = useState<GuiaInfo[]>([])

  // Cargar todas las guias del dia
  useEffect(() => {
    fetch('/api/guias')
      .then((r) => r.json())
      .then((data) => setAllGuias(data.guias || []))
  }, [])

  const buscarTracking = async (numero?: string) => {
    const guia = numero || guiaInput.trim()
    if (!guia) return
    setLoading(true)
    setTracking(null)
    try {
      const res = await fetch(`/api/tracking/${guia}`)
      const data = await res.json()
      setTracking(data)
    } catch {
      setTracking({ guia, eventos: [], estadoActual: 'Error', error: 'Error de conexión' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-azul mb-4">Tracking de Guías</h2>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={guiaInput}
          onChange={(e) => setGuiaInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscarTracking()}
          placeholder="Número de guía (ej: 360002929934370)"
          className="flex-1 border border-[#c8d6e8] rounded-lg px-4 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-acento"
        />
        <button
          onClick={() => buscarTracking()}
          disabled={loading}
          className="bg-acento text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {/* Guias rapidas del dia */}
      <div className="text-xs font-mono uppercase tracking-wider text-[#7a8fab] mb-2">
        Guías del Día — Click para consultar
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {allGuias.map((g) => (
          <button
            key={g.id}
            onClick={() => {
              setGuiaInput(g.numero)
              buscarTracking(g.numero)
            }}
            className={`font-mono text-[10px] px-2.5 py-1 rounded transition-colors ${
              g.checked
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-azul-claro text-azul hover:bg-blue-200'
            }`}
          >
            {g.numero}
          </button>
        ))}
      </div>

      {/* Resultado */}
      {tracking && (
        <div className="border border-[#c8d6e8] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs font-mono text-[#7a8fab] uppercase">Guía</div>
              <div className="font-mono text-lg font-semibold text-azul">{tracking.guia}</div>
            </div>
            <span
              className={`font-mono text-xs font-semibold px-3 py-1.5 rounded-full ${
                tracking.error
                  ? 'bg-red-50 text-red-700'
                  : 'bg-green-50 text-green-700'
              }`}
            >
              {tracking.estadoActual}
            </span>
          </div>

          {tracking.error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
              {tracking.error}
            </div>
          )}

          {tracking.eventos.length > 0 ? (
            <div className="space-y-3">
              {tracking.eventos.map((ev, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        i === 0 ? 'bg-acento' : 'bg-gray-300'
                      }`}
                    />
                    {i < tracking.eventos.length - 1 && (
                      <div className="w-px h-8 bg-gray-200" />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="font-semibold text-sm">{ev.estado}</div>
                    <div className="text-xs text-gray-500 font-mono">
                      {ev.fecha} {ev.hora} {ev.sucursal && `· ${ev.sucursal}`}
                    </div>
                    {ev.detalle && ev.detalle !== ev.estado && (
                      <div className="text-xs text-gray-400 mt-0.5">{ev.detalle}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : !tracking.error ? (
            <div className="text-center py-8 text-gray-400 text-sm font-mono">
              No se encontraron eventos de tracking.
              <br />
              <span className="text-xs">
                El sitio de Andreani puede requerir JavaScript para cargar datos.
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
