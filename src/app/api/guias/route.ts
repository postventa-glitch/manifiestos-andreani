import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Todas las guias del dia activo + carry-over pendientes
export async function GET() {
  const dia = await prisma.dia.findFirst({
    where: { finalizado: false },
    orderBy: { fecha: 'desc' },
  })

  if (!dia) {
    return NextResponse.json({ guias: [], dia: null })
  }

  const guias = await prisma.guia.findMany({
    where: { manifiesto: { diaId: dia.id } },
    include: { manifiesto: true },
    orderBy: [{ manifiesto: { subidoAt: 'asc' } }, { orden: 'asc' }],
  })

  return NextResponse.json({ guias, dia })
}
