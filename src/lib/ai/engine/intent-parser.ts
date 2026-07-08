import { aiChatCompletion } from '@/lib/ai/provider';
import type { ParsedIntent } from './types';

const INTENT_PROMPT = `Eres el Intent Parser de Business AI OS. SOLO interpretas intención. NUNCA ejecutas acciones.

Responde ÚNICAMENTE con JSON válido (sin markdown):
{
  "accion": "crear_producto|actualizar_producto|crear_venta|crear_cliente|crear_proveedor|registrar_abono|crear_compra|registrar_gasto|registrar_ingreso|crear_devolucion|consultar_ventas_hoy|consultar_stock_bajo|consultar_deudores|consultar_clientes",
  "entidad": "producto|venta|cliente|proveedor|credito|compra|gasto|ingreso|devolucion|consulta",
  "datos": { },
  "es_consulta": false,
  "es_confirmacion": false,
  "es_cancelacion": false,
  "es_correccion": false,
  "correccion_campo": null,
  "correccion_valor": null,
  "mensaje_usuario": "respuesta breve amigable en español",
  "confianza": 0.9
}

REGLAS:
- Extrae solo lo que el usuario dijo explícitamente en "datos".
- es_consulta=true solo para consultar_*.
- es_confirmacion=true si dice: confirmar, confirmo, sí ejecuta, dale, ok guardar.
- es_cancelacion=true si dice: cancelar, no, olvida, detente.
- es_correccion=true si modifica un campo: "cambia proveedor por X", "la categoría es Y".
- correccion_campo: nombre del campo en snake_case español.
- No inventes precios ni IDs.`;

export function detectLocalIntent(message: string, hasSession: boolean): Partial<ParsedIntent> | null {
  const t = message.trim().toLowerCase();
  if (['confirmar', 'confirmo', 'sí', 'si', 'ok', 'dale', 'guardar', 'ejecutar'].includes(t)) {
    return { es_confirmacion: true, accion: '', entidad: 'consulta', datos: {}, es_consulta: false, es_cancelacion: false, es_correccion: false };
  }
  if (['cancelar', 'cancela', 'no', 'detener', 'olvida'].includes(t)) {
    return { es_cancelacion: true, accion: '', entidad: 'consulta', datos: {}, es_consulta: false, es_confirmacion: false, es_correccion: false };
  }
  if (hasSession) {
    const corrMatch = t.match(/(?:cambia|cambiar|modifica|pon|coloca|actualiza)\s+(?:el\s+|la\s+)?(.+?)\s+(?:por|a|en)\s+(.+)/i)
      || t.match(/(?:la\s+|el\s+)(.+?)\s+(?:debe ser|es)\s+(.+)/i);
    if (corrMatch) {
      return {
        es_correccion: true,
        correccion_campo: corrMatch[1].trim(),
        correccion_valor: corrMatch[2].trim(),
        accion: '', entidad: 'consulta', datos: {},
        es_consulta: false, es_confirmacion: false, es_cancelacion: false,
      };
    }
  }
  return null;
}

export async function parseIntent(
  message: string,
  contextHint: string,
  hasSession: boolean,
): Promise<ParsedIntent> {
  const local = detectLocalIntent(message, hasSession);
  if (local?.es_confirmacion || local?.es_cancelacion || local?.es_correccion) {
    return local as ParsedIntent;
  }

  const { text } = await aiChatCompletion({
    systemPrompt: INTENT_PROMPT,
    messages: [{ role: 'user', content: `CONTEXTO:\n${contextHint}\n\nMENSAJE:\n${message}` }],
    maxTokens: 512,
    temperature: 0.2,
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      accion: 'consultar_resumen',
      entidad: 'consulta',
      datos: {},
      es_consulta: true,
      es_confirmacion: false,
      es_cancelacion: false,
      es_correccion: false,
      mensaje_usuario: text || 'No pude interpretar tu solicitud.',
      confianza: 0.3,
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as ParsedIntent;
    parsed.es_consulta = parsed.es_consulta || parsed.accion?.startsWith('consultar_') || false;
    return parsed;
  } catch {
    return {
      accion: 'consultar_resumen',
      entidad: 'consulta',
      datos: {},
      es_consulta: true,
      es_confirmacion: false,
      es_cancelacion: false,
      es_correccion: false,
      mensaje_usuario: 'Hubo un error interpretando tu mensaje.',
      confianza: 0,
    };
  }
}
