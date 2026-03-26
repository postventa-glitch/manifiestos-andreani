import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PATCH - Marcar/desmarcar guia
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const checked = body.checked as boolean

  const guia = await prisma.guia.update({
    where: { id: params.id },
    data: {
      checked,
      checkedAt: checked ? new Date() : null,
    },
  })

  return NextResponse.json(guia)
}
