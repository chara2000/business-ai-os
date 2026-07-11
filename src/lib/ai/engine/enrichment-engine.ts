import type { SupabaseClient } from '@supabase/supabase-js';
import { getTasaIva } from '@/lib/tax';
import { previewProductCodigo } from '@/lib/products/codigo';
import { getKnowledgeHints } from './knowledge-engine';
import { readBusinessMemory } from './business-memory';
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
    readBusinessMemory(supabase, empresaId),
  ]);

  const memory = memRes;

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

    const keyword = String(datos.nombre ?? '').toLowerCase().split(/\s+/).find((w) => w.length > 3);
    const keywordCat = keyword ? ctx.memory[`keyword:${keyword}:categoria`] : null;

    // Categoría
    let categoriaNombre = String(datos.categoria ?? '');
    if (!categoriaNombre && ctx.memory[`${memKey}:categoria`]) {
      categoriaNombre = ctx.memory[`${memKey}:categoria`];
    }
    if (!categoriaNombre && keywordCat) categoriaNombre = keywordCat;
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
    const marcaNombre = String(datos.marca ?? ctx.memory[`${memKey}:marca`] ?? hints.marca ?? '');
    const marcaMatch = matchByName(ctx.marcas, marcaNombre);
    if (marcaMatch) {
      datos.marca_id = marcaMatch.id;
      datos.marca = marcaMatch.nombre;
      campos.push(field('marca', marcaMatch.nombre, marcaNombre ? 'historial' : 'inferido'));
    } else if (marcaNombre) {
      datos.marca = marcaNombre;
      campos.push(field('marca', marcaNombre, hints.marca === marcaNombre ? 'inferido' : 'usuario'));
    }

    if (!datos.codigo) datos.codigo = previewProductCodigo();
    campos.push(field('codigo', datos.codigo, 'defecto'));

    if (datos.nombre) campos.unshift(field('nombre', datos.nombre, 'usuario', { required: true }));
    if (datos.cantidad != null) campos.push(field('cantidad', datos.cantidad, 'usuario', { required: true }));
    else if (datos.stock_actual != null) campos.push(field('cantidad', datos.stock_actual, 'usuario'));

    const unidad = String(datos.unidad ?? hints.unidad ?? 'unidad');
    datos.unidad = unidad;
    campos.push(field('unidad', unidad, datos.unidad === hints.unidad ? 'inferido' : 'defecto'));

    datos.tasa_iva = datos.tasa_iva ?? ctx.tasaIva;
    campos.push(field('tasa_iva', Number(datos.tasa_iva) * 100, 'defecto'));

    datos.stock_minimo = datos.stock_minimo ?? ctx.memory[`${memKey}:stock_minimo`] ?? 5;
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
    if (datos.cliente) campos.push(field('cliente', datos.cliente, 'usuario'));
    datos.cantidad = datos.cantidad ?? 1;
    campos.push(field('cantidad', datos.cantidad, datos.cantidad === 1 ? 'defecto' : 'usuario'));
    if (!datos.metodo_pago) datos.metodo_pago = datos.es_credito ? 'credito' : 'efectivo';
    campos.push(field('metodo_pago', datos.metodo_pago, 'defecto'));
  }

  if (intent.accion === 'crear_compra') {
    const prod = String(datos.nombre ?? datos.producto ?? '').trim();
    if (prod) {
      datos.nombre = prod;
      campos.push(field('nombre', prod, 'usuario', { required: true }));
    }
    if (datos.cantidad != null) campos.push(field('cantidad', datos.cantidad, 'usuario', { required: true }));
    if (datos.proveedor) campos.push(field('proveedor', datos.proveedor, 'usuario', { required: true }));
    if (datos.precio_costo != null) campos.push(field('precio_costo', datos.precio_costo, 'usuario', { required: true }));
    datos.metodo_pago = datos.metodo_pago ?? (datos.es_credito ? 'credito' : 'efectivo');
    campos.push(field('metodo_pago', datos.metodo_pago, datos.es_credito ? 'usuario' : 'defecto'));
    datos.bodega = datos.bodega ?? 'Central';
    campos.push(field('bodega', datos.bodega, 'defecto'));
    datos.sucursal = datos.sucursal ?? 'Principal';
    campos.push(field('sucursal', datos.sucursal, 'defecto'));
    if (datos.notas) campos.push(field('notas', datos.notas, 'usuario'));
  }

  if (intent.accion === 'crear_devolucion') {
    if (datos.cliente) campos.push(field('cliente', datos.cliente, 'usuario', { required: true }));
    if (datos.producto ?? datos.nombre) campos.push(field('producto', datos.producto ?? datos.nombre, 'usuario', { required: true }));
    datos.cantidad = datos.cantidad ?? 1;
    campos.push(field('cantidad', datos.cantidad, 'usuario', { required: true }));
    if (datos.motivo) campos.push(field('motivo', datos.motivo, 'usuario'));
    else campos.push(field('motivo', '', 'pendiente', { required: true }));
    datos.estado = datos.estado ?? 'devuelto_inventario';
    campos.push(field('estado', datos.estado, 'inferido'));
  }

  if (intent.accion === 'registrar_gasto') {
    const concepto = String(datos.concepto ?? datos.nombre ?? datos.descripcion ?? '').trim();
    if (concepto) campos.push(field('concepto', concepto, 'usuario', { required: true }));
    if (datos.monto != null) campos.push(field('monto', datos.monto, 'usuario', { required: true }));
    datos.categoria = datos.categoria ?? 'general';
    campos.push(field('categoria', datos.categoria, 'defecto'));
    datos.metodo_pago = datos.metodo_pago ?? 'efectivo';
    campos.push(field('metodo_pago', datos.metodo_pago, 'defecto'));
    if (datos.proveedor) campos.push(field('proveedor', datos.proveedor, 'usuario'));
    if (datos.notas) campos.push(field('notas', datos.notas, 'usuario'));
  }

  if (intent.accion === 'registrar_ingreso') {
    const concepto = String(datos.concepto ?? datos.nombre ?? datos.descripcion ?? '').trim();
    if (concepto) campos.push(field('concepto', concepto, 'usuario', { required: true }));
    if (datos.monto != null) campos.push(field('monto', datos.monto, 'usuario', { required: true }));
    datos.metodo_pago = datos.metodo_pago ?? 'efectivo';
    campos.push(field('metodo_pago', datos.metodo_pago, 'defecto'));
  }

  if (intent.accion === 'crear_proveedor') {
    if (datos.nombre) campos.push(field('nombre', datos.nombre, 'usuario', { required: true }));
    if (datos.telefono) campos.push(field('telefono', datos.telefono, 'usuario'));
    if (datos.email) campos.push(field('email', datos.email, 'usuario'));
    if (datos.nit) campos.push(field('nit', datos.nit, 'usuario'));
    if (datos.ciudad) campos.push(field('ciudad', datos.ciudad, 'usuario'));
  }

  if (intent.accion === 'crear_categoria') {
    const nombreCat = String(datos.nombre ?? datos.categoria ?? '').trim();
    if (nombreCat) campos.push(field('nombre', nombreCat, 'usuario', { required: true }));
    if (datos.descripcion) campos.push(field('descripcion', datos.descripcion, 'usuario'));
  }

  if (intent.accion === 'crear_marca') {
    const nombreMarca = String(datos.nombre ?? datos.marca ?? '').trim();
    if (nombreMarca) campos.push(field('nombre', nombreMarca, 'usuario', { required: true }));
  }

  if (intent.accion === 'ajustar_inventario') {
    const prod = String(datos.nombre ?? datos.producto ?? '').trim();
    if (prod) campos.push(field('nombre', prod, 'usuario', { required: true }));
    if (datos.cantidad != null) campos.push(field('cantidad', datos.cantidad, 'usuario', { required: true }));
    if (datos.motivo) campos.push(field('motivo', datos.motivo, 'usuario'));
    else {
      datos.motivo = 'Ajuste manual';
      campos.push(field('motivo', datos.motivo, 'defecto'));
    }
  }

  if (intent.accion === 'buscar_cliente' || intent.accion === 'actualizar_cliente') {
    const clienteNombre = String(datos.nombre ?? datos.cliente ?? '').trim();
    if (clienteNombre) campos.push(field('nombre', clienteNombre, 'usuario', { required: true }));
    if (datos.telefono) campos.push(field('telefono', datos.telefono, 'usuario'));
    if (datos.email) campos.push(field('email', datos.email, 'usuario'));
  }

  if (intent.accion === 'crear_empleado') {
    if (datos.nombre) campos.push(field('nombre', datos.nombre, 'usuario', { required: true }));
    if (datos.email) campos.push(field('email', datos.email, 'usuario'));
    if (datos.rol) campos.push(field('rol', datos.rol, 'usuario'));
  }

  return { datos, campos };
}

export { saveBusinessMemory } from './business-memory';
