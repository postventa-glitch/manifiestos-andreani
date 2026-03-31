export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { parsePdfText } from '@/lib/pdf-parser';
import { addManifiesto, deleteManifiesto, getAll, storePdf } from '@/lib/store';
import { getKV } from '@/lib/bindings';

export async function GET() {
  const kv = getKV();
  const data = await getAll(kv);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  try {
    const kv = getKV();
    const formData = await request.formData();
    const files = formData.getAll('pdfs') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No se subieron archivos' }, { status: 400 });
    }

    const results = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());

      // Try to parse PDF text - use pdf-parse if available, fallback to basic extraction
      let text = '';
      try {
        const pdf = (await import('pdf-parse')).default;
        const data = await pdf(buffer);
        text = data.text;
      } catch {
        // Fallback: try to extract text from raw PDF buffer
        text = extractTextFromPdfBuffer(buffer);
      }

      const manifiesto = parsePdfText(text);

      if (manifiesto) {
        await addManifiesto(kv, manifiesto);
        // Store PDF in KV as base64
        const base64 = buffer.toString('base64');
        await storePdf(kv, `${manifiesto.numero}_${Date.now()}.pdf`, base64);
        results.push({ success: true, numero: manifiesto.numero, guias: manifiesto.guias.length });
      } else {
        results.push({
          success: false,
          file: file.name,
          error: 'No se pudo parsear el PDF',
          debug: text.substring(0, 2000),
        });
      }
    }

    const storeData = await getAll(kv);
    return NextResponse.json({ results, ...storeData });
  } catch (error) {
    return NextResponse.json({ error: 'Error procesando PDFs: ' + String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const kv = getKV();
    const { manifiestoId } = await request.json();
    if (!manifiestoId) {
      return NextResponse.json({ error: 'manifiestoId requerido' }, { status: 400 });
    }
    const deleted = await deleteManifiesto(kv, manifiestoId);
    if (!deleted) {
      return NextResponse.json({ error: 'Manifiesto no encontrado' }, { status: 404 });
    }
    const data = await getAll(kv);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Error eliminando manifiesto' }, { status: 500 });
  }
}

// Basic fallback text extraction from PDF buffer (no external deps)
function extractTextFromPdfBuffer(buffer: Buffer): string {
  const str = buffer.toString('latin1');
  const texts: string[] = [];

  // Extract text between BT and ET markers (PDF text objects)
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(str)) !== null) {
    const block = match[1];
    // Extract text from Tj and TJ operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      texts.push(tjMatch[1]);
    }
    // TJ array
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
    let arrMatch;
    while ((arrMatch = tjArrayRegex.exec(block)) !== null) {
      const parts = arrMatch[1].match(/\(([^)]*)\)/g);
      if (parts) {
        texts.push(parts.map(p => p.slice(1, -1)).join(''));
      }
    }
  }

  return texts.join('\n');
}
