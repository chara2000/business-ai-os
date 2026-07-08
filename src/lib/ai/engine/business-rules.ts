import type { EnrichedField, ParsedIntent } from './types';

const REQUIRED_BY_ACTION: Record<string, string[]> = {
  crear_producto: ['nombre'],
  actualizar_producto: ['nombre'],
  crear_cliente: ['nombre'],
  crear_venta: ['producto'],
  registrar_abono: ['cliente', 'monto'],
  crear_proveedor: ['nombre'],
};

const OPTIONAL_PROMPT_BY_ACTION: Record<string, string[]> = {
  crear_producto: ['precio_costo', 'precio_venta'],
};

export type RulesResult = {
  valido: boolean;
  campos_pendientes: string[];
  errores: string[];
  warnings: string[];
};

export function validateBusinessRules(
  intent: ParsedIntent,
  datos: Record<string, unknown>,
  campos: EnrichedField[],
  permisos: string[],
): RulesResult {
  const errores: string[] = [];
  const warnings: string[] = [];
  const campos_pendientes: string[] = [];

  if (intent.es_consulta) {
    return { valido: true, campos_pendientes: [], errores: [], warnings: [] };
  }

  const required = REQUIRED_BY_ACTION[intent.accion] ?? [];
  for (const key of required) {
    const val = datos[key] ?? datos[key === 'producto' ? 'nombre' : key];
    if (val == null || val === '') {
      campos_pendientes.push(key);
      errores.push(`Falta: ${key}`);
    }
  }

  const optional = OPTIONAL_PROMPT_BY_ACTION[intent.accion] ?? [];
  for (const key of optional) {
    if (datos[key] == null || datos[key] === '' || datos[key] === 0) {
      if (!campos_pendientes.includes(key)) campos_pendientes.push(key);
    }
  }

  if (intent.accion.includes('venta') && permisos.length && !permisos.includes('ventas') && !permisos.includes('*')) {
    errores.push('No tienes permiso para registrar ventas.');
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
  };
}
