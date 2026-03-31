import { Manifiesto, Guia } from './types';

function extractManifestNumber(text: string): string | null {
  const patterns = [
    /N[uú\u00fa]mero:\s*(\d{9,15})/i,
    /mero:\s*(\d{9,15})/i,
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
  const d = text.match(/(\d{2}\/\d{2}\/\d{4})/);
  return d ? d[1] : new Date().toLocaleDateString('es-AR');
}

function extractGuias(text: string): Guia[] {
  const guias: Guia[] = [];
  const seen = new Set<string>();
  let m;

  // Pattern 1: with spaces — "01 360002931071400 1"
  const regex1 = /(\d{1,2})\s+(3600\d{11})\s+(\d+)/g;
  while ((m = regex1.exec(text)) !== null) {
    if (!seen.has(m[2])) {
      seen.add(m[2]);
      guias.push({ numero: m[2], paquetes: parseInt(m[3]), checked: false, checkedAt: null });
    }
  }
  if (guias.length > 0) return guias;

  // Pattern 2: NO spaces — "013600029294303801"
  const regex2 = /(\d{1,2})(3600\d{11})(\d{1,3})/g;
  while ((m = regex2.exec(text)) !== null) {
    if (!seen.has(m[2])) {
      seen.add(m[2]);
      guias.push({ numero: m[2], paquetes: parseInt(m[3]), checked: false, checkedAt: null });
    }
  }
  if (guias.length > 0) return guias;

  // Pattern 3: just find all 15-digit numbers starting with 3600
  const regex3 = /(3600\d{11})/g;
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

    // Extract branch — #NNNN followed by name, stop before email/phone/numbers
    const sucursalMatch = text.match(/(#\d+\s+[A-Za-zÀ-ÿ\s.]+?)(?=\s+[\w.-]+@|\s+\d{10}|\s+N[uú]mero|\s+-\s)/i);
    const sucursal = sucursalMatch ? sucursalMatch[1].trim() : (() => {
      // Simpler fallback: just #NNNN + next few words
      const simple = text.match(/(#\d+\s+\S+(?:\s+\S+){0,4})/);
      return simple ? simple[1].trim() : '';
    })();

    // Extract address — look for pattern: text, 4-digit postal code, city, 2-letter province
    const addressMatch = text.match(/([\w\s.]+\d+\s*,\s*,?\s*\d{4}\s+[A-Za-zÀ-ÿ\s]+,\s*\w{2})/);
    const direccion = addressMatch ? addressMatch[1].trim() : (() => {
      // Fallback: look for postal code pattern
      const postalMatch = text.match(/(\d{4}\s+[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?,\s*\w{2})/);
      return postalMatch ? postalMatch[1].trim() : '';
    })();

    // Extract email
    const emailMatch = text.match(/([\w.-]+@[\w.-]+\.\w+)/);
    const email = emailMatch ? emailMatch[1] : '';

    // Extract phone — exactly 10 digits, not part of a guide number (not starting with 3600)
    const phoneMatch = text.match(/(?<!\d)((?!3600)\d{10})(?!\d)/);
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
