import pdf from 'pdf-parse'

export interface ParsedManifiesto {
  numero: string
  fecha: Date
  sucursal: string
  direccion: string
  email: string
  telefono: string
  pesoTotal: number
  totalPaquetes: number
  guias: { orden: number; numero: string; paquetes: number }[]
}

export async function parsePDF(buffer: Buffer): Promise<ParsedManifiesto> {
  const data = await pdf(buffer)
  const text = data.text

  // Numero de manifiesto
  const numeroMatch = text.match(/N[úu]mero:\s*(\d+)/)
  if (!numeroMatch) throw new Error('No se encontró el número de manifiesto')
  const numero = numeroMatch[1]

  // Fecha
  const fechaMatch = text.match(/Fecha:\s*(\d{2})\/(\d{2})\/(\d{4})/)
  if (!fechaMatch) throw new Error('No se encontró la fecha')
  const fecha = new Date(
    parseInt(fechaMatch[3]),
    parseInt(fechaMatch[2]) - 1,
    parseInt(fechaMatch[1])
  )

  // Sucursal - linea que empieza con #
  const sucursalMatch = text.match(/(#\d+\s+[^\n]+)/)
  const sucursal = sucursalMatch ? sucursalMatch[1].trim() : ''

  // Direccion - linea despues de sucursal con formato "calle, CP ciudad, prov"
  const direccionMatch = text.match(/([^\n]*\d{4}\s+[^\n]*,\s*CH)/)
  const direccion = direccionMatch ? direccionMatch[1].trim() : ''

  // Email
  const emailMatch = text.match(/([\w.-]+@[\w.-]+\.\w+)/)
  const email = emailMatch ? emailMatch[1] : ''

  // Telefono
  const telMatch = text.match(/(\d{10,})/)
  const telefono = telMatch ? telMatch[1] : ''

  // Peso total
  const pesoMatch = text.match(/Peso\s*Total:\s*([\d.]+)\s*kg/)
  const pesoTotal = pesoMatch ? parseFloat(pesoMatch[1]) : 0

  // Total paquetes
  const paquetesMatch = text.match(/Total\s*Paquetes:\s*(\d+)/)
  const totalPaquetes = paquetesMatch ? parseInt(paquetesMatch[1]) : 0

  // Guias - buscar patrones de "01 360002929934370 1"
  const guias: { orden: number; numero: string; paquetes: number }[] = []
  const guiaRegex = /(\d{2})\s+(3\d{14})\s+(\d+)/g
  let match
  while ((match = guiaRegex.exec(text)) !== null) {
    guias.push({
      orden: parseInt(match[1]),
      numero: match[2],
      paquetes: parseInt(match[3]),
    })
  }

  return {
    numero,
    fecha,
    sucursal,
    direccion,
    email,
    telefono,
    pesoTotal,
    totalPaquetes,
    guias,
  }
}
