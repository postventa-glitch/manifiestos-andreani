import { Manifiesto, Guia } from './types';

export function parsePdfText(text: string): Manifiesto | null {
  try {
    // Extract manifest number
    const numMatch = text.match(/N[uú]mero:\s*(\d+)/i);
    if (!numMatch) return null;
    const numero = numMatch[1];

    // Extract date
    const fechaMatch = text.match(/Fecha:\s*([\d/]+)/i);
    const fecha = fechaMatch ? fechaMatch[1] : new Date().toLocaleDateString('es-AR');

    // Extract branch
    const sucursalMatch = text.match(/(#\d+\s+[^\n]+)/);
    const sucursal = sucursalMatch ? sucursalMatch[1].trim() : '';

    // Extract address — line after branch info
    const addressMatch = text.match(/(?:#\d+[^\n]+\n)([^\n]+(?:Puerto|Buenos|Córdoba|Rosario|Mendoza|Madryn)[^\n]*)/i);
    const direccion = addressMatch ? addressMatch[1].trim() : sucursal;

    // Extract email
    const emailMatch = text.match(/([\w.-]+@[\w.-]+\.\w+)/);
    const email = emailMatch ? emailMatch[1] : '';

    // Extract phone
    const phoneMatch = text.match(/(\d{10,})/);
    const telefono = phoneMatch ? phoneMatch[1] : '';

    // Extract guide numbers — pattern: 2-digit number, then 15-digit guide, then package count
    const guias: Guia[] = [];
    const guiaRegex = /(\d{2})\s+(3\d{14})\s+(\d+)/g;
    let match;
    while ((match = guiaRegex.exec(text)) !== null) {
      guias.push({
        numero: match[2],
        paquetes: parseInt(match[3]),
        checked: false,
        checkedAt: null,
      });
    }

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
