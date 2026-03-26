'use client'

import { useState, useEffect, useCallback } from 'react'
import FileUpload from '@/components/FileUpload'

interface Manifiesto {
  id: string
  numero: string
  fecha: string
  sucursal: string
  totalPaquetes: number
  subidoAt: string
  pdfFileName: string
  guias: { id: string; checked: boolean }[]
}

export default function AdminPage() {
  const [manifiestos, setManifiestos] = useState<Manifiesto[]>([])
  const [loading, setLoading] = useState(true)
  const [finalizing, setFinalizing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/manifiestos')
      const data = await res.json()
      setManifiestos(data.manifiestos || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const finalizarDia = async () => {
    if (!confirm('¿Finalizar el día? Las guías pendientes se pasarán al día siguiente.')) return
    setFinalizing(true)
    try {
      const res = await fetch('/api/dias', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        alert(
          `Día finalizado.\n${data.pendientesCarryOver} guías pendientes pasadas al siguiente día.`
        )
        fetchData()
      }
    } catch (err) {
      alert('Error al finalizar el día')
    } finally {
      setFinalizing(false)
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-azul mb-4">Subir Manifiestos</h2>

      <FileUpload onUploadComplete={fetchData} />

      {/* Manifiestos del dia */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-mono font-semibold text-azul uppercase tracking-wider">
            Manifiestos de Hoy ({manifiestos.length})
          </h3>
          {manifiestos.length > 0 && (
            <button
              onClick={finalizarDia}
              disabled={finalizing}
              className="bg-rojo text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {finalizing ? 'Finalizando...' : 'Finalizar Día'}
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 font-mono">Cargando...</p>
        ) : manifiestos.length === 0 ? (
          <p className="text-sm text-gray-400 font-mono py-8 text-center">
            No hay manifiestos subidos hoy
          </p>
        ) : (
          <div className="space-y-3">
            {manifiestos.map((m) => {
              const checked = m.guias.filter((g) => g.checked).length
              const total = m.guias.length
              const subidoAt = new Date(m.subidoAt).toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
              })
              return (
                <div
                  key={m.id}
                  className="border border-[#c8d6e8] rounded-lg p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-azul-claro text-azul font-mono text-xs font-semibold px-3 py-1.5 rounded">
                      {m.numero.replace('-CO', '')}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{m.sucursal}</div>
                      <div className="text-xs text-gray-400 font-mono">
                        {m.pdfFileName} · Subido {subidoAt}
                        {m.numero.endsWith('-CO') && (
                          <span className="ml-2 text-red-500 font-semibold">CARRY-OVER</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-azul">
                        {checked}/{total}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">guías</div>
                    </div>
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                        checked === total && total > 0 ? 'bg-verde' : 'bg-orange-400'
                      }`}
                    >
                      {total > 0 ? Math.round((checked / total) * 100) : 0}%
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
