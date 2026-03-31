export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { updateGuiaCheck, getAll } from '@/lib/store';
import { getKV } from '@/lib/bindings';

export async function POST(request: NextRequest) {
  const kv = getKV();
  const { manifiestoId, guiaNumero, checked } = await request.json();
  await updateGuiaCheck(kv, manifiestoId, guiaNumero, checked);
  const data = await getAll(kv);
  return NextResponse.json(data);
}
