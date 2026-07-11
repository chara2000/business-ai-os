import type { EnrichedField, ParsedIntent } from './types';

export type EngineChannel = 'web' | 'telegram';

/** Campos obligatorios en Telegram para registrar producto */
export const TELEGRAM_PRODUCT_REQUIRED = [
  'nombre',
  'cantidad',
  'precio_costo',
  'precio_venta',
  'categoria',
] as const;

const REQUIRED_BY_ACTION: Record<string, string[]> = {
  crear_producto: ['nombre'],
  actualizar_producto: ['nombre'],
  ajustar_inventario: ['nombre', 'cantidad'],
  crear_cliente: ['nombre'],
  buscar_cliente: ['nombre'],
  actualizar_cliente: ['nombre'],
  crear_venta: ['producto'],
  registrar_abono: ['cliente', 'monto'],
  crear_proveedor: ['nombre'],
  crear_compra: ['nombre', 'cantidad', 'proveedor', 'precio_costo'],
  crear_devolucion: ['cliente', 'producto', 'cantidad', 'motivo'],
  registrar_gasto: ['concepto', 'monto'],
  registrar_ingreso: ['concepto', 'monto'],
  crear_categoria: ['nombre'],
  crear_marca: ['nombre'],
  crear_empleado: ['nombre', 'email'],
};

const OPTIONAL_PROMPT_BY_ACTION: Record<string, string[]> = {
  crear_producto: ['precio_costo', 'precio_venta'],
};

export type RulesResult = {
  valido: boolean;
  campos_pendientes: string[];
  errores: string[];
  warnings: string[];
  listo_para_confirmar: boolean;
};

function getDatosValue(datos: Record<string, unknown>, key: string): unknown {
  if (key === 'precio_costo') return datos.precio_costo ?? datos.precio_compra;
  if (key === 'producto') return datos.producto ?? datos.nombre;
  if (key === 'nombre' && datos.producto) return datos.producto;
  return datos[key];
}

function isFilled(datos: Record<string, unknown>, campos: EnrichedField[], key: string): boolean {
  const val = getDatosValue(datos, key);
  if (key === 'categoria') {
    if (val != null && val !== '') return true;
    const catField = campos.find((c) => c.key === 'categoria');
    return !!(catField?.value && catField.source !== 'pendiente');
  }
  if (val == null || val === '') return false;
  if (['cantidad', 'precio_costo', 'precio_venta', 'monto'].includes(key) && Number(val) <= 0) return false;
  return true;
}

function validateTelegramProduct(
  datos: Record<string, unknown>,
  campos: EnrichedField[],
  permisos: string[],
): RulesResult {
  const errores: string[] = [];
  const warnings: string[] = [];
  const campos_pendientes: string[] = [];

  for (const key of TELEGRAM_PRODUCT_REQUIRED) {
    if (!isFilled(datos, campos, key)) campos_pendientes.push(key);
  }

  if (permisos.length && !permisos.includes('inventario') && !permisos.includes('*')) {
    errores.push('No tienes permiso para gestionar inventario.');
  }
  if (Number(datos.cantidad) < 0) errores.push('La cantidad no puede ser negativa.');

  const nombre = String(datos.nombre ?? '');
  if (nombre.length > 200) warnings.push('El nombre es muy largo.');

  return {
    valido: errores.length === 0,
    campos_pendientes,
    errores,
    warnings,
    listo_para_confirmar: errores.length === 0 && campos_pendientes.length === 0,
  };
}

export function validateBusinessRules(
  intent: ParsedIntent,
  datos: Record<string, unknown>,
  campos: EnrichedField[],
  permisos: string[],
  channel: EngineChannel = 'web',
): RulesResult {
  const errores: string[] = [];
  const warnings: string[] = [];
  const campos_pendientes: string[] = [];

  if (intent.es_consulta) {
    return { valido: true, campos_pendientes: [], errores: [], warnings: [], listo_para_confirmar: true };
  }

  if (channel === 'telegram' && intent.accion === 'crear_producto') {
    return validateTelegramProduct(datos, campos, permisos);
  }

  const required = REQUIRED_BY_ACTION[intent.accion] ?? [];
  for (const key of required) {
    if (!isFilled(datos, campos, key)) {
      campos_pendientes.push(key);
      errores.push(`Falta: ${key}`);
    }
  }

  const optional = OPTIONAL_PROMPT_BY_ACTION[intent.accion] ?? [];
  for (const key of optional) {
    if (!isFilled(datos, campos, key) && !campos_pendientes.includes(key)) {
      campos_pendientes.push(key);
    }
  }

  if (intent.accion.includes('venta') && permisos.length && !permisos.includes('ventas') && !permisos.includes('*')) {
    errores.push('No tienes permiso para registrar ventas.');
  }
  if (intent.accion === 'crear_devolucion' && permisos.length && !permisos.includes('ventas') && !permisos.includes('*')) {
    errores.push('No tienes permiso para registrar devoluciones.');
  }
  if (intent.accion === 'crear_compra' && permisos.length && !permisos.includes('compras') && !permisos.includes('*')) {
    errores.push('No tienes permiso para registrar compras.');
  }
  if (intent.accion.includes('producto') && permisos.length && !permisos.includes('inventario') && !permisos.includes('*')) {
    errores.push('No tienes permiso para gestionar inventario.');
  }

  if (Number(datos.cantidad) < 0) errores.push('La cantidad no puede ser negativa.');
  if (Number(datos.monto) < 0) errores.push('El monto no puede ser negativo.');

  const nombre = String(datos.nombre ?? datos.producto ?? '');
  if (nombre.length > 200) warnings.push('El nombre es muy largo.');

  return {
    valido: errores.length === 0,
    campos_pendientes,
    errores,
    warnings,
    listo_para_confirmar: errores.length === 0 && campos_pendientes.length === 0,
  };
}
