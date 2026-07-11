import type { SupabaseClient } from '@supabase/supabase-js';
import { aiJsonCompletion } from '@/lib/ai/provider';
import { processDynamicSQL } from '@/lib/ai/engine/sql-engine';
import { saveBusinessMemory } from '@/lib/ai/engine/enrichment-engine';
import { generateDocNumber } from '@/lib/db-helpers';
import { previewProductCodigo } from '@/lib/products/codigo';
import { calcImpuestos, getTasaIva } from '@/lib/tax';
import { logAudit } from '@/lib/ai/audit';
import type { AIAction, AIExecuteResult } from '@/lib/ai/types';
import { buildBusinessContext, formatExecutiveSummary } from '@/lib/ai/context';
import { UniversalNormalizer } from '@/lib/ai/core/understanding/normalizer';

function generateCodigo() {
  return previewProductCodigo();
}

function fuzzyMatch<T>(query: string, items: T[], nameKey: string = 'nombre'): T | null {
  const qTokens = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (!qTokens.length) {
    const exact = items.find(i => String((i as any)[nameKey]).toLowerCase().includes(query.toLowerCase()));
    return exact || null;
  }

  let bestMatch: T | null = null;
  let maxScore = 0;
  
  for (const item of items) {
    const targetName = String((item as any)[nameKey]).toLowerCase();
    let score = 0;
    let tokensMatched = 0;
    
    for (const t of qTokens) {
      if (targetName.includes(t)) {
        score += t.length;
        tokensMatched++;
      }
    }
    
    // Penalize if we only matched 1 word but the query has multiple distinct important words
    if (qTokens.length > 1 && tokensMatched === 1) {
       score = score / 2; // Reduce score significantly if it's a very partial match
    }

    if (targetName.includes(query.toLowerCase())) {
       score += 100;
       tokensMatched = qTokens.length;
    }
    
    if (score > maxScore) {
      maxScore = score;
      bestMatch = item;
    }
  }

  // Threshold must be higher than just 2. If it's a multi-word query, require a decent score.
  // We require at least a score of 5 (e.g. one 5-letter word) or exactly matching the whole phrase.
  return maxScore >= 5 ? bestMatch : null;
}

async function findProductoByName(supabase: SupabaseClient, empresaId: string, nombre: string) {
  const { data: all } = await supabase
    .from('productos')
    .select('id, nombre, codigo, stock_actual, stock_minimo, precio_venta, precio_costo')
    .eq('empresa_id', empresaId);
  return fuzzyMatch(nombre, all || [], 'nombre');
}

async function findProveedorByName(supabase: SupabaseClient, empresaId: string, nombre: string) {
  const { data: all } = await supabase
    .from('proveedores')
    .select('id, nombre')
    .eq('empresa_id', empresaId);
  return fuzzyMatch(nombre, all || [], 'nombre');
}

async function findProveedorPayable(supabase: SupabaseClient, empresaId: string, proveedorId: string) {
  const { data } = await supabase
    .from('cuentas_por_pagar_proveedor')
    .select('id, monto_total, monto_pagado, saldo_pendiente, estado')
    .eq('empresa_id', empresaId)
    .eq('proveedor_id', proveedorId)
    .in('estado', ['pendiente', 'parcial', 'vencido'])
    .gt('saldo_pendiente', 0)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function findClienteByName(supabase: SupabaseClient, empresaId: string, nombre: string) {
  const { data: all } = await supabase
    .from('clientes')
    .select('id, nombre, apellido, saldo_pendiente')
    .eq('empresa_id', empresaId);
  
  if (!all) return null;
  // Para clientes evaluamos nombre + apellido
  const mapped = all.map(c => ({ ...c, fullName: `${c.nombre || ''} ${c.apellido || ''}`.trim() }));
  return fuzzyMatch(nombre, mapped, 'fullName');
}

async function createProveedorPayable(params: {
  supabase: SupabaseClient;
  empresaId: string;
  proveedorId: string;
  ordenCompraId: string;
  montoTotal: number;
  notas?: string;
}) {
  const { supabase, empresaId, proveedorId, ordenCompraId, montoTotal, notas } = params;
  const fechaVencimiento = new Date();
  fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

  try {
    await supabase.from('cuentas_por_pagar_proveedor').insert([{
      empresa_id: empresaId,
      proveedor_id: proveedorId,
      orden_compra_id: ordenCompraId,
      monto_total: montoTotal,
      monto_pagado: 0,
      saldo_pendiente: montoTotal,
      estado: 'pendiente',
      fecha_vencimiento: fechaVencimiento.toISOString(),
      notas: notas ?? 'Generado automáticamente desde AI Action Engine',
    }]);
  } catch {
    // La migración puede no estar aplicada aún; no bloqueamos la compra.
  }
}

const CONSULTA_ACTIONS = new Set([
  'consultar_ventas_hoy',
  'consultar_ventas_semana',
  'consultar_ventas_mes',
  'consultar_stock_bajo',
  'consultar_deudores',
  'consultar_clientes',
  'consultar_clientes_inactivos',
  'consultar_cliente_top',
  'consultar_resumen',
  'consultar_stock',
  'consultar_cuentas_pagar',
  'consultar_gastos',
  'consultar_utilidad',
  'consultar_rentabilidad',
  'consultar_flujo_caja',
  'consultar_compras_mes',
  'consultar_producto_mas_vendido',
  'consultar_inventario_valorado',
  'consultar_productos_sin_movimiento',
  'consultar_prediccion_reposicion',
  'consultar_dashboard',
  'buscar_cliente',
  'consulta_dinamica',
]);

export function isConsultaAction(accion: string) {
  return CONSULTA_ACTIONS.has(accion) || accion.startsWith('consultar_');
}

export async function executeAIAction(
  supabase: SupabaseClient,
  empresaId: string,
  usuarioId: string,
  action: AIAction,
): Promise<AIExecuteResult> {
  const { accion, datos = {} } = action;

  try {
    switch (accion) {
      case 'consulta_dinamica': {
        const respuesta = await processDynamicSQL(supabase, usuarioId, datos.pregunta as string || 'Generar reporte');
        return { success: true, message: respuesta };
      }


      case 'consultar_ventas_hoy':
      case 'consultar_resumen': {
        const ctx = await buildBusinessContext(supabase, empresaId);
        if (datos.ejecutivo) {
          return { success: true, message: formatExecutiveSummary(ctx), data: ctx.resumen };
        }

        // List today's sold items with product names
        const today = new Date().toISOString().split('T')[0];
        const { data: ventasHoy } = await supabase
          .from('ventas')
          .select('numero, total, items_venta(cantidad, producto:productos(nombre))')
          .eq('empresa_id', empresaId)
          .eq('estado', 'completada')
          .gte('created_at', `${today}T00:00:00`);

        const totalHoy = (ventasHoy ?? []).reduce((s: number, v: { total: number }) => s + (v.total || 0), 0);
        const count = ventasHoy?.length ?? 0;

        if (count === 0) {
          return { success: true, message: '📊 Hoy aún no hay ventas registradas.' };
        }

        const lines = (ventasHoy ?? []).map((v) => {
          const ventaItems = (v.items_venta ?? []) as Array<{ cantidad: unknown; producto: Array<{ nombre: string }> | { nombre: string } | null }>;
          const items = ventaItems.map((i) => {
            const prod = Array.isArray(i.producto) ? i.producto[0] : i.producto;
            return `${i.cantidad}x ${prod?.nombre ?? '?'}`;
          }).join(', ');
          return `• ${v.numero}: ${items} → $${(Number(v.total) || 0).toLocaleString('es-CO')}`;
        }).join('\n');

        return {
          success: true,
          message: `📊 *Ventas de hoy* (${count} ventas)\n\n${lines}\n\n💰 Total: $${totalHoy.toLocaleString('es-CO')}`,
          data: ctx.resumen,
        };
      }

      case 'consultar_stock':
      case 'search_products': {
        const nombre = String(datos.query ?? datos.producto ?? datos.nombre ?? '').trim();
        if (!nombre) return { success: false, message: 'Indica qué producto quieres consultar.' };
        
        // Use ilike to find products matching the query
        const { data: productos, error } = await supabase
          .from('productos')
          .select('id, nombre, stock_actual, stock_minimo, precio_venta')
          .eq('empresa_id', empresaId)
          .ilike('nombre', `%${nombre}%`)
          .limit(5);
          
        if (error || !productos || productos.length === 0) {
          return { success: false, message: `No encontré "${nombre}" en inventario.` };
        }
        
        const lines = productos.map(p => {
          const estado = p.stock_actual <= (p.stock_minimo ?? 0) ? '⚠️ Bajo' : '✅ OK';
          return `📦 ${p.nombre}: ${p.stock_actual} uds (${estado}) - $${(p.precio_venta || 0).toLocaleString('es-CO')}`;
        });
        
        return {
          success: true,
          message: `Resultados de búsqueda:\n${lines.join('\n')}`,
          data: productos,
        };
      }

      case 'consultar_stock_bajo': {
        const ctx = await buildBusinessContext(supabase, empresaId);
        if (ctx.stock_bajo.length === 0) {
          return { success: true, message: 'No hay productos con stock bajo en este momento.' };
        }
        const lista = ctx.stock_bajo.map((p) => `${p.nombre} (${p.stock}/${p.minimo})`).join(', ');
        return { success: true, message: `Productos con stock bajo: ${lista}`, data: ctx.stock_bajo };
      }

      case 'consultar_deudores': {
        const ctx = await buildBusinessContext(supabase, empresaId);
        if (ctx.deudores.length === 0) {
          return { success: true, message: 'No hay deudores pendientes.' };
        }
        const lista = ctx.deudores.map((d) => `${d.nombre}: $${(d.saldo ?? 0).toLocaleString('es-CO')}`).join('; ');
        return { success: true, message: `Deudores: ${lista}. Deuda total: $${ctx.resumen.deuda_total.toLocaleString('es-CO')}`, data: ctx.deudores };
      }

      case 'consultar_clientes': {
        const { count } = await supabase
          .from('clientes')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .eq('activo', true);
        return { success: true, message: `Tienes ${count ?? 0} clientes activos registrados.` };
      }

      case 'crear_producto': {
        const rawNombre = String(datos.nombre ?? '').trim();
        if (!rawNombre) return { success: false, message: 'El nombre del producto es requerido.' };
        
        // Normalizar el nombre: "baterías para la moto Suzuki GN" -> "BATERIA SUZUKI GN"
        const nombre = UniversalNormalizer.normalizeEntityName(rawNombre);

        const cantidad = Number(datos.cantidad ?? datos.stock_actual ?? 0);
        const precioVenta = Number(datos.precio_venta ?? datos.precio ?? 0);
        const precioCosto = Number(datos.precio_costo ?? 0);
        const codigo = String(datos.codigo ?? generateCodigo());
        const margen = precioVenta > 0 ? ((precioVenta - precioCosto) / precioVenta) * 100 : 0;

        const { data: producto, error } = await supabase
          .from('productos')
          .insert([{
            empresa_id: empresaId,
            codigo,
            nombre,
            precio_costo: precioCosto,
            precio_venta: precioVenta || precioCosto,
            stock_actual: cantidad,
            stock_minimo: Number(datos.stock_minimo ?? 5),
            margen,
            unidad: String(datos.unidad ?? 'unidad'),
            activo: true,
          }])
          .select('id, nombre, codigo, stock_actual')
          .single();

        if (error) return { success: false, message: error.message };

        if (cantidad > 0) {
          await supabase.from('movimientos_inventario').insert([{
            empresa_id: empresaId,
            producto_id: producto.id,
            tipo: 'entrada',
            cantidad,
            stock_anterior: 0,
            stock_nuevo: cantidad,
            costo_unitario: precioCosto,
            motivo: 'Creación vía IA',
            usuario_id: usuarioId,
          }]);
        }

        await logAudit(supabase, {
          empresaId,
          usuarioId,
          accion: 'crear_producto',
          entidad: 'producto',
          entidadId: producto.id,
          datosNuevos: producto as Record<string, unknown>,
        });

        return {
          success: true,
          message: `Producto "${producto.nombre}" creado con ${producto.stock_actual} unidades.`,
          entidad_id: producto.id,
          data: producto,
        };
      }

      case 'actualizar_producto': {
        const nombre = String(datos.nombre ?? datos.producto ?? '').trim();
        const producto = datos.producto_id
          ? await supabase.from('productos').select('*').eq('id', datos.producto_id).eq('empresa_id', empresaId).single().then((r) => r.data)
          : await findProductoByName(supabase, empresaId, nombre);

        if (!producto) return { success: false, message: `No encontré el producto "${nombre}".` };

        const updates: Record<string, unknown> = {};
        if (datos.precio_venta != null) updates.precio_venta = Number(datos.precio_venta);
        if (datos.precio_costo != null) updates.precio_costo = Number(datos.precio_costo);
        if (datos.stock_actual != null) updates.stock_actual = Number(datos.stock_actual);
        if (datos.stock_minimo != null) updates.stock_minimo = Number(datos.stock_minimo);

        if (datos.cantidad != null) {
          const add = Number(datos.cantidad);
          const stockNuevo = producto.stock_actual + add;
          updates.stock_actual = stockNuevo;
          await supabase.from('movimientos_inventario').insert([{
            empresa_id: empresaId,
            producto_id: producto.id,
            tipo: 'entrada',
            cantidad: add,
            stock_anterior: producto.stock_actual,
            stock_nuevo: stockNuevo,
            costo_unitario: producto.precio_costo,
            motivo: 'Ajuste vía IA',
            usuario_id: usuarioId,
          }]);
        }

        if (Object.keys(updates).length === 0) {
          return { success: false, message: 'No hay cambios para aplicar al producto.' };
        }

        const { error } = await supabase.from('productos').update(updates).eq('id', producto.id);
        if (error) return { success: false, message: error.message };

        await logAudit(supabase, {
          empresaId,
          usuarioId,
          accion: 'actualizar_producto',
          entidad: 'producto',
          entidadId: producto.id,
          datosAnteriores: producto as Record<string, unknown>,
          datosNuevos: updates,
        });

        return { success: true, message: `Producto "${producto.nombre}" actualizado correctamente.`, entidad_id: producto.id };
      }

      case 'crear_cliente': {
        const nombre = String(datos.nombre ?? '').trim();
        if (!nombre) return { success: false, message: 'El nombre del cliente es requerido.' };

        const { data: cliente, error } = await supabase
          .from('clientes')
          .insert([{
            empresa_id: empresaId,
            nombre,
            apellido: String(datos.apellido ?? ''),
            telefono: String(datos.telefono ?? ''),
            email: String(datos.email ?? ''),
            activo: true,
          }])
          .select('id, nombre, apellido')
          .single();

        if (error) return { success: false, message: error.message };

        await logAudit(supabase, {
          empresaId,
          usuarioId,
          accion: 'crear_cliente',
          entidad: 'cliente',
          entidadId: cliente.id,
          datosNuevos: cliente as Record<string, unknown>,
        });

        return {
          success: true,
          message: `Cliente "${`${cliente.nombre} ${cliente.apellido ?? ''}`.trim()}" creado.`,
          entidad_id: cliente.id,
          data: cliente,
        };
      }

      case 'registrar_abono': {
        const clienteNombre = String(datos.cliente ?? datos.nombre ?? '').trim();
        const monto = Number(datos.monto ?? 0);
        if (!clienteNombre || monto <= 0) {
          return { success: false, message: 'Cliente y monto válido son requeridos.' };
        }

        const cliente = await findClienteByName(supabase, empresaId, clienteNombre);
        if (!cliente) return { success: false, message: `No encontré al cliente "${clienteNombre}".` };

        const { data: credito } = await supabase
          .from('creditos')
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('cliente_id', cliente.id)
          .in('estado', ['pendiente', 'parcial', 'vencido'])
          .gt('saldo_pendiente', 0)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!credito) return { success: false, message: `${clienteNombre} no tiene créditos pendientes.` };

        const abonoMonto = Math.min(monto, credito.saldo_pendiente);
        const nuevoMontoPagado = credito.monto_pagado + abonoMonto;
        const nuevoSaldo = credito.monto_total - nuevoMontoPagado;
        const nuevoEstado = nuevoSaldo <= 0 ? 'pagado' : 'parcial';

        const { error: abonoError } = await supabase.from('abonos').insert([{
          empresa_id: empresaId,
          credito_id: credito.id,
          monto: abonoMonto,
          metodo_pago: String(datos.metodo_pago ?? 'efectivo'),
          notas: 'Abono vía IA',
          usuario_id: usuarioId,
        }]);

        if (abonoError) return { success: false, message: abonoError.message };

        await supabase.from('creditos').update({
          monto_pagado: nuevoMontoPagado,
          saldo_pendiente: Math.max(0, nuevoSaldo),
          estado: nuevoEstado,
        }).eq('id', credito.id);

        await supabase.from('clientes').update({
          saldo_pendiente: Math.max(0, (cliente.saldo_pendiente ?? 0) - abonoMonto),
        }).eq('id', cliente.id);

        await logAudit(supabase, {
          empresaId,
          usuarioId,
          accion: 'registrar_abono',
          entidad: 'credito',
          entidadId: credito.id,
          datosNuevos: { monto: abonoMonto, cliente: clienteNombre },
        });

        return {
          success: true,
          message: `Abono de $${abonoMonto.toLocaleString('es-CO')} registrado para ${clienteNombre}. Saldo restante: $${Math.max(0, nuevoSaldo).toLocaleString('es-CO')}.`,
        };
      }

      case 'registrar_abono_proveedor': {
        const proveedorNombre = String(datos.proveedor ?? datos.nombre ?? '').trim();
        const monto = Number(datos.monto ?? 0);
        if (!proveedorNombre || monto <= 0) {
          return { success: false, message: 'Proveedor y monto válido son requeridos.' };
        }

        const proveedor = await findProveedorByName(supabase, empresaId, proveedorNombre);
        if (!proveedor) return { success: false, message: `No encontré al proveedor "${proveedorNombre}".` };

        const cuenta = await findProveedorPayable(supabase, empresaId, proveedor.id);
        if (!cuenta) return { success: false, message: `${proveedor.nombre} no tiene cuentas por pagar pendientes.` };

        const abonoMonto = Math.min(monto, Number(cuenta.saldo_pendiente ?? 0));
        const nuevoMontoPagado = Number(cuenta.monto_pagado ?? 0) + abonoMonto;
        const nuevoSaldo = Number(cuenta.monto_total ?? 0) - nuevoMontoPagado;
        const nuevoEstado = nuevoSaldo <= 0 ? 'pagado' : 'parcial';
        const metodoPago = String(datos.metodo_pago ?? 'efectivo');
        const notas = String(datos.notas ?? 'Pago vía IA').trim();

        try {
          await supabase.from('abonos_proveedor').insert([{
            empresa_id: empresaId,
            cuenta_por_pagar_id: cuenta.id,
            monto: abonoMonto,
            metodo_pago: metodoPago,
            notas,
            usuario_id: usuarioId,
          }]);
        } catch {
          // La migración puede no estar aplicada aún; igual actualizamos la cuenta y registramos gasto.
        }

        try {
          await supabase.from('cuentas_por_pagar_proveedor').update({
            monto_pagado: nuevoMontoPagado,
            saldo_pendiente: Math.max(0, nuevoSaldo),
            estado: nuevoEstado,
            updated_at: new Date().toISOString(),
          }).eq('id', cuenta.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Error actualizando cuenta por pagar';
          return { success: false, message: msg };
        }

        try {
          // Como la compra a crédito no creó gasto, el pago sí debe reflejar salida de caja/banco.
          await supabase.from('gastos').insert([{
            empresa_id: empresaId,
            concepto: `Pago a proveedor: ${proveedor.nombre}`,
            categoria: 'pagos_proveedor',
            monto: abonoMonto,
            metodo_pago: metodoPago,
            proveedor_id: proveedor.id,
            notas,
            usuario_id: usuarioId,
          }]);
        } catch {
          // No bloquear si el esquema de gastos cambia
        }

        await logAudit(supabase, {
          empresaId,
          usuarioId,
          accion: 'registrar_abono_proveedor',
          entidad: 'cuenta_por_pagar_proveedor',
          entidadId: cuenta.id,
          datosNuevos: { proveedor: proveedor.nombre, monto: abonoMonto, metodo_pago: metodoPago },
        });

        return {
          success: true,
          message: `Pago de $${abonoMonto.toLocaleString('es-CO')} registrado para ${proveedor.nombre}. Saldo restante: $${Math.max(0, nuevoSaldo).toLocaleString('es-CO')}.`,
        };
      }

      case 'crear_venta': {
        // Support both single product (legacy) and multi-product array
        type ProductoInput = { producto: string; cantidad?: number; precio?: number };
        const productosRaw = datos.productos as ProductoInput[] | undefined;
        const isSingleProduct = !productosRaw || !Array.isArray(productosRaw) || productosRaw.length === 0;

        const productoNombre = String(datos.producto ?? datos.nombre ?? '').trim();
        const cantidad = Number(datos.cantidad ?? 1);

        if (isSingleProduct && (!productoNombre || cantidad <= 0)) {
          return { success: false, message: 'Producto y cantidad son requeridos.' };
        }

        const { data: empresaData } = await supabase.from('empresas').select('configuracion').eq('id', empresaId).single();
        const numeroVenta = generateDocNumber('VTA');
        const esCredito = Boolean(datos.es_credito);
        let clienteId: string | null = null;

        if (datos.cliente) {
          const cliente = await findClienteByName(supabase, empresaId, String(datos.cliente));
          clienteId = cliente?.id ?? null;
        }

        // Build items list
        type VentaItemRaw = { productoNombre: string; cantidad: number; precio: number };
        const itemsToProcess: VentaItemRaw[] = isSingleProduct
          ? [{ productoNombre, cantidad, precio: Number(datos.precio ?? 0) }]
          : productosRaw!.map((p) => ({
              productoNombre: String(p.producto ?? '').trim(),
              cantidad: Number(p.cantidad ?? 1),
              precio: Number(p.precio ?? 0),
            }));

        // Resolve each product and compute totals
        let totalSubtotal = 0;
        type ResolvedItem = { productoRecord: { id: string; nombre: string; stock_actual: number; precio_venta: number; precio_costo: number }; cantidad: number; precio: number; subtotal: number };
        const resolvedItems: ResolvedItem[] = [];
        for (const item of itemsToProcess) {
          if (!item.productoNombre) continue;
          const productoRecord = await findProductoByName(supabase, empresaId, item.productoNombre);
          if (!productoRecord) return { success: false, message: `No encontré "${item.productoNombre}" en inventario.` };
          if (productoRecord.stock_actual < item.cantidad) {
            return { success: false, message: `Stock insuficiente para "${productoRecord.nombre}". Disponible: ${productoRecord.stock_actual}.` };
          }
          const precio = item.precio > 0 ? item.precio : productoRecord.precio_venta;
          const subtotal = precio * item.cantidad;
          totalSubtotal += subtotal;
          resolvedItems.push({ productoRecord, cantidad: item.cantidad, precio, subtotal });
        }

        if (resolvedItems.length === 0) return { success: false, message: 'No se encontraron productos válidos para la venta.' };

        const { impuestos, total } = calcImpuestos(totalSubtotal, 0, getTasaIva(empresaData));

        const { data: venta, error: ventaError } = await supabase
          .from('ventas')
          .insert([{
            empresa_id: empresaId,
            numero: numeroVenta,
            cliente_id: clienteId,
            estado: esCredito ? 'pendiente' : 'completada',
            subtotal: totalSubtotal,
            descuento: 0,
            impuestos,
            total,
            metodo_pago: esCredito ? 'credito' : String(datos.metodo_pago ?? 'efectivo'),
            es_credito: esCredito,
            usuario_id: usuarioId,
          }])
          .select('id')
          .single();

        if (ventaError || !venta) return { success: false, message: ventaError?.message ?? 'Error al crear venta' };

        // Insert all items and update stock
        for (const item of resolvedItems) {
          await supabase.from('items_venta').insert([{
            venta_id: venta.id,
            producto_id: item.productoRecord.id,
            cantidad: item.cantidad,
            precio_unitario: item.precio,
            subtotal: item.subtotal,
            descuento: 0,
          }]);

          const stockNuevo = item.productoRecord.stock_actual - item.cantidad;
          await supabase.from('productos').update({ stock_actual: stockNuevo }).eq('id', item.productoRecord.id);
          await supabase.from('movimientos_inventario').insert([{
            empresa_id: empresaId,
            producto_id: item.productoRecord.id,
            tipo: 'salida',
            cantidad: item.cantidad,
            stock_anterior: item.productoRecord.stock_actual,
            stock_nuevo: stockNuevo,
            costo_unitario: item.precio,
            motivo: `Venta ${numeroVenta}`,
            referencia_id: venta.id,
            referencia_tipo: 'venta',
            usuario_id: usuarioId,
          }]);
        }

        if (esCredito && clienteId) {
          const vencimiento = new Date();
          vencimiento.setDate(vencimiento.getDate() + 30);
          await supabase.from('creditos').insert([{
            empresa_id: empresaId,
            cliente_id: clienteId,
            venta_id: venta.id,
            monto_total: totalSubtotal,
            monto_pagado: 0,
            saldo_pendiente: totalSubtotal,
            estado: 'pendiente',
            fecha_vencimiento: vencimiento.toISOString(),
          }]);
          const { data: clienteRow } = await supabase.from('clientes').select('saldo_pendiente').eq('id', clienteId).single();
          if (clienteRow) {
            await supabase.from('clientes').update({
              saldo_pendiente: (clienteRow.saldo_pendiente ?? 0) + totalSubtotal,
            }).eq('id', clienteId);
          }
        }

        await logAudit(supabase, {
          empresaId,
          usuarioId,
          accion: 'crear_venta',
          entidad: 'venta',
          entidadId: venta.id,
          datosNuevos: { numero: numeroVenta, total: totalSubtotal, items: resolvedItems.length },
        });

        const resumenItems = resolvedItems.map((i) => `${i.cantidad}x ${i.productoRecord.nombre}`).join(', ');
        return {
          success: true,
          message: `✅ Venta ${numeroVenta} registrada: ${resumenItems} por $${totalSubtotal.toLocaleString('es-CO')}.`,
          entidad_id: venta.id,
        };
      }

      case 'crear_compra': {
        const productosRaw = datos.productos as any[] | undefined;
        const primerProducto = productosRaw?.[0];
        
        const nombre = String(primerProducto?.nombre ?? datos.nombre ?? datos.producto ?? '').trim();
        const proveedorNombre = String(datos.proveedor ?? '').trim();
        const cantidad = Number(primerProducto?.cantidad ?? datos.cantidad ?? 0);
        const precioUnit = Number(primerProducto?.costo_unitario ?? primerProducto?.precio_costo ?? datos.precio_costo ?? 0);
        const precioVenta = primerProducto?.precio_venta ? Number(primerProducto.precio_venta) : Math.round(precioUnit * 1.3);
        const categoriaNuevo = String(primerProducto?.categoria ?? '').trim();

        const metodoPago = String(datos.metodo_pago ?? (datos.es_credito ? 'credito' : 'efectivo'));
        const esCredito = Boolean(datos.es_credito) || metodoPago === 'credito';
        const notas = String(datos.notas ?? '').trim();

        if (!nombre || !proveedorNombre || cantidad <= 0 || precioUnit <= 0) {
          return { success: false, message: 'Compra incompleta: producto, proveedor, cantidad y precio son requeridos.' };
        }

        let proveedor = await findProveedorByName(supabase, empresaId, proveedorNombre);
        if (!proveedor) {
          const { data: nuevoProv, error: provErr } = await supabase
            .from('proveedores')
            .insert([{ empresa_id: empresaId, nombre: proveedorNombre, activo: true }])
            .select('id, nombre')
            .single();
          if (provErr || !nuevoProv) return { success: false, message: provErr?.message ?? 'Error creando proveedor' };
          proveedor = nuevoProv;
        }

        let producto = await findProductoByName(supabase, empresaId, nombre);
        if (!producto) {
          const codigo = previewProductCodigo();
          const { data: nuevoProd, error: prodErr } = await supabase
            .from('productos')
            .insert([{
              empresa_id: empresaId,
              codigo,
              nombre,
              precio_costo: precioUnit,
              precio_venta: Math.round(precioUnit * 1.3),
              stock_actual: 0,
              stock_minimo: 5,
              margen: 23,
              unidad: 'unidad',
              activo: true,
            }])
            .select('id, nombre, codigo, stock_actual, stock_minimo, precio_venta, precio_costo')
            .single();
          if (prodErr || !nuevoProd) return { success: false, message: prodErr?.message ?? 'Error creando producto' };
          producto = nuevoProd;
        }

        const subtotal = precioUnit * cantidad;
        const { data: empresaData } = await supabase.from('empresas').select('configuracion').eq('id', empresaId).single();
        const { impuestos, total } = calcImpuestos(subtotal, 0, getTasaIva(empresaData));
        const numero = generateDocNumber('OC');
        const fechaRecepcion = new Date().toISOString();

        const { data: orden, error: ordenErr } = await supabase.from('ordenes_compra').insert([{
          empresa_id: empresaId,
          proveedor_id: proveedor.id,
          numero,
          estado: 'recibida',
          subtotal,
          descuento: 0,
          impuestos,
          total,
          fecha_recepcion: fechaRecepcion,
          notas: notas || `Compra registrada vía AI Action Engine (${esCredito ? 'crédito' : metodoPago})`,
          usuario_id: usuarioId,
        }]).select('id').single();

        if (ordenErr || !orden) return { success: false, message: ordenErr?.message ?? 'Error en orden de compra' };

        await supabase.from('items_orden_compra').insert([{
          orden_compra_id: orden.id,
          producto_id: producto.id,
          cantidad,
          precio_unitario: precioUnit,
          subtotal,
          cantidad_recibida: cantidad,
        }]);

        const stockNuevo = producto.stock_actual + cantidad;
        const costoAnterior = Number(producto.precio_costo ?? 0);
        const stockAnterior = Number(producto.stock_actual ?? 0);
        const costoPromedio = stockNuevo > 0
          ? (((stockAnterior * costoAnterior) + (cantidad * precioUnit)) / stockNuevo)
          : precioUnit;
        await supabase.from('productos').update({
          stock_actual: stockNuevo,
          precio_costo: costoPromedio,
          proveedor_id: proveedor.id,
        }).eq('id', producto.id);

        await supabase.from('movimientos_inventario').insert([{
          empresa_id: empresaId,
          producto_id: producto.id,
          tipo: 'entrada',
          cantidad,
          stock_anterior: producto.stock_actual,
          stock_nuevo: stockNuevo,
          costo_unitario: precioUnit,
          motivo: `Compra ${numero}`,
          referencia_id: orden.id,
          referencia_tipo: 'compra',
          usuario_id: usuarioId,
        }]);

        if (!esCredito) {
          await supabase.from('gastos').insert([{
            empresa_id: empresaId,
            concepto: `Compra ${numero} - ${nombre}`,
            categoria: 'compras',
            monto: total,
            metodo_pago: metodoPago,
            proveedor_id: proveedor.id,
            notas: notas || `Generado automáticamente desde compra ${numero}`,
            usuario_id: usuarioId,
          }]);
        } else {
          await createProveedorPayable({
            supabase,
            empresaId,
            proveedorId: proveedor.id,
            ordenCompraId: orden.id,
            montoTotal: total,
            notas: notas || `Cuenta por pagar generada desde compra ${numero}`,
          });
        }

        await logAudit(supabase, {
          empresaId,
          usuarioId,
          accion: 'crear_compra',
          entidad: 'compra',
          entidadId: orden.id,
          datosNuevos: {
            numero,
            producto: nombre,
            cantidad,
            proveedor: proveedor.nombre,
            total,
            metodo_pago: metodoPago,
            es_credito: esCredito,
            costo_promedio: costoPromedio,
          },
        });

        const impactoFinanciero = esCredito
          ? '📌 Quedó pendiente por pagar.'
          : `💸 Gasto registrado por $${total.toLocaleString('es-CO')}.`;
        return {
          success: true,
          message: `✅ Compra ${numero} registrada.\n📦 ${cantidad}x ${nombre}\n🏢 ${proveedor.nombre}\n💰 Total: $${total.toLocaleString('es-CO')}\n📊 Stock actual: ${stockNuevo} uds\n🧮 Costo promedio: $${Math.round(costoPromedio).toLocaleString('es-CO')}\n${impactoFinanciero}`,
          entidad_id: orden.id,
        };
      }

      case 'crear_devolucion': {
        const clienteNombre = String(datos.cliente ?? '').trim();
        const productoNombre = String(datos.producto ?? datos.nombre ?? '').trim();
        const cantidad = Number(datos.cantidad ?? 1);
        const motivo = String(datos.motivo ?? 'Devolución vía IA').trim();
        const estado = String(datos.estado ?? 'devuelto_inventario');

        if (!clienteNombre || !productoNombre) {
          return { success: false, message: 'Cliente y producto son requeridos para la devolución.' };
        }

        const cliente = await findClienteByName(supabase, empresaId, clienteNombre);
        if (!cliente) return { success: false, message: `No encontré al cliente "${clienteNombre}".` };

        const producto = await findProductoByName(supabase, empresaId, productoNombre);
        if (!producto) return { success: false, message: `No encontré el producto "${productoNombre}".` };

        const { data: venta } = await supabase
          .from('ventas')
          .select('id, numero, items_venta(cantidad, producto_id)')
          .eq('empresa_id', empresaId)
          .eq('cliente_id', cliente.id)
          .neq('estado', 'cancelada')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const item = (venta?.items_venta as { cantidad: number; producto_id: string }[] | undefined)
          ?.find((i) => i.producto_id === producto.id);
        if (item && cantidad > item.cantidad) {
          return { success: false, message: `No puedes devolver ${cantidad} uds. Solo se vendieron ${item.cantidad}.` };
        }

        const precioUnit = producto.precio_venta ?? producto.precio_costo ?? 0;
        const montoDevuelto = precioUnit * cantidad;

        const { data: devolucion, error: devErr } = await supabase.from('devoluciones').insert([{
          empresa_id: empresaId,
          venta_id: venta?.id ?? null,
          producto_id: producto.id,
          cantidad,
          motivo,
          estado,
          monto_devuelto: montoDevuelto,
          usuario_id: usuarioId,
        }]).select('id').single();

        if (devErr || !devolucion) return { success: false, message: devErr?.message ?? 'Error registrando devolución' };

        if (estado === 'devuelto_inventario') {
          const stockNuevo = producto.stock_actual + cantidad;
          await supabase.from('productos').update({ stock_actual: stockNuevo }).eq('id', producto.id);
          await supabase.from('movimientos_inventario').insert([{
            empresa_id: empresaId,
            producto_id: producto.id,
            tipo: 'entrada',
            cantidad,
            stock_anterior: producto.stock_actual,
            stock_nuevo: stockNuevo,
            costo_unitario: producto.precio_costo,
            motivo: `Devolución: ${motivo}`,
            referencia_id: devolucion.id,
            referencia_tipo: 'devolucion',
            usuario_id: usuarioId,
          }]);
        }

        await logAudit(supabase, {
          empresaId,
          usuarioId,
          accion: 'crear_devolucion',
          entidad: 'devolucion',
          entidadId: devolucion.id,
          datosNuevos: { cliente: clienteNombre, producto: productoNombre, cantidad, monto_devuelto: montoDevuelto },
        });

        const destino = estado === 'garantia' ? 'Inventario de garantía' : 'Inventario principal';
        return {
          success: true,
          message: `🔄 Devolución registrada.\n📦 ${producto.nombre}\n👤 ${clienteNombre}\n🔢 Cantidad: ${cantidad}\n⚠️ Motivo: ${motivo}\n📦 Destino: ${destino}\n💲 Valor: $${montoDevuelto.toLocaleString('es-CO')}`,
          entidad_id: devolucion.id,
        };
      }

      // ── GASTO ─────────────────────────────────────────────────────────
      case 'registrar_gasto': {
        const concepto = String(datos.concepto ?? datos.nombre ?? datos.descripcion ?? '').trim();
        const monto = Number(datos.monto ?? datos.precio ?? 0);
        const categoria = String(datos.categoria ?? 'general');
        const metodoPago = String(datos.metodo_pago ?? 'efectivo');
        const notas = String(datos.notas ?? '').trim();

        if (!concepto || monto <= 0) {
          return { success: false, message: 'Concepto y monto son requeridos para registrar el gasto.' };
        }

        let proveedorId: string | null = null;
        if (datos.proveedor) {
          const prov = await findProveedorByName(supabase, empresaId, String(datos.proveedor));
          proveedorId = prov?.id ?? null;
        }

        const { data: gasto, error: gastoError } = await supabase.from('gastos').insert([{
          empresa_id: empresaId,
          concepto,
          categoria,
          monto,
          metodo_pago: metodoPago,
          proveedor_id: proveedorId,
          notas: notas || undefined,
          usuario_id: usuarioId,
        }]).select('id').single();

        if (gastoError || !gasto) return { success: false, message: gastoError?.message ?? 'Error registrando gasto' };

        await logAudit(supabase, {
          empresaId, usuarioId, accion: 'registrar_gasto', entidad: 'gasto', entidadId: gasto.id,
          datosNuevos: { concepto, monto, categoria, metodo_pago: metodoPago },
        });

        return {
          success: true,
          message: `💸 Gasto registrado.\n📝 ${concepto}\n💰 Monto: $${monto.toLocaleString('es-CO')}\n🏷️ Categoría: ${categoria}\n💳 Método: ${metodoPago}`,
          entidad_id: gasto.id,
        };
      }

      // ── INGRESO ────────────────────────────────────────────────────────
      case 'registrar_ingreso': {
        const concepto = String(datos.concepto ?? datos.nombre ?? datos.descripcion ?? '').trim();
        const monto = Number(datos.monto ?? datos.precio ?? 0);
        const metodoPago = String(datos.metodo_pago ?? 'efectivo');
        const notas = String(datos.notas ?? '').trim();

        if (!concepto || monto <= 0) {
          return { success: false, message: 'Concepto y monto son requeridos para registrar el ingreso.' };
        }

        // Registrar como venta con tipo "ingreso_otro" o en tabla gastos con monto negativo (ingreso)
        // Usamos tabla gastos con monto negativo para simplicidad, o podemos crear en tabla separada
        // Por ahora, registramos como nota en auditoria y retornamos éxito con mensaje descriptivo
        const { data: ingreso, error: ingError } = await supabase.from('gastos').insert([{
          empresa_id: empresaId,
          concepto: `[INGRESO] ${concepto}`,
          categoria: 'ingresos_otros',
          monto: -Math.abs(monto), // Negativo = ingreso en tabla gastos
          metodo_pago: metodoPago,
          notas: notas || undefined,
          usuario_id: usuarioId,
        }]).select('id').single();

        if (ingError || !ingreso) return { success: false, message: ingError?.message ?? 'Error registrando ingreso' };

        await logAudit(supabase, {
          empresaId, usuarioId, accion: 'registrar_ingreso', entidad: 'ingreso', entidadId: ingreso.id,
          datosNuevos: { concepto, monto, metodo_pago: metodoPago },
        });

        return {
          success: true,
          message: `💰 Ingreso registrado.\n📝 ${concepto}\n💵 Monto: $${monto.toLocaleString('es-CO')}\n💳 Método: ${metodoPago}`,
          entidad_id: ingreso.id,
        };
      }

      // ── PROVEEDOR ──────────────────────────────────────────────────────
      case 'crear_proveedor': {
        const nombre = String(datos.nombre ?? '').trim();
        if (!nombre) return { success: false, message: 'El nombre del proveedor es requerido.' };

        const { data: prov, error: provError } = await supabase.from('proveedores').insert([{
          empresa_id: empresaId,
          nombre,
          contacto: String(datos.contacto ?? ''),
          telefono: String(datos.telefono ?? ''),
          email: String(datos.email ?? ''),
          nit: String(datos.nit ?? datos.rut ?? ''),
          ciudad: String(datos.ciudad ?? ''),
          condiciones_pago: String(datos.condiciones_pago ?? datos.plazo ?? ''),
          notas: String(datos.notas ?? ''),
          activo: true,
        }]).select('id, nombre').single();

        if (provError || !prov) return { success: false, message: provError?.message ?? 'Error creando proveedor' };

        await logAudit(supabase, {
          empresaId, usuarioId, accion: 'crear_proveedor', entidad: 'proveedor', entidadId: prov.id,
          datosNuevos: prov as Record<string, unknown>,
        });

        return {
          success: true,
          message: `✅ Proveedor "${prov.nombre}" registrado exitosamente.`,
          entidad_id: prov.id,
          data: prov,
        };
      }

      // ── CATEGORÍA ──────────────────────────────────────────────────────
      case 'crear_categoria': {
        const nombre = String(datos.nombre ?? datos.categoria ?? '').trim();
        if (!nombre) return { success: false, message: 'El nombre de la categoría es requerido.' };

        const { data: cat, error: catError } = await supabase.from('categorias').insert([{
          empresa_id: empresaId,
          nombre,
          descripcion: String(datos.descripcion ?? ''),
          icono: String(datos.icono ?? ''),
          color: String(datos.color ?? '#6366f1'),
        }]).select('id, nombre').single();

        if (catError || !cat) {
          if (catError?.code === '23505') return { success: false, message: `La categoría "${nombre}" ya existe.` };
          return { success: false, message: catError?.message ?? 'Error creando categoría' };
        }

        return { success: true, message: `✅ Categoría "${cat.nombre}" creada.`, entidad_id: cat.id };
      }

      // ── MARCA ──────────────────────────────────────────────────────────
      case 'crear_marca': {
        const nombre = String(datos.nombre ?? datos.marca ?? '').trim();
        if (!nombre) return { success: false, message: 'El nombre de la marca es requerido.' };

        const { data: marca, error: marcaError } = await supabase.from('marcas').insert([{
          empresa_id: empresaId,
          nombre,
        }]).select('id, nombre').single();

        if (marcaError || !marca) {
          if (marcaError?.code === '23505') return { success: false, message: `La marca "${nombre}" ya existe.` };
          return { success: false, message: marcaError?.message ?? 'Error creando marca' };
        }

        return { success: true, message: `✅ Marca "${marca.nombre}" creada.`, entidad_id: marca.id };
      }

      // ── AJUSTAR INVENTARIO ─────────────────────────────────────────────
      case 'ajustar_inventario': {
        const nombre = String(datos.nombre ?? datos.producto ?? '').trim();
        const cantidad = Number(datos.cantidad ?? datos.stock_actual ?? 0);
        const motivo = String(datos.motivo ?? 'Ajuste vía IA');

        if (!nombre) return { success: false, message: 'Indica el producto a ajustar.' };

        const producto = await findProductoByName(supabase, empresaId, nombre);
        if (!producto) return { success: false, message: `No encontré "${nombre}" en inventario.` };

        const esAjuste = datos.tipo_ajuste === 'absoluto' || datos.stock_actual != null;
        const stockNuevo = esAjuste ? cantidad : producto.stock_actual + cantidad;
        const tipo = esAjuste ? 'ajuste' : (cantidad >= 0 ? 'entrada' : 'salida');

        await supabase.from('productos').update({ stock_actual: stockNuevo }).eq('id', producto.id);
        await supabase.from('movimientos_inventario').insert([{
          empresa_id: empresaId,
          producto_id: producto.id,
          tipo,
          cantidad: Math.abs(cantidad),
          stock_anterior: producto.stock_actual,
          stock_nuevo: stockNuevo,
          costo_unitario: producto.precio_costo,
          motivo,
          usuario_id: usuarioId,
        }]);

        await logAudit(supabase, {
          empresaId, usuarioId, accion: 'ajustar_inventario', entidad: 'producto', entidadId: producto.id,
          datosAnteriores: { stock_actual: producto.stock_actual },
          datosNuevos: { stock_actual: stockNuevo },
        });

        return {
          success: true,
          message: `📦 Inventario ajustado.\n🏷️ ${producto.nombre}\n📊 Antes: ${producto.stock_actual} → Ahora: ${stockNuevo} uds\n📝 Motivo: ${motivo}`,
        };
      }

      // ── BUSCAR / CONSULTAR CLIENTE ──────────────────────────────────────
      case 'buscar_cliente': {
        const nombre = String(datos.nombre ?? datos.cliente ?? '').trim();
        if (!nombre) return { success: false, message: 'Indica el nombre del cliente a buscar.' };

        const { data: clientes } = await supabase
          .from('clientes')
          .select('id, nombre, apellido, telefono, email, saldo_pendiente, limite_credito, activo')
          .eq('empresa_id', empresaId)
          .or(`nombre.ilike.%${nombre}%,apellido.ilike.%${nombre}%`)
          .limit(5);

        if (!clientes || clientes.length === 0) {
          return { success: false, message: `No encontré clientes con el nombre "${nombre}".` };
        }

        const lista = clientes.map((c) => {
          const nombreCompleto = `${c.nombre} ${c.apellido ?? ''}`.trim();
          const deuda = c.saldo_pendiente > 0 ? ` | Debe: $${Number(c.saldo_pendiente).toLocaleString('es-CO')}` : '';
          return `• ${nombreCompleto}${c.telefono ? ` | 📞 ${c.telefono}` : ''}${deuda}`;
        }).join('\n');

        return {
          success: true,
          message: `👥 Clientes encontrados:\n${lista}`,
          data: clientes,
        };
      }

      // ── ACTUALIZAR CLIENTE ──────────────────────────────────────────────
      case 'actualizar_cliente': {
        const nombre = String(datos.nombre ?? datos.cliente ?? '').trim();
        if (!nombre) return { success: false, message: 'Indica el cliente a actualizar.' };

        const cliente = await findClienteByName(supabase, empresaId, nombre);
        if (!cliente) return { success: false, message: `No encontré al cliente "${nombre}".` };

        const updates: Record<string, unknown> = {};
        if (datos.telefono) updates.telefono = String(datos.telefono);
        if (datos.email) updates.email = String(datos.email);
        if (datos.direccion) updates.direccion = String(datos.direccion);
        if (datos.limite_credito != null) updates.limite_credito = Number(datos.limite_credito);
        if (datos.apellido) updates.apellido = String(datos.apellido);

        if (Object.keys(updates).length === 0) {
          return { success: false, message: 'No hay datos para actualizar.' };
        }

        await supabase.from('clientes').update(updates).eq('id', cliente.id);
        return { success: true, message: `✅ Cliente "${nombre}" actualizado.`, entidad_id: cliente.id };
      }

      // ── CONSULTAS AVANZADAS ───────────────────────────────────────────

      case 'consultar_ventas_semana': {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data: ventas } = await supabase
          .from('ventas')
          .select('total, created_at')
          .eq('empresa_id', empresaId)
          .gte('created_at', sevenDaysAgo.toISOString())
          .neq('estado', 'cancelada');

        const total = (ventas ?? []).reduce((s, v) => s + Number(v.total || 0), 0);
        const cantidad = ventas?.length ?? 0;
        return {
          success: true,
          message: `📅 Ventas últimos 7 días: ${cantidad} transacciones por $${total.toLocaleString('es-CO')}.\nPromedio diario: $${Math.round(total / 7).toLocaleString('es-CO')}.`,
          data: { total, cantidad },
        };
      }

      case 'consultar_ventas_mes': {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { data: ventas } = await supabase
          .from('ventas')
          .select('total, created_at')
          .eq('empresa_id', empresaId)
          .gte('created_at', firstOfMonth)
          .neq('estado', 'cancelada');

        const total = (ventas ?? []).reduce((s, v) => s + Number(v.total || 0), 0);
        const cantidad = ventas?.length ?? 0;
        const diasTranscurridos = now.getDate();
        const promediodia = diasTranscurridos > 0 ? Math.round(total / diasTranscurridos) : 0;
        const proyeccionMes = promediodia * 30;

        return {
          success: true,
          message: `📊 Ventas del mes:\n💰 Total: $${total.toLocaleString('es-CO')}\n🔢 Transacciones: ${cantidad}\n📈 Promedio/día: $${promediodia.toLocaleString('es-CO')}\n🎯 Proyección mensual: $${proyeccionMes.toLocaleString('es-CO')}`,
          data: { total, cantidad, promediodia, proyeccionMes },
        };
      }

      case 'consultar_compras_mes': {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { data: compras } = await supabase
          .from('ordenes_compra')
          .select('total, created_at')
          .eq('empresa_id', empresaId)
          .gte('created_at', firstOfMonth)
          .neq('estado', 'cancelada');

        const total = (compras ?? []).reduce((s, c) => s + Number(c.total || 0), 0);
        const cantidad = compras?.length ?? 0;

        return {
          success: true,
          message: `🛒 Compras del mes: ${cantidad} órdenes por $${total.toLocaleString('es-CO')}.`,
          data: { total, cantidad },
        };
      }

      case 'consultar_gastos': {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { data: gastos } = await supabase
          .from('gastos')
          .select('monto, categoria, concepto')
          .eq('empresa_id', empresaId)
          .gte('created_at', firstOfMonth)
          .gt('monto', 0); // solo gastos reales (positivos)

        const total = (gastos ?? []).reduce((s, g) => s + Number(g.monto || 0), 0);
        const porCategoria: Record<string, number> = {};
        (gastos ?? []).forEach((g) => {
          porCategoria[g.categoria] = (porCategoria[g.categoria] ?? 0) + Number(g.monto || 0);
        });

        const topCats = Object.entries(porCategoria)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([cat, monto]) => `• ${cat}: $${monto.toLocaleString('es-CO')}`)
          .join('\n');

        return {
          success: true,
          message: `💸 Gastos del mes: $${total.toLocaleString('es-CO')}\n\nTop categorías:\n${topCats || '— Sin gastos registrados'}`,
          data: { total, gastos: gastos?.length ?? 0, porCategoria },
        };
      }

      case 'consultar_utilidad': {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const [ventasRes, comprasRes, gastosRes] = await Promise.all([
          supabase.from('ventas').select('total, subtotal').eq('empresa_id', empresaId).gte('created_at', firstOfMonth).neq('estado', 'cancelada'),
          supabase.from('ordenes_compra').select('total').eq('empresa_id', empresaId).gte('created_at', firstOfMonth).neq('estado', 'cancelada'),
          supabase.from('gastos').select('monto').eq('empresa_id', empresaId).gte('created_at', firstOfMonth).gt('monto', 0),
        ]);

        const ingresos = (ventasRes.data ?? []).reduce((s, v) => s + Number(v.total || 0), 0);
        const costoCompras = (comprasRes.data ?? []).reduce((s, c) => s + Number(c.total || 0), 0);
        const gastos = (gastosRes.data ?? []).reduce((s, g) => s + Number(g.monto || 0), 0);
        const utilidadBruta = ingresos - costoCompras;
        const utilidadNeta = utilidadBruta - gastos;
        const margen = ingresos > 0 ? ((utilidadNeta / ingresos) * 100).toFixed(1) : '0';

        return {
          success: true,
          message: `📊 Utilidad del mes:\n💰 Ingresos: $${ingresos.toLocaleString('es-CO')}\n🛒 Costo compras: $${costoCompras.toLocaleString('es-CO')}\n💸 Gastos op.: $${gastos.toLocaleString('es-CO')}\n✅ Utilidad neta: $${utilidadNeta.toLocaleString('es-CO')}\n📈 Margen: ${margen}%`,
          data: { ingresos, costoCompras, gastos, utilidadBruta, utilidadNeta, margen: Number(margen) },
        };
      }

      case 'consultar_rentabilidad':
      case 'consultar_flujo_caja': {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const [ventasRes, gastosRes, creditosRes, cuentasPagarRes] = await Promise.all([
          supabase.from('ventas').select('total').eq('empresa_id', empresaId).gte('created_at', firstOfMonth).neq('estado', 'cancelada'),
          supabase.from('gastos').select('monto').eq('empresa_id', empresaId).gte('created_at', firstOfMonth).gt('monto', 0),
          supabase.from('creditos').select('saldo_pendiente').eq('empresa_id', empresaId).in('estado', ['pendiente', 'parcial']),
          supabase.from('cuentas_por_pagar_proveedor').select('saldo_pendiente').eq('empresa_id', empresaId).in('estado', ['pendiente', 'parcial']),
        ]);

        const ingresos = (ventasRes.data ?? []).reduce((s, v) => s + Number(v.total || 0), 0);
        const egresos = (gastosRes.data ?? []).reduce((s, g) => s + Number(g.monto || 0), 0);
        const cartera = (creditosRes.data ?? []).reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0);
        const deudaProveedores = (cuentasPagarRes.data ?? []).reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0);
        const flujoNeto = ingresos - egresos;

        return {
          success: true,
          message: `💹 Flujo de caja (mes):\n📈 Entradas: $${ingresos.toLocaleString('es-CO')}\n📉 Salidas: $${egresos.toLocaleString('es-CO')}\n💡 Flujo neto: $${flujoNeto.toLocaleString('es-CO')}\n💳 Cartera por cobrar: $${cartera.toLocaleString('es-CO')}\n🏦 Por pagar proveedores: $${deudaProveedores.toLocaleString('es-CO')}`,
          data: { ingresos, egresos, flujoNeto, cartera, deudaProveedores },
        };
      }

      case 'consultar_cuentas_pagar': {
        const ctx = await buildBusinessContext(supabase, empresaId);
        if (ctx.cuentas_por_pagar.length === 0) {
          return { success: true, message: '✅ No tienes cuentas pendientes con proveedores.' };
        }
        const lista = ctx.cuentas_por_pagar.map((c) => `• ${c.nombre}: $${Number(c.saldo ?? 0).toLocaleString('es-CO')}`).join('\n');
        const total = ctx.resumen.deuda_proveedores_total ?? 0;
        return {
          success: true,
          message: `🏦 Cuentas por pagar (${ctx.cuentas_por_pagar.length}):\n${lista}\n\n💰 Total: $${total.toLocaleString('es-CO')}`,
          data: ctx.cuentas_por_pagar,
        };
      }

      case 'consultar_producto_mas_vendido': {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // Filter via ventas table to scope by empresa_id
        const { data: ventaIds } = await supabase
          .from('ventas')
          .select('id')
          .eq('empresa_id', empresaId)
          .gte('created_at', thirtyDaysAgo)
          .neq('estado', 'cancelada');

        if (!ventaIds || ventaIds.length === 0) {
          return { success: true, message: 'No hay ventas registradas en los últimos 30 días.' };
        }

        const ids = ventaIds.map((v) => v.id);
        const { data: items } = await supabase
          .from('items_venta')
          .select('producto_id, cantidad, subtotal, producto:productos(nombre)')
          .in('venta_id', ids.slice(0, 200));

        if (!items || items.length === 0) {
          return { success: true, message: 'No hay ítems de venta en los últimos 30 días.' };
        }

        const resumen: Record<string, { nombre: string; cantidad: number; ingresos: number }> = {};
        for (const item of items) {
          const prod = item.producto as { nombre?: string } | null;
          const pid = item.producto_id;
          if (!resumen[pid]) resumen[pid] = { nombre: prod?.nombre ?? 'Desconocido', cantidad: 0, ingresos: 0 };
          resumen[pid].cantidad += Number(item.cantidad || 0);
          resumen[pid].ingresos += Number(item.subtotal || 0);
        }

        const top = Object.values(resumen).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
        const lista = top.map((p, i) => `${i + 1}. ${p.nombre}: ${p.cantidad} uds — $${p.ingresos.toLocaleString('es-CO')}`).join('\n');

        return {
          success: true,
          message: `🏆 Top productos más vendidos (30 días):\n${lista}`,
          data: top,
        };
      }

      case 'consultar_clientes_inactivos': {
        const diasInactividad = Number(datos.dias ?? 60);
        const fechaCorte = new Date();
        fechaCorte.setDate(fechaCorte.getDate() - diasInactividad);

        const { data: clientesActivos } = await supabase
          .from('clientes')
          .select('id, nombre, apellido')
          .eq('empresa_id', empresaId)
          .eq('activo', true)
          .limit(200);

        const { data: ventasRecientes } = await supabase
          .from('ventas')
          .select('cliente_id')
          .eq('empresa_id', empresaId)
          .gte('created_at', fechaCorte.toISOString())
          .neq('estado', 'cancelada');

        const clientesConVentas = new Set((ventasRecientes ?? []).map((v) => v.cliente_id));
        const inactivos = (clientesActivos ?? []).filter((c) => !clientesConVentas.has(c.id));

        if (inactivos.length === 0) {
          return { success: true, message: `✅ Todos los clientes han comprado en los últimos ${diasInactividad} días.` };
        }

        const lista = inactivos.slice(0, 8).map((c) => `• ${c.nombre} ${c.apellido ?? ''}`.trim()).join('\n');
        return {
          success: true,
          message: `⚠️ ${inactivos.length} clientes inactivos (sin compras en ${diasInactividad} días):\n${lista}${inactivos.length > 8 ? `\n... y ${inactivos.length - 8} más.` : ''}`,
          data: inactivos,
        };
      }

      case 'consultar_cliente_top': {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data: ventas } = await supabase
          .from('ventas')
          .select('cliente_id, total, clientes(nombre, apellido)')
          .eq('empresa_id', empresaId)
          .gte('created_at', thirtyDaysAgo)
          .neq('estado', 'cancelada')
          .not('cliente_id', 'is', null);

        if (!ventas || ventas.length === 0) {
          return { success: true, message: 'No hay ventas con clientes identificados en los últimos 30 días.' };
        }

        const resumen: Record<string, { nombre: string; total: number; visitas: number }> = {};
        for (const v of ventas) {
          const cliente = v.clientes as { nombre?: string; apellido?: string } | null;
          const cid = v.cliente_id;
          if (!cid) continue;
          const nombreC = `${cliente?.nombre ?? ''} ${cliente?.apellido ?? ''}`.trim() || 'Sin nombre';
          if (!resumen[cid]) resumen[cid] = { nombre: nombreC, total: 0, visitas: 0 };
          resumen[cid].total += Number(v.total || 0);
          resumen[cid].visitas += 1;
        }

        const top = Object.values(resumen).sort((a, b) => b.total - a.total).slice(0, 5);
        const lista = top.map((c, i) => `${i + 1}. ${c.nombre}: $${c.total.toLocaleString('es-CO')} (${c.visitas} compras)`).join('\n');

        return {
          success: true,
          message: `👑 Mejores clientes (30 días):\n${lista}`,
          data: top,
        };
      }

      case 'consultar_inventario_valorado': {
        const { data: productos } = await supabase
          .from('productos')
          .select('nombre, stock_actual, precio_costo, precio_venta')
          .eq('empresa_id', empresaId)
          .eq('activo', true)
          .gt('stock_actual', 0);

        const totalCosto = (productos ?? []).reduce((s, p) => s + Number(p.stock_actual || 0) * Number(p.precio_costo || 0), 0);
        const totalVenta = (productos ?? []).reduce((s, p) => s + Number(p.stock_actual || 0) * Number(p.precio_venta || 0), 0);
        const utilidadPotencial = totalVenta - totalCosto;

        return {
          success: true,
          message: `🏭 Inventario valorado:\n📦 Productos con stock: ${productos?.length ?? 0}\n💵 Valor a costo: $${totalCosto.toLocaleString('es-CO')}\n💰 Valor a precio venta: $${totalVenta.toLocaleString('es-CO')}\n📈 Utilidad potencial: $${utilidadPotencial.toLocaleString('es-CO')}`,
          data: { totalCosto, totalVenta, utilidadPotencial, productos: productos?.length ?? 0 },
        };
      }

      case 'consultar_productos_sin_movimiento': {
        const dias = Number(datos.dias ?? 90);
        const fechaCorte = new Date();
        fechaCorte.setDate(fechaCorte.getDate() - dias);

        const { data: productos } = await supabase
          .from('productos')
          .select('id, nombre, stock_actual')
          .eq('empresa_id', empresaId)
          .eq('activo', true)
          .gt('stock_actual', 0);

        if (!productos || productos.length === 0) {
          return { success: true, message: 'No hay productos con stock activo.' };
        }

        const { data: movimientos } = await supabase
          .from('movimientos_inventario')
          .select('producto_id')
          .eq('empresa_id', empresaId)
          .eq('tipo', 'salida')
          .gte('created_at', fechaCorte.toISOString());

        const conMovimiento = new Set((movimientos ?? []).map((m) => m.producto_id));
        const sinMovimiento = productos.filter((p) => !conMovimiento.has(p.id));

        if (sinMovimiento.length === 0) {
          return { success: true, message: `✅ Todos los productos han tenido movimiento en los últimos ${dias} días.` };
        }

        const lista = sinMovimiento.slice(0, 8).map((p) => `• ${p.nombre} (stock: ${p.stock_actual})`).join('\n');
        return {
          success: true,
          message: `📦 ${sinMovimiento.length} productos sin ventas en ${dias} días:\n${lista}${sinMovimiento.length > 8 ? `\n... y ${sinMovimiento.length - 8} más.` : ''}`,
          data: sinMovimiento,
        };
      }

      case 'consultar_prediccion_reposicion': {
        const { data: productos } = await supabase
          .from('productos')
          .select('id, nombre, stock_actual, stock_minimo, precio_costo')
          .eq('empresa_id', empresaId)
          .eq('activo', true);

        if (!productos || productos.length === 0) {
          return { success: true, message: 'No hay productos registrados.' };
        }

        const criticos = productos.filter((p) => Number(p.stock_actual) <= Number(p.stock_minimo) * 1.5);
        const ordenadosPorUrgencia = criticos.sort((a, b) => {
          const ratioA = Number(a.stock_actual) / Math.max(Number(a.stock_minimo), 1);
          const ratioB = Number(b.stock_actual) / Math.max(Number(b.stock_minimo), 1);
          return ratioA - ratioB;
        });

        if (ordenadosPorUrgencia.length === 0) {
          return { success: true, message: '✅ El inventario está saludable. No hay reposiciones urgentes.' };
        }

        const lista = ordenadosPorUrgencia.slice(0, 6).map((p) => {
          const ratio = Number(p.stock_actual) / Math.max(Number(p.stock_minimo), 1);
          const urgencia = ratio <= 0.5 ? '🔴 URGENTE' : ratio <= 1 ? '🟠 Próximo' : '🟡 Pronto';
          return `${urgencia} ${p.nombre}: ${p.stock_actual}/${p.stock_minimo} uds`;
        }).join('\n');

        return {
          success: true,
          message: `🔮 Predicción de reposición (${ordenadosPorUrgencia.length} productos):\n${lista}`,
          data: ordenadosPorUrgencia,
        };
      }

      case 'consultar_dashboard': {
        const ctx = await buildBusinessContext(supabase, empresaId);
        return {
          success: true,
          message: formatExecutiveSummary(ctx),
          data: ctx,
        };
      }

      case 'crear_empleado': {
        const nombre = String(datos.nombre ?? '').trim();
        if (!nombre) return { success: false, message: 'El nombre del empleado es requerido.' };

        // Registro de empleado en tabla usuarios (sin auth user)
        // Por ahora solo confirmamos la intención y retornamos guía
        return {
          success: true,
          message: `👤 Para registrar un empleado, ve a **Configuración → Equipo → Invitar usuario** e ingresa el email de ${nombre}.\n\nEsta acción requiere enviar una invitación por email para que el empleado cree su acceso seguro.`,
        };
      }

      default:
        return { success: false, message: `Acción "${accion}" no soportada aún. Si necesitas esta función, puedo ayudarte a completarla.` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al ejecutar acción';
    return { success: false, message: msg };
  }
}
