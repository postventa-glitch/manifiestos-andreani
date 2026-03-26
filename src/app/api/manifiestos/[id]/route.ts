import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const manifiesto = await prisma.manifiesto.findUnique({
    where: { id: params.id },
    include: { guias: { orderBy: { orden: 'asc' } }, dia: true },
  })

  if (!manifiesto) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  return NextResponse.json(manifiesto)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.manifiesto.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
