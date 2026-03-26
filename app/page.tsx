'use client';

import { useState, useEffect, useCallback } from 'react';

interface Guia {
  numero: string;
  paquetes: number;
  checked: boolean;
  checkedAt: string | null;
}

interface Manifiesto {
  id: string;
  numero: string;
  fecha: string;
  sucursal: string;
  direccion: string;
  email: string;
  telefono: string;
  guias: Guia[];
  pesoTotal: string;
  totalPaquetes: number;
  uploadedAt: string;
}

export default function PublicPage() {
  const [manifiestos, setManifiestos] = useState<Manifiesto[]>([]);
  const [pending, setPending] = useState<Manifiesto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/manifiestos');
      const data = await res.json();
      setManifiestos(data.manifiestos || []);
      setPending(data.pending || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCheck = async (manifiestoId: string, guiaNumero: string, checked: boolean) => {
    // Optimistic update
    const updateList = (list: Manifiesto[]) =>
      list.map(m =>
        m.id === manifiestoId
          ? {
              ...m,
              guias: m.guias.map(g =>
                g.numero === guiaNumero
                  ? { ...g, checked, checkedAt: checked ? new Date().toISOString() : null }
                  : g
              ),
            }
          : m
      );

    setManifiestos(prev => updateList(prev));
    setPending(prev => updateList(prev));

    await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifiestoId, guiaNumero, checked }),
    });
  };

  const allManifiestos = [...pending, ...manifiestos];
  const totalGuias = allManifiestos.reduce((s, m) => s + m.guias.length, 0);
  const checkedGuias = allManifiestos.reduce((s, m) => s + m.guias.filter(g => g.checked).length, 0);
  const pct = totalGuias > 0 ? (checkedGuias / totalGuias) * 100 : 0;

  const today = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-azul font-mono text-lg animate-pulse">Cargando manifiestos...</div>
      </div>
    );
  }

  if (allManifiestos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-6xl">📦</div>
        <div className="text-azul font-mono text-xl font-semibold">Sin manifiestos</div>
        <div className="text-gray-500 text-sm">Los manifiestos aparecen cuando el admin sube los PDFs</div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      {/* Top Bar */}
      <div className="max-w-[860px] mx-auto bg-azul text-white flex items-center justify-between px-7 py-3.5 rounded-t-xl">
        <div className="font-mono text-[22px] font-semibold tracking-[3px]">ANDREANI</div>
        <div className="font-mono text-xs opacity-65">Manifiestos de Carga &middot; {today}</div>
      </div>

      {/* Progress Bar */}
      <div className="max-w-[860px] mx-auto bg-azul-medio flex items-center gap-3.5 px-7 py-2.5">
        <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4fc3f7] rounded-full transition-all duration-400"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="font-mono text-[11px] text-white/80 whitespace-nowrap">
          {checkedGuias} / {totalGuias} guias confirmadas
        </div>
      </div>

      {/* Container */}
      <div className="max-w-[860px] mx-auto bg-white rounded-b-xl overflow-hidden shadow-[0_8px_40px_rgba(26,46,90,0.12)]">
        {/* Pending from yesterday */}
        {pending.length > 0 && (
          <div className="bg-amber-50 border-b-2 border-amber-200 px-7 py-3">
            <span className="font-mono text-xs font-semibold text-amber-700 tracking-wider uppercase">
              Pendientes del dia anterior
            </span>
          </div>
        )}

        {pending.map(m => (
          <ManifiestoCard key={m.id} manifiesto={m} onCheck={handleCheck} isPending />
        ))}

        {pending.length > 0 && manifiestos.length > 0 && (
          <div className="bg-azul-claro px-7 py-3">
            <span className="font-mono text-xs font-semibold text-azul tracking-wider uppercase">
              Manifiestos de hoy
            </span>
          </div>
        )}

        {manifiestos.map(m => (
          <ManifiestoCard key={m.id} manifiesto={m} onCheck={handleCheck} />
        ))}
      </div>
    </div>
  );
}

function ManifiestoCard({
  manifiesto: m,
  onCheck,
  isPending,
}: {
  manifiesto: Manifiesto;
  onCheck: (mId: string, gNum: string, checked: boolean) => void;
  isPending?: boolean;
}) {
  const done = m.guias.filter(g => g.checked).length;
  const total = m.guias.length;
  const isComplete = done === total;

  return (
    <div className={`border-b-2 border-dashed border-[#c8d6e8] px-8 py-7 last:border-b-0 ${isPending ? 'bg-amber-50/30' : ''}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[2px] text-acento">
            Manifiesto de Carga
          </div>
          <div className="font-mono text-xl font-semibold text-azul tracking-wide">
            N&ordm; {m.numero}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="bg-azul-claro text-azul font-mono text-xs font-semibold px-3.5 py-1.5 rounded-full">
            {m.fecha}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 font-mono text-[11px] px-3 py-1 rounded-full font-semibold ${
              isComplete
                ? 'bg-green-100 text-green-800'
                : done > 0
                ? 'bg-orange-100 text-orange-800'
                : 'bg-orange-50 text-orange-700'
            }`}
          >
            <span className={`w-[7px] h-[7px] rounded-full ${isComplete ? 'bg-green-500' : 'bg-orange-400'}`} />
            {isComplete ? 'Completo' : done > 0 ? `En curso (${done}/${total})` : 'Pendiente'}
          </span>
        </div>
      </div>

      {/* Info Block */}
      <div className="bg-[#f5f7fa] border border-[#c8d6e8] rounded-lg p-3.5 mb-5 grid grid-cols-2 gap-y-1.5 gap-x-6 text-[13px]">
        <div className="col-span-2 flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase text-[#7a8fab] tracking-wide">Sucursal</span>
          <span className="font-semibold">{m.sucursal}</span>
        </div>
        <div className="col-span-2 flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase text-[#7a8fab] tracking-wide">Direccion</span>
          <span className="font-semibold">{m.direccion}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase text-[#7a8fab] tracking-wide">Email</span>
          <span className="font-semibold">{m.email}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase text-[#7a8fab] tracking-wide">Telefono</span>
          <span className="font-semibold">{m.telefono}</span>
        </div>
      </div>

      {/* Table */}
      <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-[#7a8fab] mb-2">
        Numeros de Guia
      </div>
      <table className="w-full border-collapse text-[13px] mb-5">
        <thead>
          <tr className="bg-azul text-white">
            <th className="py-2.5 px-3.5 font-mono text-[10px] font-semibold tracking-wider uppercase text-center w-12">#</th>
            <th className="py-2.5 px-3.5 font-mono text-[10px] font-semibold tracking-wider uppercase text-left">Numero Guia</th>
            <th className="py-2.5 px-3.5 font-mono text-[10px] font-semibold tracking-wider uppercase text-center w-20">Paquetes</th>
            <th className="py-2.5 px-3.5 font-mono text-[10px] font-semibold tracking-wider uppercase text-center w-16">OK</th>
          </tr>
        </thead>
        <tbody>
          {m.guias.map((g, i) => (
            <tr
              key={g.numero}
              className={`border-b border-[#c8d6e8] transition-colors ${
                g.checked ? 'guia-checked bg-[#eafaf1]' : 'hover:bg-azul-claro'
              }`}
            >
              <td className="py-2.5 px-3.5 text-center">
                <span className={`guia-num-badge inline-block text-white font-mono text-[10px] font-semibold px-2 py-0.5 rounded tracking-wide ${g.checked ? 'bg-verde' : 'bg-azul'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
              </td>
              <td className={`py-2.5 px-3.5 font-mono text-xs tracking-wide ${g.checked ? 'line-through opacity-50' : ''}`}>
                {g.numero}
              </td>
              <td className="py-2.5 px-3.5 text-center">{g.paquetes}</td>
              <td className="py-2.5 px-3.5">
                <div className="flex justify-center">
                  <input
                    type="checkbox"
                    className="guia-checkbox"
                    checked={g.checked}
                    onChange={e => onCheck(m.id, g.numero, e.target.checked)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 border border-[#c8d6e8] rounded-lg p-3 flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase tracking-wide text-[#7a8fab]">Peso Total</span>
          <span className="font-mono text-xl font-semibold text-azul">{m.pesoTotal}</span>
        </div>
        <div className="flex-1 border border-[#c8d6e8] rounded-lg p-3 flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase tracking-wide text-[#7a8fab]">Total Paquetes</span>
          <span className="font-mono text-xl font-semibold text-azul">{m.totalPaquetes}</span>
        </div>
        <div className="flex-1 border border-[#c8d6e8] rounded-lg p-3 flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase tracking-wide text-[#7a8fab]">Guias confirmadas</span>
          <span className="font-mono text-xl font-semibold text-azul">{done} / {total}</span>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-5">
        <div className="border border-[#c8d6e8] rounded-lg p-3 pb-7">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-azul mb-1">Cliente</div>
          <div className="text-[10px] text-gray-400 italic">Nombre / firma / fecha</div>
          <div className="mt-5 border-b border-gray-300" />
        </div>
        <div className="border border-[#c8d6e8] rounded-lg p-3 pb-7">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-azul mb-1">Paqueteria</div>
          <div className="text-[10px] text-gray-400 italic">Nombre / firma / fecha</div>
          <div className="mt-5 border-b border-gray-300" />
        </div>
      </div>
    </div>
  );
}
