import { NextResponse } from 'next/server';
import { finalizeDay, getHistory } from '@/lib/store';

export async function POST() {
  const record = await finalizeDay();
  if (!record) {
    return NextResponse.json({ error: 'No hay manifiestos para finalizar' }, { status: 400 });
  }
  const history = await getHistory();
  return NextResponse.json({ record, history });
}

export async function GET() {
  const history = await getHistory();
  return NextResponse.json({ history });
}
