import type { SupabaseClient } from '@supabase/supabase-js';
import { aiJsonCompletion } from '@/lib/ai/provider';

const DB_SCHEMA = `
Tablas principales disponibles (PostgreSQL):
- ventas: id, empresa_id, cliente_id, usuario_id, total, estado, created_at
- items_venta: id, venta_id, producto_id, cantidad, precio_unitario, subtotal
- ordenes_compra (compras): id, empresa_id, proveedor_id, numero, estado, total, subtotal, impuestos, notas, metodo_pago, es_credito, created_at, fecha_entrega_esperada
- items_orden_compra: id, orden_compra_id, producto_id, cantidad, precio_unitario, subtotal, cantidad_recibida
- productos: id, empresa_id, nombre, categoria_id, marca_id, precio_venta, precio_costo, stock_actual, stock_minimo, activo
- clientes: id, empresa_id, nombre, telefono, email
- proveedores: id, empresa_id, nombre, telefono
- gastos: id, empresa_id, usuario_id, categoria, monto, concepto, metodo_pago, created_at
- ingresos: id, empresa_id, usuario_id, monto, concepto, metodo_pago, created_at
- categorias: id, empresa_id, nombre
- marcas: id, empresa_id, nombre
- devoluciones: id, empresa_id, venta_id, producto_id, cantidad, motivo, estado, created_at

Nota: Todas las tablas tienen "empresa_id". NUNCA insertes un "WHERE empresa_id = X", la base de datos lo filtrará automáticamente por ti (RLS).
`;

const SQL_GENERATION_PROMPT = `Eres el Agente Analítico SQL de Business AI OS.
Tu tarea es convertir la pregunta del usuario en una consulta SQL válida (SELECT) para PostgreSQL.

Esquema de BD:
${DB_SCHEMA}

Reglas:
1. Retorna ÚNICAMENTE JSON válido con el formato: { "sql": "TU_CONSULTA_SELECT_AQUI" }
2. NO uses Markdown en la salida.
3. Solo están permitidos los SELECT. NUNCA insert, update o delete.
4. No te preocupes por el "empresa_id", las políticas RLS aislarán los datos automáticamente.
5. Puedes hacer JOINs entre tablas.
6. Si te piden fechas, usa los formatos estándar de PostgreSQL. Para consultas de "hoy", usa: created_at::date = CURRENT_DATE.
7. Para comparar nombres de productos, categorías, marcas o clientes, usa SIEMPRE 'ILIKE' con comodines (ej: p.nombre ILIKE '%bateria%') para evitar fallas por variaciones de mayúsculas/minúsculas o palabras parciales.
8. Siempre asume que los nombres de las columnas coinciden con el esquema dado.`;

const SQL_EXPLANATION_PROMPT = `Eres el Director de Operaciones (AI Core). Acabas de ejecutar una consulta analítica en la base de datos para responder a una pregunta del usuario.

Reglas:
1. Se te entregará la pregunta original del usuario y los resultados crudos (JSON) de la base de datos.
2. Explica los resultados de manera natural, breve y profesional, en máximo 2-3 párrafos.
3. Si la respuesta es un número o estadística, resáltalo (usa emojis moderados).
4. No menciones que usaste SQL ni JSON ni bases de datos. Habla como un directivo dando un reporte.
5. Si el JSON está vacío "[]", diles que no hay datos para esa consulta.
6. MUY IMPORTANTE: Retorna ÚNICAMENTE JSON válido con este formato: { "respuesta": "Tu texto aquí" } sin markdown adicional.`;

export async function processDynamicSQL(
  supabase: SupabaseClient,
  usuarioId: string,
  userMessage: string
): Promise<string> {
  try {
    // 1. Generar SQL usando el modelo
    const sqlResponseJson = await aiJsonCompletion({
      systemPrompt: SQL_GENERATION_PROMPT,
      userPrompt: `Pregunta del usuario: "${userMessage}"`,
      maxTokens: 500,
      temperature: 0.1,
    });

    let sqlQuery = '';
    try {
      const parsed = JSON.parse(sqlResponseJson);
      sqlQuery = parsed.sql;
    } catch {
      return 'No pude generar la consulta analítica adecuadamente.';
    }

    if (!sqlQuery || !sqlQuery.trim().toLowerCase().startsWith('select')) {
      return 'Solo puedo realizar consultas de lectura de datos.';
    }

    // 2. Ejecutar SQL en la base de datos usando el RPC seguro con el contexto del usuario
    const { data: resultData, error: rpcError } = await supabase.rpc('execute_ai_sql', {
      sql_query: sqlQuery,
      p_user_id: usuarioId,
    });

    if (rpcError) {
      console.error('[SQL Engine RPC Error]', rpcError);
      return 'Lo siento, hubo un problema técnico ejecutando el reporte. Intenta preguntar de otra forma.';
    }

    // 3. Interpretar los resultados con el LLM
    const explanationResponse = await aiJsonCompletion({
      systemPrompt: SQL_EXPLANATION_PROMPT,
      userPrompt: `Pregunta original: "${userMessage}"\n\nResultados de la BD:\n${JSON.stringify(resultData)}`,
      maxTokens: 1000,
      temperature: 0.7,
    });

    // Como aiJsonCompletion espera JSON por compatibilidad, si queremos texto crudo
    // podemos pedir que lo envuelva en JSON, o parsearlo.
    // Vamos a parsearlo:
    try {
      const parsedEx = JSON.parse(explanationResponse);
      return parsedEx.respuesta || parsedEx.texto || parsedEx.mensaje || explanationResponse;
    } catch {
      // Si el modelo desobedeció y mandó texto puro
      return explanationResponse.replace(/^```json\n|\n```$/g, '').trim();
    }
  } catch (error) {
    console.error('[SQL Engine Error]', error);
    return 'Ocurrió un error al procesar tu consulta dinámica.';
  }
}
