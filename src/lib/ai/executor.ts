import type { SupabaseClient } from '@supabase/supabase-js';
import { generateDocNumber } from '@/lib/db-helpers';
import { calcImpuestos, getTasaIva } from '@/lib/tax';
import { logAudit } from '@/lib/ai/audit';
import type { AIAction, AIExecuteResult } from '@/lib/ai/types';
import { buildBusinessContext } from '@/lib/ai/context';

function generateCodigo() {
  return `PRD-${Date.now().toString().slice(-6)}`;
}

async function findProductoByName(supabase: SupabaseClient, empresaId: string, nombre: string) {
  const { data } = await supabase
    .from('productos')
    .select('id, nombre, codigo, stock_actual, precio_venta, precio_costo')
    .eq('empresa_id', empresaId)
    .ilike('nombre', `%${nombre}%`)
    .limit(1)
    .maybeSingle();
  return data;
}

async function findClienteByName(supabase: SupabaseClient, empresaId: string, nombre: string) {
  const { data } = await supabase
    .from('clientes')
    .select('id, nombre, apellido, saldo_pendiente')
    .eq('empresa_id', empresaId)
    .or(`nombre.ilike.%${nombre}%,apellido.ilike.%${nombre}%`)
    .limit(1)
    .maybeSingle();
  return data;
}

const CONSULTA_ACTIONS = new Set([
  'consultar_ventas_hoy',
  'consultar_stock_bajo',
  'consultar_deudores',
  'consultar_clientes',
  'consultar_resumen',
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
      case 'consultar_ventas_hoy':
      case 'consultar_resumen': {
        const ctx = await buildBusinessContext(supabase, empresaId);
        return {
          success: true,
          message: `Hoy registraste ${ctx.resumen.ventas_hoy_cantidad} ventas por $${ctx.resumen.ventas_hoy_total.toLocaleString('es-CO')}. Tienes ${ctx.resumen.clientes_activos} clientes y ${ctx.resumen.productos_stock_bajo} productos con stock bajo.`,
          data: ctx.resumen,
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
        const nombre = String(datos.nombre ?? '').trim();
        if (!nombre) return { success: false, message: 'El nombre del producto es requerido.' };

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

      case 'crear_venta': {
        const productoNombre = String(datos.producto ?? datos.nombre ?? '').trim();
        const cantidad = Number(datos.cantidad ?? 1);
        if (!productoNombre || cantidad <= 0) {
          return { success: false, message: 'Producto y cantidad son requeridos.' };
        }

        const producto = await findProductoByName(supabase, empresaId, productoNombre);
        if (!producto) return { success: false, message: `No encontré el producto "${productoNombre}".` };
        if (producto.stock_actual < cantidad) {
          return { success: false, message: `Stock insuficiente. Disponible: ${producto.stock_actual}.` };
        }

        const precio = Number(datos.precio ?? producto.precio_venta);
        const subtotal = precio * cantidad;
        const { data: empresaData } = await supabase.from('empresas').select('configuracion').eq('id', empresaId).single();
        const { impuestos, total } = calcImpuestos(subtotal, 0, getTasaIva(empresaData));
        const numeroVenta = generateDocNumber('VTA');
        const esCredito = Boolean(datos.es_credito);
        let clienteId: string | null = null;

        if (datos.cliente) {
          const cliente = await findClienteByName(supabase, empresaId, String(datos.cliente));
          clienteId = cliente?.id ?? null;
        }

        const { data: venta, error: ventaError } = await supabase
          .from('ventas')
          .insert([{
            empresa_id: empresaId,
            numero: numeroVenta,
            cliente_id: clienteId,
            estado: esCredito ? 'pendiente' : 'completada',
            subtotal,
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

        await supabase.from('items_venta').insert([{
          venta_id: venta.id,
          producto_id: producto.id,
          cantidad,
          precio_unitario: precio,
          subtotal,
        }]);

        const stockNuevo = producto.stock_actual - cantidad;
        await supabase.from('productos').update({ stock_actual: stockNuevo }).eq('id', producto.id);
        await supabase.from('movimientos_inventario').insert([{
          empresa_id: empresaId,
          producto_id: producto.id,
          tipo: 'salida',
          cantidad,
          stock_anterior: producto.stock_actual,
          stock_nuevo: stockNuevo,
          costo_unitario: precio,
          motivo: `Venta ${numeroVenta}`,
          referencia_id: venta.id,
          referencia_tipo: 'venta',
          usuario_id: usuarioId,
        }]);

        if (esCredito && clienteId) {
          const vencimiento = new Date();
          vencimiento.setDate(vencimiento.getDate() + 30);
          await supabase.from('creditos').insert([{
            empresa_id: empresaId,
            cliente_id: clienteId,
            venta_id: venta.id,
            monto_total: subtotal,
            monto_pagado: 0,
            saldo_pendiente: subtotal,
            estado: 'pendiente',
            fecha_vencimiento: vencimiento.toISOString(),
          }]);
          const { data: cliente } = await supabase.from('clientes').select('saldo_pendiente').eq('id', clienteId).single();
          if (cliente) {
            await supabase.from('clientes').update({
              saldo_pendiente: (cliente.saldo_pendiente ?? 0) + subtotal,
            }).eq('id', clienteId);
          }
        }

        await logAudit(supabase, {
          empresaId,
          usuarioId,
          accion: 'crear_venta',
          entidad: 'venta',
          entidadId: venta.id,
          datosNuevos: { numero: numeroVenta, total: subtotal, producto: productoNombre },
        });

        return {
          success: true,
          message: `Venta ${numeroVenta} registrada: ${cantidad}x ${producto.nombre} por $${subtotal.toLocaleString('es-CO')}.`,
          entidad_id: venta.id,
        };
      }

      default:
        return { success: false, message: `Acción "${accion}" no soportada aún.` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al ejecutar acción';
    return { success: false, message: msg };
  }
}
