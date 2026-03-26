'use client'

export default function ProgressBar({ checked, total }: { checked: number; total: number }) {
  const pct = total > 0 ? (checked / total) * 100 : 0

  return (
    <div className="bg-azul-medio flex items-center gap-3.5 px-7 py-2.5 max-w-[860px] mx-auto">
      <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-sky-300 rounded-full transition-all duration-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="font-mono text-[11px] text-white/80 whitespace-nowrap">
        {checked} / {total} guías confirmadas
      </div>
    </div>
  )
}
