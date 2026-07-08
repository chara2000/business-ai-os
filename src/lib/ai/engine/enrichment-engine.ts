import type { SupabaseClient } from '@supabase/supabase-js';
import { getTasaIva } from '@/lib/tax';
import { getKnowledgeHints } from './knowledge-engine';
import type { EnrichedField, ParsedIntent } from './types';
import { FIELD_LABELS } from './types';

type EnrichmentContext = {
  categorias: { id: string; nombre: string }[];
  marcas: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
  productos: { id: string; nombre: string; categoria_id?: string; marca_id?: string; proveedor_id?: string }[];
  empresa: { nombre?: string; moneda?: string };
  memory: Record<string, string>;
  tasaIva: number;
};

async function loadEnrichmentContext(supabase: SupabaseClient, empresaId: string): Promise<EnrichmentContext> {
  const [catRes, marRes, provRes, prodRes, empRes, memRes] = await Promise.all([
    supabase.from('categorias').select('id, nombre').eq('empresa_id', empresaId).limit(50),
    supabase.from('marcas').select('id, nombre').eq('empresa_id', empresaId).limit(50),
    supabase.from('proveedores').select('id, nombre').eq('empresa_id', empresaId).eq('activo', true).limit(30),
    supabase.from('productos').select('id, nombre, categoria_id, marca_id').eq('empresa_id', empresaId).limit(100),
    supabase.from('empresas').select('nombre, moneda, configuracion').eq('id', empresaId).single(),
    supabase.from('ai_business_memory').select('memory_key, memory_value').eq('empresa_id', empresaId).limit(100),
  ]);

  const memory: Record<string, string> = {};
  for (const row of memRes.data ?? []) {
    const val = row.memory_value as { value?: string } | string;
    memory[row.memory_key] = typeof val === 'string' ? val : String(val?.value ?? '');
  }

  return {
    categorias: catRes.data ?? [],
    marcas: marRes.data ?? [],
    proveedores: provRes.data ?? [],
    productos: prodRes.data ?? [],
    empresa: empRes.data ?? {},
    memory,
    tasaIva: getTasaIva(empRes.data),
  };
}

function matchByName<T extends { id: string; nombre: string }>(list: T[], name?: string): T | null {
  if (!name) return null;
  const n = name.toLowerCase();
  return list.find((x) => x.nombre.toLowerCase().includes(n) || n.includes(x.nombre.toLowerCase())) ?? null;
}

function field(
  key: string,
  value: unknown,
  source: EnrichedField['source'],
  opts?: { required?: boolean },
): EnrichedField {
  const display = value == null || value === '' ? '—' : String(value);
  return {
    key,
    label: FIELD_LABELS[key] ?? key,
    value,
    displayValue: key === 'tasa_iva' || key === 'iva' ? `${value}%` : display,
    source,
    required: opts?.required,
    editable: true,
  };
}

export async function enrichIntent(
  supabase: SupabaseClient,
  empresaId: string,
  intent: ParsedIntent,
): Promise<{ datos: Record<string, unknown>; campos: EnrichedField[] }> {
  const ctx = await loadEnrichmentContext(supabase, empresaId);
  const datos = { ...intent.datos };
  const campos: EnrichedField[] = [];
  const nombre = String(datos.nombre ?? datos.producto ?? '').trim();

  if (intent.accion === 'crear_producto' || intent.accion === 'actualizar_producto') {
    if (nombre && !datos.nombre) datos.nombre = nombre;

    const hints = getKnowledgeHints(nombre || String(datos.nombre ?? ''));
    const memKey = `producto:${String(datos.nombre ?? '').toLowerCase()}`;

    // Categoría
    let categoriaNombre = String(datos.categoria ?? '');
    if (!categoriaNombre && ctx.memory[`${memKey}:categoria`]) {
      categoriaNombre = ctx.memory[`${memKey}:categoria`];
    }
    if (!categoriaNombre && hints.categoria) categoriaNombre = hints.categoria;
    const catMatch = matchByName(ctx.categorias, categoriaNombre);
    if (catMatch) {
      datos.categoria_id = catMatch.id;
      datos.categoria = catMatch.nombre;
      campos.push(field('categoria', catMatch.nombre, catMatch.nombre === hints.categoria ? 'inferido' : 'historial'));
    } else if (categoriaNombre) {
      datos.categoria = categoriaNombre;
      campos.push(field('categoria', categoriaNombre, 'inferido'));
    }

    // Proveedor
    let provNombre = String(datos.proveedor ?? '');
    if (!provNombre && ctx.memory[`${memKey}:proveedor`]) {
      provNombre = ctx.memory[`${memKey}:proveedor`];
    }
    const provMatch = matchByName(ctx.proveedores, provNombre);
    if (provMatch) {
      datos.proveedor_id = provMatch.id;
      datos.proveedor = provMatch.nombre;
      campos.push(field('proveedor', provMatch.nombre, provNombre ? 'historial' : 'inferido'));
    } else if (provNombre) {
      datos.proveedor = provNombre;
      campos.push(field('proveedor', provNombre, 'usuario'));
    } else if (ctx.proveedores.length === 1) {
      datos.proveedor_id = ctx.proveedores[0].id;
      datos.proveedor = ctx.proveedores[0].nombre;
      campos.push(field('proveedor', ctx.proveedores[0].nombre, 'defecto'));
    }

    // Marca
    const marcaNombre = String(datos.marca ?? ctx.memory[`${memKey}:marca`] ?? '');
    const marcaMatch = matchByName(ctx.marcas, marcaNombre);
    if (marcaMatch) {
      datos.marca_id = marcaMatch.id;
      datos.marca = marcaMatch.nombre;
      campos.push(field('marca', marcaMatch.nombre, 'historial'));
    } else if (marcaNombre) {
      datos.marca = marcaNombre;
      campos.push(field('marca', marcaNombre, 'usuario'));
    }

    if (datos.nombre) campos.unshift(field('nombre', datos.nombre, 'usuario', { required: true }));
    if (datos.cantidad != null) campos.push(field('cantidad', datos.cantidad, 'usuario', { required: true }));
    else if (datos.stock_actual != null) campos.push(field('cantidad', datos.stock_actual, 'usuario'));

    const unidad = String(datos.unidad ?? hints.unidad ?? 'unidad');
    datos.unidad = unidad;
    campos.push(field('unidad', unidad, datos.unidad === hints.unidad ? 'inferido' : 'defecto'));

    datos.tasa_iva = datos.tasa_iva ?? ctx.tasaIva;
    campos.push(field('tasa_iva', `${(Number(datos.tasa_iva) * 100).toFixed(0)}%`, 'defecto'));

    datos.stock_minimo = datos.stock_minimo ?? ctx.memory[`${memKey}:stock_minimo`] ?? 10;
    campos.push(field('stock_minimo', datos.stock_minimo, 'defecto'));

    datos.bodega = datos.bodega ?? 'Central';
    datos.sucursal = datos.sucursal ?? 'Principal';
    campos.push(field('bodega', datos.bodega, 'defecto'));
    campos.push(field('sucursal', datos.sucursal, 'defecto'));

    if (datos.precio_costo != null) campos.push(field('precio_costo', datos.precio_costo, 'usuario'));
    if (datos.precio_venta != null) campos.push(field('precio_venta', datos.precio_venta, 'usuario'));
    if (datos.codigo_barras) campos.push(field('codigo_barras', datos.codigo_barras, 'usuario'));
    if (datos.descripcion) campos.push(field('descripcion', datos.descripcion, 'usuario'));
  }

  if (intent.accion === 'crear_cliente') {
    if (datos.nombre) campos.push(field('nombre', datos.nombre, 'usuario', { required: true }));
    if (datos.telefono) campos.push(field('telefono', datos.telefono, 'usuario'));
    if (datos.email) campos.push(field('email', datos.email, 'usuario'));
  }

  if (intent.accion === 'registrar_abono') {
    if (datos.cliente) campos.push(field('cliente', datos.cliente, 'usuario', { required: true }));
    if (datos.monto) campos.push(field('monto', datos.monto, 'usuario', { required: true }));
    datos.metodo_pago = datos.metodo_pago ?? 'efectivo';
    campos.push(field('metodo_pago', datos.metodo_pago, 'defecto'));
  }

  if (intent.accion === 'crear_venta') {
    if (datos.producto || datos.nombre) campos.push(field('producto', datos.producto ?? datos.nombre, 'usuario', { required: true }));
    datos.cantidad = datos.cantidad ?? 1;
    campos.push(field('cantidad', datos.cantidad, datos.cantidad === 1 ? 'defecto' : 'usuario'));
  }

  return { datos, campos };
}

export async function saveBusinessMemory(
  supabase: SupabaseClient,
  empresaId: string,
  datos: Record<string, unknown>,
) {
  const nombre = String(datos.nombre ?? '').toLowerCase();
  if (!nombre) return;
  const base = `producto:${nombre}`;
  const pairs: [string, string][] = [];
  if (datos.categoria) pairs.push([`${base}:categoria`, String(datos.categoria)]);
  if (datos.proveedor) pairs.push([`${base}:proveedor`, String(datos.proveedor)]);
  if (datos.marca) pairs.push([`${base}:marca`, String(datos.marca)]);
  if (datos.stock_minimo) pairs.push([`${base}:stock_minimo`, String(datos.stock_minimo)]);

  for (const [key, value] of pairs) {
    await supabase.from('ai_business_memory').upsert({
      empresa_id: empresaId,
      memory_key: key,
      memory_value: { value },
      hit_count: 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'empresa_id,memory_key' });
  }
}
