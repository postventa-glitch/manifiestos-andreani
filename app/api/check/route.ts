import { NextRequest, NextResponse } from 'next/server';
import { updateGuiaCheck, getManifiestos, getPendingFromYesterday } from '@/lib/store';

export async function POST(request: NextRequest) {
  const { manifiestoId, guiaNumero, checked } = await request.json();
  await updateGuiaCheck(manifiestoId, guiaNumero, checked);
  const manifiestos = await getManifiestos();
  const pending = await getPendingFromYesterday();
  return NextResponse.json({ manifiestos, pending });
}
