import { NextRequest, NextResponse } from 'next/server';
import { updateGuiaCheck, getAll } from '@/lib/store';

export async function POST(request: NextRequest) {
  const { manifiestoId, guiaNumero, checked } = await request.json();
  await updateGuiaCheck(manifiestoId, guiaNumero, checked);
  const data = await getAll();
  return NextResponse.json(data);
}
