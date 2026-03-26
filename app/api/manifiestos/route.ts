import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { parsePdfText } from '@/lib/pdf-parser';
import { addManifiesto, getManifiestos, getPendingFromYesterday } from '@/lib/store';

export async function GET() {
  const manifiestos = getManifiestos();
  const pending = getPendingFromYesterday();
  return NextResponse.json({ manifiestos, pending });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('pdfs') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No se subieron archivos' }, { status: 400 });
    }

    const results = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await pdf(buffer);
      const manifiesto = parsePdfText(data.text);

      if (manifiesto) {
        addManifiesto(manifiesto);
        results.push({ success: true, numero: manifiesto.numero, guias: manifiesto.guias.length });
      } else {
        results.push({ success: false, file: file.name, error: 'No se pudo parsear el PDF' });
      }
    }

    return NextResponse.json({ results, manifiestos: getManifiestos() });
  } catch (error) {
    return NextResponse.json({ error: 'Error procesando PDFs' }, { status: 500 });
  }
}
