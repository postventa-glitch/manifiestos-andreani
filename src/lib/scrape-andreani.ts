import * as cheerio from 'cheerio'

export interface TrackingEvent {
  fecha: string
  hora: string
  estado: string
  detalle: string
  sucursal: string
}

export interface TrackingResult {
  guia: string
  eventos: TrackingEvent[]
  estadoActual: string
  error?: string
}

export async function scrapeAndreani(guiaNumero: string): Promise<TrackingResult> {
  try {
    const url = `https://www.andreani.com/envia/${guiaNumero}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      next: { revalidate: 300 }, // cache 5 min
    })

    if (!res.ok) {
      return { guia: guiaNumero, eventos: [], estadoActual: 'Error', error: `HTTP ${res.status}` }
    }

    const html = await res.text()
    const $ = cheerio.load(html)

    const eventos: TrackingEvent[] = []

    // Intentar parsear la timeline de tracking
    // La estructura puede variar, intentamos varios selectores comunes
    $('[class*="tracking"], [class*="timeline"], [class*="event"], [class*="estado"]').each((_, el) => {
      const text = $(el).text().trim()
      if (text.length > 5) {
        // Intentar extraer fecha/hora y descripcion
        const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2})/)
        eventos.push({
          fecha: dateMatch ? dateMatch[1] : '',
          hora: dateMatch ? dateMatch[2] : '',
          estado: text.split('\n')[0]?.trim() || text.substring(0, 50),
          detalle: text,
          sucursal: '',
        })
      }
    })

    // Si no encontramos con selectores especificos, buscar en tablas
    if (eventos.length === 0) {
      $('table tr').each((i, el) => {
        if (i === 0) return // skip header
        const cells = $(el).find('td')
        if (cells.length >= 2) {
          eventos.push({
            fecha: $(cells[0]).text().trim(),
            hora: $(cells[1]).text().trim(),
            estado: $(cells[2])?.text().trim() || '',
            detalle: $(cells[3])?.text().trim() || '',
            sucursal: $(cells[4])?.text().trim() || '',
          })
        }
      })
    }

    // Buscar estado actual
    let estadoActual = 'Sin información'
    const estadoEl = $('[class*="status"], [class*="estado-actual"]').first()
    if (estadoEl.length) {
      estadoActual = estadoEl.text().trim()
    } else if (eventos.length > 0) {
      estadoActual = eventos[0].estado
    }

    return { guia: guiaNumero, eventos, estadoActual }
  } catch (err) {
    return {
      guia: guiaNumero,
      eventos: [],
      estadoActual: 'Error',
      error: err instanceof Error ? err.message : 'Error desconocido',
    }
  }
}
