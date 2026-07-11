import type { SupabaseClient } from '@supabase/supabase-js';
import { inferCategoryFromText } from './knowledge-engine';

async function bumpMemory(
  supabase: SupabaseClient,
  empresaId: string,
  memoryKey: string,
  value: string,
) {
  const { data: existing } = await supabase
    .from('ai_business_memory')
    .select('hit_count')
    .eq('empresa_id', empresaId)
    .eq('memory_key', memoryKey)
    .maybeSingle();

  await supabase.from('ai_business_memory').upsert({
    empresa_id: empresaId,
    memory_key: memoryKey,
    memory_value: { value },
    hit_count: (existing?.hit_count ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'empresa_id,memory_key' });
}

export async function readBusinessMemory(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('ai_business_memory')
    .select('memory_key, memory_value, hit_count')
    .eq('empresa_id', empresaId)
    .order('hit_count', { ascending: false })
    .limit(200);

  const memory: Record<string, string> = {};
  for (const row of data ?? []) {
    const val = row.memory_value as { value?: string } | string;
    memory[row.memory_key] = typeof val === 'string' ? val : String(val?.value ?? '');
    if (row.hit_count > 2) {
      memory[`_weight:${row.memory_key}`] = String(row.hit_count);
    }
  }
  return memory;
}

export async function saveBusinessMemory(
  supabase: SupabaseClient,
  empresaId: string,
  datos: Record<string, unknown>,
) {
  const nombre = String(datos.nombre ?? datos.producto ?? '').toLowerCase().trim();
  if (!nombre) return;

  const base = `producto:${nombre}`;
  const pairs: [string, string][] = [];
  if (datos.categoria) pairs.push([`${base}:categoria`, String(datos.categoria)]);
  if (datos.proveedor) pairs.push([`${base}:proveedor`, String(datos.proveedor)]);
  if (datos.marca) pairs.push([`${base}:marca`, String(datos.marca)]);
  if (datos.stock_minimo != null) pairs.push([`${base}:stock_minimo`, String(datos.stock_minimo)]);

  for (const [key, value] of pairs) {
    await bumpMemory(supabase, empresaId, key, value);
  }

  const inferred = inferCategoryFromText(nombre);
  if (datos.categoria && inferred) {
    const keyword = nombre.split(/\s+/)[0];
    if (keyword.length > 3) {
      await bumpMemory(supabase, empresaId, `keyword:${keyword}:categoria`, String(datos.categoria));
    }
  }
}

export async function learnFromCorrection(
  supabase: SupabaseClient,
  empresaId: string,
  fieldKey: string,
  value: unknown,
  sessionDatos: Record<string, unknown>,
) {
  const nombre = String(sessionDatos.nombre ?? sessionDatos.producto ?? '').toLowerCase();
  if (!nombre) return;

  if (fieldKey === 'categoria' && value) {
    await bumpMemory(supabase, empresaId, `producto:${nombre}:categoria`, String(value));
    const kw = nombre.split(/\s+/).find((w) => w.length > 3);
    if (kw) await bumpMemory(supabase, empresaId, `keyword:${kw}:categoria`, String(value));
  }
  if (fieldKey === 'proveedor' && value) {
    await bumpMemory(supabase, empresaId, `producto:${nombre}:proveedor`, String(value));
  }
  if (fieldKey === 'marca' && value) {
    await bumpMemory(supabase, empresaId, `producto:${nombre}:marca`, String(value));
  }
}
