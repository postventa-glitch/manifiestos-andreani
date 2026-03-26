import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  // Dia activo
  const diaActivo = await prisma.dia.findFirst({
    where: { finalizado: false },
    include: {
      manifiestos: { include: { guias: true } },
    },
  })

  // Ultimos 30 dias finalizados
  const diasFinalizados = await prisma.dia.findMany({
    where: { finalizado: true },
    include: {
      manifiestos: { include: { guias: true } },
    },
    orderBy: { fecha: 'desc' },
    take: 30,
  })

  // KPIs dia activo
  const hoyGuias = diaActivo?.manifiestos.flatMap((m) => m.guias) || []
  const hoyChecked = hoyGuias.filter((g) => g.checked)
  const hoyTotal = hoyGuias.length

  // Tiempo promedio de empaquetado (checked - subida manifiesto)
  let tiempoEmpaquetadoPromedio = 0
  const tiempos: number[] = []
  if (diaActivo) {
    for (const m of diaActivo.manifiestos) {
      for (const g of m.guias) {
        if (g.checked && g.checkedAt) {
          const diff = new Date(g.checkedAt).getTime() - new Date(m.subidoAt).getTime()
          if (diff > 0) tiempos.push(diff)
        }
      }
    }
  }
  if (tiempos.length > 0) {
    tiempoEmpaquetadoPromedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length
  }

  // Historico
  const historico = diasFinalizados.map((d) => {
    const guias = d.manifiestos.flatMap((m) => m.guias)
    const checked = guias.filter((g) => g.checked)
    const tiemposD: number[] = []
    for (const m of d.manifiestos) {
      for (const g of m.guias) {
        if (g.checked && g.checkedAt) {
          const diff = new Date(g.checkedAt).getTime() - new Date(m.subidoAt).getTime()
          if (diff > 0) tiemposD.push(diff)
        }
      }
    }
    const avgT = tiemposD.length > 0 ? tiemposD.reduce((a, b) => a + b, 0) / tiemposD.length : 0

    return {
      id: d.id,
      fecha: d.fecha,
      totalGuias: guias.length,
      guiasChecked: checked.length,
      porcentaje: guias.length > 0 ? Math.round((checked.length / guias.length) * 100) : 0,
      manifiestos: d.manifiestos.length,
      tiempoPromedio: avgT,
    }
  })

  return NextResponse.json({
    hoy: {
      totalGuias: hoyTotal,
      guiasChecked: hoyChecked.length,
      porcentaje: hoyTotal > 0 ? Math.round((hoyChecked.length / hoyTotal) * 100) : 0,
      manifiestos: diaActivo?.manifiestos.length || 0,
      tiempoEmpaquetadoPromedio,
      diaId: diaActivo?.id,
    },
    historico,
  })
}
