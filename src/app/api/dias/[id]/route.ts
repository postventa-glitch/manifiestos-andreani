import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const dia = await prisma.dia.findUnique({
    where: { id: params.id },
    include: {
      manifiestos: {
        include: { guias: { orderBy: { orden: 'asc' } } },
        orderBy: { subidoAt: 'asc' },
      },
    },
  })

  if (!dia) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  return NextResponse.json(dia)
}
