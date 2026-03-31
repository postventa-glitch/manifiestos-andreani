export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { finalizeDay, getHistory } from '@/lib/store';
import { getKV } from '@/lib/bindings';

export async function POST() {
  const kv = getKV();
  const record = await finalizeDay(kv);
  if (!record) {
    return NextResponse.json({ error: 'No hay manifiestos para finalizar' }, { status: 400 });
  }
  const history = await getHistory(kv);
  return NextResponse.json({ record, history });
}

export async function GET() {
  const kv = getKV();
  const history = await getHistory(kv);
  return NextResponse.json({ history });
}
