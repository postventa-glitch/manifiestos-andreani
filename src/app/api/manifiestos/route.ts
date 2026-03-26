import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parsePDF } from '@/lib/parse-pdf'
import { getToday } from '@/lib/utils'

// GET - Listar manifiestos del dia activo
export async function GET() {
  const dia = await prisma.dia.findFirst({
    where: { finalizado: false },
    include: {
      manifiestos: {
        include: { guias: { orderBy: { orden: 'asc' } } },
        orderBy: { subidoAt: 'desc' },
      },
    },
    orderBy: { fecha: 'desc' },
  })

  return NextResponse.json({ dia, manifiestos: dia?.manifiestos || [] })
}

// POST - Subir PDF(s) de manifiestos
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const files = formData.getAll('files') as File[]

  if (!files.length) {
    return NextResponse.json({ error: 'No se enviaron archivos' }, { status: 400 })
  }

  // Obtener o crear dia activo
  let dia = await prisma.dia.findFirst({
    where: { finalizado: false },
    orderBy: { fecha: 'desc' },
  })

  if (!dia) {
    dia = await prisma.dia.create({
      data: { fecha: getToday() },
    })
  }

  const results = []

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const parsed = await parsePDF(buffer)

      // Verificar si ya existe este manifiesto
      const existing = await prisma.manifiesto.findUnique({
        where: { numero: parsed.numero },
      })

      if (existing) {
        results.push({
          file: file.name,
          status: 'skipped',
          message: `Manifiesto ${parsed.numero} ya existe`,
        })
        continue
      }

      const manifiesto = await prisma.manifiesto.create({
        data: {
          numero: parsed.numero,
          fecha: parsed.fecha,
          sucursal: parsed.sucursal,
          direccion: parsed.direccion,
          email: parsed.email,
          telefono: parsed.telefono,
          pesoTotal: parsed.pesoTotal,
          totalPaquetes: parsed.totalPaquetes,
          pdfFileName: file.name,
          diaId: dia.id,
          guias: {
            create: parsed.guias.map((g) => ({
              numero: g.numero,
              orden: g.orden,
              paquetes: g.paquetes,
            })),
          },
        },
        include: { guias: true },
      })

      results.push({
        file: file.name,
        status: 'ok',
        manifiesto: manifiesto.numero,
        guias: manifiesto.guias.length,
      })
    } catch (err) {
      results.push({
        file: file.name,
        status: 'error',
        message: err instanceof Error ? err.message : 'Error desconocido',
      })
    }
  }

  return NextResponse.json({ results, diaId: dia.id })
}
