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

    // Check if text was already extracted client-side
    const extractedTexts = formData.getAll('texts') as string[];
    const files = formData.getAll('pdfs') as File[];

    if ((!files || files.length === 0) && (!extractedTexts || extractedTexts.length === 0)) {
      return NextResponse.json({ error: 'No se subieron archivos' }, { status: 400 });
    }

    const results = [];

    // If client sent pre-extracted text, use that (preferred path for edge runtime)
    if (extractedTexts && extractedTexts.length > 0) {
      for (let i = 0; i < extractedTexts.length; i++) {
        const text = extractedTexts[i];
        const file = files[i]; // corresponding PDF file
        const manifiesto = parsePdfText(text);

        if (manifiesto) {
          await addManifiesto(kv, manifiesto);
          // Store PDF binary in KV if file provided
          if (file) {
            const arrayBuf = await file.arrayBuffer();
            const base64 = arrayBufferToBase64(arrayBuf);
            await storePdf(kv, `${manifiesto.numero}_${Date.now()}.pdf`, base64);
          }
          results.push({ success: true, numero: manifiesto.numero, guias: manifiesto.guias.length });
        } else {
          results.push({
            success: false,
            file: file?.name || `text-${i}`,
            error: 'No se pudo parsear el PDF',
            debug: text.substring(0, 2000),
          });
        }
      }
    } else {
      // Fallback: try to extract text server-side from raw PDF bytes
      for (const file of files) {
        const arrayBuf = await file.arrayBuffer();
        const text = extractTextFromPdfBytes(new Uint8Array(arrayBuf));
        const manifiesto = parsePdfText(text);

        if (manifiesto) {
          await addManifiesto(kv, manifiesto);
          const base64 = arrayBufferToBase64(arrayBuf);
          await storePdf(kv, `${manifiesto.numero}_${Date.now()}.pdf`, base64);
          results.push({ success: true, numero: manifiesto.numero, guias: manifiesto.guias.length });
        } else {
          results.push({
            success: false,
            file: file.name,
            error: 'No se pudo parsear el PDF (server-side). Intente de nuevo.',
            debug: text.substring(0, 2000),
          });
        }
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

// Convert ArrayBuffer to base64 without Node.js Buffer
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Basic text extraction from raw PDF bytes (no external deps, edge-compatible)
function extractTextFromPdfBytes(bytes: Uint8Array): string {
  // Convert to latin1 string
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  const texts: string[] = [];

  // Extract text between BT and ET markers (PDF text objects)
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(str)) !== null) {
    const block = match[1];
    // Extract text from Tj operator
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      texts.push(tjMatch[1]);
    }
    // TJ array operator
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
