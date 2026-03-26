'use client'

import { useState, useRef } from 'react'

interface UploadResult {
  file: string
  status: string
  message?: string
  manifiesto?: string
  guias?: number
}

export default function FileUpload({ onUploadComplete }: { onUploadComplete: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UploadResult[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadFiles = async (files: FileList | File[]) => {
    setUploading(true)
    setResults([])

    const formData = new FormData()
    for (const file of Array.from(files)) {
      if (file.type === 'application/pdf') {
        formData.append('files', file)
      }
    }

    try {
      const res = await fetch('/api/manifiestos', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      setResults(data.results || [])
      onUploadComplete()
    } catch (err) {
      setResults([{ file: 'Error', status: 'error', message: 'Error de conexión' }])
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-acento bg-blue-50'
            : 'border-[#c8d6e8] hover:border-acento hover:bg-blue-50/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
        {uploading ? (
          <div>
            <div className="animate-spin w-8 h-8 border-4 border-acento border-t-transparent rounded-full mx-auto mb-3" />
            <p className="font-mono text-sm text-gray-500">Procesando PDFs...</p>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-3 opacity-40">📄</div>
            <p className="font-semibold text-azul mb-1">Arrastrá los PDFs aquí o hacé clic</p>
            <p className="text-xs text-gray-400 font-mono">Solo archivos .pdf de manifiestos Andreani</p>
          </>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-lg text-sm font-mono ${
                r.status === 'ok'
                  ? 'bg-green-50 text-green-800'
                  : r.status === 'skipped'
                  ? 'bg-yellow-50 text-yellow-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              <span>{r.status === 'ok' ? '✓' : r.status === 'skipped' ? '⚠' : '✗'}</span>
              <span className="flex-1">
                {r.file}
                {r.status === 'ok' && ` — Manifiesto ${r.manifiesto} (${r.guias} guías)`}
                {r.message && ` — ${r.message}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
