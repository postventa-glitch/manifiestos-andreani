import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getToday } from '@/lib/utils'

// GET - Listar dias
export async function GET() {
  const dias = await prisma.dia.findMany({
    include: {
      manifiestos: {
        include: { guias: true },
      },
    },
    orderBy: { fecha: 'desc' },
    take: 30,
  })

  const resumen = dias.map((d) => {
    const totalGuias = d.manifiestos.reduce((sum, m) => sum + m.guias.length, 0)
    const guiasChecked = d.manifiestos.reduce(
      (sum, m) => sum + m.guias.filter((g) => g.checked).length,
      0
    )
    return {
      id: d.id,
      fecha: d.fecha,
      finalizado: d.finalizado,
      finalizadoAt: d.finalizadoAt,
      manifiestos: d.manifiestos.length,
      totalGuias,
      guiasChecked,
      porcentaje: totalGuias > 0 ? Math.round((guiasChecked / totalGuias) * 100) : 0,
    }
  })

  return NextResponse.json(resumen)
}

// POST - Finalizar dia actual y crear carry-over
export async function POST() {
  const dia = await prisma.dia.findFirst({
    where: { finalizado: false },
    include: {
      manifiestos: {
        include: { guias: true },
      },
    },
    orderBy: { fecha: 'desc' },
  })

  if (!dia) {
    return NextResponse.json({ error: 'No hay día activo' }, { status: 400 })
  }

  // Finalizar dia
  await prisma.dia.update({
    where: { id: dia.id },
    data: { finalizado: true, finalizadoAt: new Date() },
  })

  // Buscar guias pendientes
  const pendientes: { numero: string; orden: number; paquetes: number; manifiestoNumero: string; sucursal: string; direccion: string; email: string; telefono: string }[] = []
  for (const m of dia.manifiestos) {
    for (const g of m.guias) {
      if (!g.checked) {
        pendientes.push({
          numero: g.numero,
          orden: g.orden,
          paquetes: g.paquetes,
          manifiestoNumero: m.numero,
          sucursal: m.sucursal,
          direccion: m.direccion,
          email: m.email,
          telefono: m.telefono,
        })
      }
    }
  }

  // Crear nuevo dia con carry-over si hay pendientes
  if (pendientes.length > 0) {
    const nuevoDia = await prisma.dia.create({
      data: { fecha: getToday() },
    })

    // Agrupar pendientes por manifiesto original
    const byManifiesto = new Map<string, typeof pendientes>()
    for (const p of pendientes) {
      const key = p.manifiestoNumero
      if (!byManifiesto.has(key)) byManifiesto.set(key, [])
      byManifiesto.get(key)!.push(p)
    }

    for (const [manifNum, guiasPend] of byManifiesto) {
      const first = guiasPend[0]
      await prisma.manifiesto.create({
        data: {
          numero: `${manifNum}-CO`,
          fecha: getToday(),
          sucursal: first.sucursal,
          direccion: first.direccion,
          email: first.email,
          telefono: first.telefono,
          pesoTotal: 0,
          totalPaquetes: guiasPend.reduce((s, g) => s + g.paquetes, 0),
          pdfFileName: 'carry-over',
          diaId: nuevoDia.id,
          guias: {
            create: guiasPend.map((g, i) => ({
              numero: g.numero,
              orden: i + 1,
              paquetes: g.paquetes,
              carryOver: true,
            })),
          },
        },
      })
    }

    return NextResponse.json({
      ok: true,
      diaFinalizado: dia.id,
      nuevoDia: nuevoDia.id,
      pendientesCarryOver: pendientes.length,
    })
  }

  return NextResponse.json({
    ok: true,
    diaFinalizado: dia.id,
    pendientesCarryOver: 0,
  })
}
