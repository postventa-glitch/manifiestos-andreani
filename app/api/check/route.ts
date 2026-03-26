import { NextRequest, NextResponse } from 'next/server';
import { updateGuiaCheck, getManifiestos, getPendingFromYesterday } from '@/lib/store';

export async function POST(request: NextRequest) {
  const { manifiestoId, guiaNumero, checked } = await request.json();
  updateGuiaCheck(manifiestoId, guiaNumero, checked);
  return NextResponse.json({
    manifiestos: getManifiestos(),
    pending: getPendingFromYesterday(),
  });
}
