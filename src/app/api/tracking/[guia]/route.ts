import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scrapeAndreani } from '@/lib/scrape-andreani'

export async function GET(_: NextRequest, { params }: { params: { guia: string } }) {
  const guiaNumero = params.guia

  // Intentar scraping
  const tracking = await scrapeAndreani(guiaNumero)

  // Guardar en DB si existe la guia
  await prisma.guia.updateMany({
    where: { numero: guiaNumero },
    data: {
      trackingData: tracking as any,
      trackingUpdatedAt: new Date(),
    },
  })

  return NextResponse.json(tracking)
}
