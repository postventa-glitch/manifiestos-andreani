'use client'

import { useState } from 'react'

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

export default function ManifestCard({
  manifiesto,
  onGuiaToggle,
}: {
  manifiesto: Manifiesto
  onGuiaToggle: (guiaId: string, checked: boolean) => void
}) {
  const [guias, setGuias] = useState(manifiesto.guias)

  const checkedCount = guias.filter((g) => g.checked).length
  const total = guias.length
  const isComplete = checkedCount === total

  const handleCheck = async (guia: Guia) => {
    const newChecked = !guia.checked
    setGuias((prev) =>
      prev.map((g) => (g.id === guia.id ? { ...g, checked: newChecked } : g))
    )
    onGuiaToggle(guia.id, newChecked)

    try {
      await fetch(`/api/guias/${guia.id}/check`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: newChecked }),
      })
    } catch {
      // Revert on error
      setGuias((prev) =>
        prev.map((g) => (g.id === guia.id ? { ...g, checked: !newChecked } : g))
      )
      onGuiaToggle(guia.id, !newChecked)
    }
  }

  const isCarryOver = manifiesto.numero.endsWith('-CO')
  const fecha = new Date(manifiesto.fecha).toLocaleDateString('es-AR')

  return (
    <div className="border-b-2 border-dashed border-[#c8d6e8] p-7 last:border-b-0">
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[2px] text-acento">
            Manifiesto de Carga {isCarryOver && <span className="text-rojo ml-2">(PENDIENTE DIA ANTERIOR)</span>}
          </div>
          <div className="font-mono text-xl font-semibold text-azul tracking-wide">
            N° {manifiesto.numero.replace('-CO', '')}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="bg-azul-claro text-azul font-mono text-xs font-semibold px-3.5 py-1.5 rounded-full">
            {fecha}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 font-mono text-[11px] px-3 py-1 rounded-full font-semibold ${
              isComplete
                ? 'bg-green-50 text-green-800'
                : checkedCount > 0
                ? 'bg-orange-50 text-orange-800'
                : 'bg-orange-50 text-orange-800'
            }`}
          >
            <span
              className={`w-[7px] h-[7px] rounded-full ${
                isComplete ? 'bg-green-500' : 'bg-orange-400'
              }`}
            />
            {isComplete
              ? 'Completo'
              : checkedCount > 0
              ? `En curso (${checkedCount}/${total})`
              : 'Pendiente'}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="bg-[#f5f7fa] border border-[#c8d6e8] rounded-lg p-3.5 mb-5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
        <div className="col-span-2 flex flex-col gap-px">
          <span className="text-[10px] font-mono uppercase text-[#7a8fab] tracking-wide">Sucursal</span>
          <span className="font-semibold">{manifiesto.sucursal}</span>
        </div>
        <div className="col-span-2 flex flex-col gap-px">
          <span className="text-[10px] font-mono uppercase text-[#7a8fab] tracking-wide">Dirección</span>
          <span className="font-semibold">{manifiesto.direccion}</span>
        </div>
        <div className="flex flex-col gap-px">
          <span className="text-[10px] font-mono uppercase text-[#7a8fab] tracking-wide">Email</span>
          <span className="font-semibold">{manifiesto.email}</span>
        </div>
        <div className="flex flex-col gap-px">
          <span className="text-[10px] font-mono uppercase text-[#7a8fab] tracking-wide">Teléfono</span>
          <span className="font-semibold">{manifiesto.telefono}</span>
        </div>
      </div>

      {/* Tabla guias */}
      <div className="text-[10px] font-mono uppercase tracking-[1.5px] text-[#7a8fab] mb-2">
        Números de Guía
      </div>
      <table className="w-full border-collapse text-[13px] mb-5">
        <thead>
          <tr className="bg-azul text-white">
            <th className="py-2.5 px-3.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-center w-12">
              #
            </th>
            <th className="py-2.5 px-3.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-left">
              Número Guía
            </th>
            <th className="py-2.5 px-3.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-center w-20">
              Paquetes
            </th>
            <th className="py-2.5 px-3.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-center w-16">
              ✓
            </th>
          </tr>
        </thead>
        <tbody>
          {guias.map((guia) => (
            <tr
              key={guia.id}
              className={`border-b border-[#c8d6e8] transition-colors ${
                guia.checked ? 'bg-green-50' : 'hover:bg-azul-claro'
              }`}
            >
              <td className="py-2.5 px-3.5 text-center">
                <span
                  className={`inline-block font-mono text-[10px] font-semibold px-2 py-0.5 rounded text-white tracking-wide ${
                    guia.checked ? 'bg-verde' : 'bg-azul'
                  }`}
                >
                  {String(guia.orden).padStart(2, '0')}
                </span>
              </td>
              <td
                className={`py-2.5 px-3.5 font-mono text-xs tracking-wide ${
                  guia.checked ? 'line-through opacity-50 text-green-700' : ''
                }`}
              >
                {guia.numero}
                {guia.carryOver && (
                  <span className="ml-2 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                    PENDIENTE
                  </span>
                )}
              </td>
              <td className={`py-2.5 px-3.5 text-center ${guia.checked ? 'text-green-700' : ''}`}>
                {guia.paquetes}
              </td>
              <td className="py-2.5 px-3.5">
                <div className="flex justify-center">
                  <input
                    type="checkbox"
                    className="guia-check"
                    checked={guia.checked}
                    onChange={() => handleCheck(guia)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totales */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 border border-[#c8d6e8] rounded-lg p-3 flex flex-col gap-0.5">
          <span className="text-[10px] font-mono uppercase tracking-wide text-[#7a8fab]">Peso Total</span>
          <span className="font-mono text-xl font-semibold text-azul">{manifiesto.pesoTotal} kg</span>
        </div>
        <div className="flex-1 border border-[#c8d6e8] rounded-lg p-3 flex flex-col gap-0.5">
          <span className="text-[10px] font-mono uppercase tracking-wide text-[#7a8fab]">Total Paquetes</span>
          <span className="font-mono text-xl font-semibold text-azul">{manifiesto.totalPaquetes}</span>
        </div>
        <div className="flex-1 border border-[#c8d6e8] rounded-lg p-3 flex flex-col gap-0.5">
          <span className="text-[10px] font-mono uppercase tracking-wide text-[#7a8fab]">Guías confirmadas</span>
          <span className="font-mono text-xl font-semibold text-azul">
            {checkedCount} / {total}
          </span>
        </div>
      </div>

      {/* Firmas */}
      <div className="grid grid-cols-2 gap-5">
        <div className="border border-[#c8d6e8] rounded-lg p-3 pb-7">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wide text-azul mb-1">
            Cliente
          </div>
          <div className="text-[10px] text-gray-400 italic">Nombre / firma / fecha</div>
          <div className="mt-5 border-b border-gray-300" />
        </div>
        <div className="border border-[#c8d6e8] rounded-lg p-3 pb-7">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wide text-azul mb-1">
            Paquetería
          </div>
          <div className="text-[10px] text-gray-400 italic">Nombre / firma / fecha</div>
          <div className="mt-5 border-b border-gray-300" />
        </div>
      </div>
    </div>
  )
}
