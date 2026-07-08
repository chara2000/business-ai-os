import { aiJsonCompletion, aiVisionJson } from '@/lib/ai/provider';

export type InvoiceLine = {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

export type ParsedInvoice = {
  proveedor_nombre: string;
  nit: string;
  fecha: string;
  concepto: string;
  subtotal: number;
  iva: number;
  total: number;
  lineas: InvoiceLine[];
  categoria_sugerida: string;
  confianza: number;
  notas: string;
};

const SCHEMA = `{
  "proveedor_nombre": "string",
  "nit": "string",
  "fecha": "YYYY-MM-DD o vacío",
  "concepto": "resumen breve",
  "subtotal": number,
  "iva": number,
  "total": number,
  "lineas": [{ "descripcion": "string", "cantidad": number, "precio_unitario": number, "subtotal": number }],
  "categoria_sugerida": "Operativo|Compras|Servicios|Transporte|Impuestos|Otros",
  "confianza": 0-100,
  "notas": "observaciones del OCR"
}`;

function normalizeInvoice(parsed: ParsedInvoice): ParsedInvoice {
  return {
    proveedor_nombre: parsed.proveedor_nombre ?? '',
    nit: parsed.nit ?? '',
    fecha: parsed.fecha ?? '',
    concepto: parsed.concepto ?? parsed.proveedor_nombre ?? 'Factura escaneada',
    subtotal: Number(parsed.subtotal) || 0,
    iva: Number(parsed.iva) || 0,
    total: Number(parsed.total) || Number(parsed.subtotal) + Number(parsed.iva) || 0,
    lineas: Array.isArray(parsed.lineas) ? parsed.lineas : [],
    categoria_sugerida: parsed.categoria_sugerida ?? 'Compras',
    confianza: Number(parsed.confianza) || 70,
    notas: parsed.notas ?? '',
  };
}

export async function parseInvoiceFromImage(base64: string, mimeType: string): Promise<ParsedInvoice> {
  const raw = await aiVisionJson({
    systemPrompt: `Eres un extractor OCR de facturas colombianas para un ERP.
Devuelve JSON con esta estructura: ${SCHEMA}
Usa números sin símbolos de moneda. Si no encuentras un dato, usa 0 o string vacío.`,
    userPrompt: 'Extrae los datos de esta factura o comprobante:',
    imageBase64: base64,
    mimeType,
  });

  return normalizeInvoice(JSON.parse(raw) as ParsedInvoice);
}

export async function parseInvoiceFromPdfText(text: string): Promise<ParsedInvoice> {
  const raw = await aiJsonCompletion({
    systemPrompt: `Extrae datos de factura colombiana. Estructura: ${SCHEMA}`,
    userPrompt: text.slice(0, 12000),
  });

  return normalizeInvoice(JSON.parse(raw) as ParsedInvoice);
}
