import { aiVisionJson } from '@/lib/ai/provider';

export type ImageAnalysisResult =
  | {
      tipo: 'factura';
      datos: {
        nombre?: string;
        cantidad?: number;
        precio_costo?: number;
        proveedor?: string;
        precio_venta?: number;
      };
      mensaje?: string;
    }
  | {
      tipo: 'producto_foto';
      datos: {
        nombre?: string;
        marca?: string;
        categoria?: string;
      };
      mensaje?: string;
    }
  | { tipo: 'desconocido'; mensaje: string };

const VISION_PROMPT = `Analizas imágenes para inventario de ferretería/tienda en Colombia.
Clasifica la imagen y extrae datos. Responde JSON:
{
  "tipo_imagen": "factura" | "producto_foto" | "desconocido",
  "nombre": null,
  "cantidad": null,
  "precio_costo": null,
  "precio_venta": null,
  "proveedor": null,
  "marca": null,
  "categoria": null,
  "mensaje": "breve explicación en español"
}
REGLAS:
- factura: extrae productos, cantidades, costos y proveedor del documento.
- producto_foto: identifica qué producto es, marca y categoría (Eléctrico, Herramientas, etc.).
- Montos en pesos colombianos (número entero).
- No inventes precio de venta en facturas si no está visible.`;

export async function analyzeTelegramImage(
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<ImageAnalysisResult> {
  const base64 = Buffer.from(buffer).toString('base64');

  try {
    const raw = await aiVisionJson({
      systemPrompt: VISION_PROMPT,
      userPrompt: 'Analiza esta imagen para registro de inventario.',
      imageBase64: base64,
      mimeType,
    });

    const data = JSON.parse(raw) as Record<string, unknown>;
    const tipo = String(data.tipo_imagen ?? 'desconocido');

    if (tipo === 'factura') {
      return {
        tipo: 'factura',
        datos: {
          nombre: data.nombre ? String(data.nombre) : undefined,
          cantidad: data.cantidad != null ? Number(data.cantidad) : undefined,
          precio_costo: data.precio_costo != null ? Number(data.precio_costo) : undefined,
          proveedor: data.proveedor ? String(data.proveedor) : undefined,
          precio_venta: data.precio_venta != null ? Number(data.precio_venta) : undefined,
        },
        mensaje: data.mensaje ? String(data.mensaje) : undefined,
      };
    }

    if (tipo === 'producto_foto') {
      return {
        tipo: 'producto_foto',
        datos: {
          nombre: data.nombre ? String(data.nombre) : undefined,
          marca: data.marca ? String(data.marca) : undefined,
          categoria: data.categoria ? String(data.categoria) : undefined,
        },
        mensaje: data.mensaje ? String(data.mensaje) : undefined,
      };
    }

    return {
      tipo: 'desconocido',
      mensaje: data.mensaje ? String(data.mensaje) : 'No pude identificar la imagen. Envía una factura o foto del producto.',
    };
  } catch {
    return { tipo: 'desconocido', mensaje: 'Error al analizar la imagen. Intenta de nuevo.' };
  }
}

export function buildMessageFromImageAnalysis(analysis: ImageAnalysisResult): {
  message: string;
  prefill?: Record<string, unknown>;
} {
  if (analysis.tipo === 'desconocido') {
    return { message: analysis.mensaje };
  }

  if (analysis.tipo === 'factura') {
    const d = analysis.datos;
    const parts = ['Registra producto desde factura'];
    if (d.nombre) parts.push(`nombre ${d.nombre}`);
    if (d.cantidad) parts.push(`cantidad ${d.cantidad}`);
    if (d.precio_costo) parts.push(`compra ${d.precio_costo}`);
    if (d.proveedor) parts.push(`proveedor ${d.proveedor}`);
    if (d.precio_venta) parts.push(`venta ${d.precio_venta}`);
    return {
      message: parts.join(', '),
      prefill: {
        nombre: d.nombre,
        cantidad: d.cantidad,
        precio_costo: d.precio_costo,
        precio_venta: d.precio_venta,
        proveedor: d.proveedor,
      },
    };
  }

  const d = analysis.datos;
  const prefill: Record<string, unknown> = {};
  if (d.nombre) prefill.nombre = d.nombre;
  if (d.marca) prefill.marca = d.marca;
  if (d.categoria) prefill.categoria = d.categoria;

  return {
    message: d.nombre ? `Agrega producto ${d.nombre}` : 'Agrega producto detectado en foto',
    prefill,
  };
}

export function followUpForImageAnalysis(analysis: ImageAnalysisResult): string | null {
  if (analysis.tipo === 'producto_foto') {
    return '📷 Detecté el producto en la foto.\n\n¿Cuántas unidades deseas registrar?\n\nTambién puedes indicar precio de compra y venta por voz o texto.';
  }
  if (analysis.tipo === 'factura') {
    const d = analysis.datos;
    if (!d.precio_venta) {
      return '📸 Datos extraídos de la factura.\n\nSolo falta el precio de venta. ¿En cuánto lo venderás?';
    }
  }
  return null;
}
