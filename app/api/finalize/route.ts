import { NextResponse } from 'next/server';
import { finalizeDay, getHistory } from '@/lib/store';

export async function POST() {
  const record = finalizeDay();
  if (!record) {
    return NextResponse.json({ error: 'No hay manifiestos para finalizar' }, { status: 400 });
  }
  return NextResponse.json({ record, history: getHistory() });
}

export async function GET() {
  return NextResponse.json({ history: getHistory() });
}
