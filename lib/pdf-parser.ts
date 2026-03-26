import { Manifiesto, Guia } from './types';

function extractManifestNumber(text: string): string | null {
  // Try multiple patterns for the manifest number
  const patterns = [
    /N[uú\u00fa]mero:\s*(\d{9,15})/i,
    /mero:\s*(\d{9,15})/i,
    /Manifiesto de carga\s*N[uú\u00fa]mero:\s*(\d{9,15})/i,
    /Manifiesto de carga[\s\S]{0,30}?(\d{9,15})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractDate(text: string): string {
  const m = text.match(/Fecha:\s*([\d/]+)/i);
  if (m) return m[1];
  // Fallback: look for dd/mm/yyyy pattern
  const d = text.match(/(\d{2}\/\d{2}\/\d{4})/);
  return d ? d[1] : new Date().toLocaleDateString('es-AR');
}

function extractGuias(text: string): Guia[] {
  const guias: Guia[] = [];
  const seen = new Set<string>();

  // Primary: number + 15-digit guide starting with 3600 + packages
  const regex1 = /(\d{1,2})\s+(3600\d{11})\s+(\d+)/g;
  let m;
  while ((m = regex1.exec(text)) !== null) {
    if (!seen.has(m[2])) {
      seen.add(m[2]);
      guias.push({ numero: m[2], paquetes: parseInt(m[3]), checked: false, checkedAt: null });
    }
  }

  if (guias.length > 0) return guias;

  // Fallback 1: any 15-digit number starting with 360 followed by package count
  const regex2 = /(360\d{12})\s+(\d+)/g;
  while ((m = regex2.exec(text)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      guias.push({ numero: m[1], paquetes: parseInt(m[2]), checked: false, checkedAt: null });
    }
  }

  if (guias.length > 0) return guias;

  // Fallback 2: just find all 15-digit numbers starting with 360
  const regex3 = /\b(360\d{12})\b/g;
  while ((m = regex3.exec(text)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      guias.push({ numero: m[1], paquetes: 1, checked: false, checkedAt: null });
    }
  }

  return guias;
}

export function parsePdfText(text: string): Manifiesto | null {
  try {
    const numero = extractManifestNumber(text);
    if (!numero) return null;

    const fecha = extractDate(text);

    // Extract branch
    const sucursalMatch = text.match(/(#\d+[^\n\r]*)/);
    const sucursal = sucursalMatch ? sucursalMatch[1].trim() : '';

    // Extract address — line with postal code pattern
    const addressMatch = text.match(/([^\n\r]+,\s*\d{4}\s+[^\n\r,]+,\s*\w{2})/);
    const direccion = addressMatch ? addressMatch[1].trim() : sucursal;

    // Extract email
    const emailMatch = text.match(/([\w.-]+@[\w.-]+\.\w+)/);
    const email = emailMatch ? emailMatch[1] : '';

    // Extract phone — exactly 10 digits, not part of a longer number
    const phoneMatch = text.match(/(?<!\d)(\d{10})(?!\d)/);
    const telefono = phoneMatch ? phoneMatch[1] : '';

    // Extract guides
    const guias = extractGuias(text);
    if (guias.length === 0) return null;

    // Extract weight
    const pesoMatch = text.match(/Peso\s*Total:\s*([\d.,]+)\s*kg/i);
    const pesoTotal = pesoMatch ? pesoMatch[1] + ' kg' : '0 kg';

    // Extract total packages
    const paqMatch = text.match(/Total\s*Paquetes:\s*(\d+)/i);
    const totalPaquetes = paqMatch ? parseInt(paqMatch[1]) : guias.reduce((s, g) => s + g.paquetes, 0);

    const id = 'm-' + numero + '-' + Date.now();

    return {
      id,
      numero,
      fecha,
      sucursal,
      direccion,
      email,
      telefono,
      guias,
      pesoTotal,
      totalPaquetes,
      uploadedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
