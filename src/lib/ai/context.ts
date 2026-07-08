import type { SupabaseClient } from '@supabase/supabase-js';

function startOfDayBogota(): string {
  const now = new Date();
  const bogota = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  bogota.setHours(0, 0, 0, 0);
  return bogota.toISOString();
}

export async function buildBusinessContext(supabase: SupabaseClient, empresaId: string) {
  const todayStart = startOfDayBogota();

  const [
    empresaRes,
    productosRes,
    stockBajoRes,
    ventasHoyRes,
    clientesRes,
    creditosRes,
  ] = await Promise.all([
    supabase.from('empresas').select('nombre, tipo_negocio, moneda, ciudad, plan').eq('id', empresaId).single(),
    supabase.from('productos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('activo', true),
    supabase.from('productos').select('nombre, stock_actual, stock_minimo').eq('empresa_id', empresaId).eq('activo', true).limit(100),
    supabase.from('ventas').select('total').eq('empresa_id', empresaId).gte('created_at', todayStart).neq('estado', 'cancelada'),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('activo', true),
    supabase.from('creditos').select('saldo_pendiente, clientes(nombre, apellido)').eq('empresa_id', empresaId).in('estado', ['pendiente', 'parcial', 'vencido']).gt('saldo_pendiente', 0).limit(10),
  ]);

  const empresa = empresaRes.data ?? { nombre: 'Mi negocio', tipo_negocio: 'comercio', moneda: 'COP', ciudad: null, plan: 'free' };
  const ventasHoy = ventasHoyRes.data ?? [];
  const totalVentasHoy = ventasHoy.reduce((s, v) => s + (v.total || 0), 0);
  const creditos = creditosRes.data ?? [];
  const totalDeuda = creditos.reduce((s, c) => s + (c.saldo_pendiente || 0), 0);

  const stockBajo = (stockBajoRes.data ?? [])
    .filter((p) => p.stock_actual <= p.stock_minimo)
    .slice(0, 10)
    .map((p) => ({
      nombre: p.nombre,
      stock: p.stock_actual,
      minimo: p.stock_minimo,
    }));

  const deudores = creditos.map((c) => {
    const cliente = c.clientes as { nombre?: string; apellido?: string } | null;
    const nombre = cliente ? `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim() : 'Cliente';
    return { nombre, saldo: c.saldo_pendiente };
  });

  return {
    empresa,
    resumen: {
      productos_activos: productosRes.count ?? 0,
      clientes_activos: clientesRes.count ?? 0,
      ventas_hoy_cantidad: ventasHoy.length,
      ventas_hoy_total: totalVentasHoy,
      productos_stock_bajo: stockBajo.length,
      creditos_pendientes: creditos.length,
      deuda_total: totalDeuda,
    },
    stock_bajo: stockBajo,
    deudores,
  };
}

export function formatContextForPrompt(ctx: Awaited<ReturnType<typeof buildBusinessContext>>): string {
  const { empresa, resumen, stock_bajo, deudores } = ctx;
  const lines = [
    `Empresa: ${empresa.nombre} (${empresa.tipo_negocio})`,
    `Moneda: ${empresa.moneda ?? 'COP'} | Ciudad: ${empresa.ciudad ?? 'N/A'} | Plan: ${empresa.plan ?? 'free'}`,
    '',
    'RESUMEN EN TIEMPO REAL:',
    `- Productos activos: ${resumen.productos_activos}`,
    `- Clientes activos: ${resumen.clientes_activos}`,
    `- Ventas hoy: ${resumen.ventas_hoy_cantidad} transacciones por $${resumen.ventas_hoy_total.toLocaleString('es-CO')}`,
    `- Productos con stock bajo: ${resumen.productos_stock_bajo}`,
    `- Créditos pendientes: ${resumen.creditos_pendientes} (deuda total: $${resumen.deuda_total.toLocaleString('es-CO')})`,
  ];

  if (stock_bajo.length > 0) {
    lines.push('', 'STOCK BAJO:');
    stock_bajo.forEach((p) => lines.push(`- ${p.nombre}: ${p.stock} (mín: ${p.minimo})`));
  }

  if (deudores.length > 0) {
    lines.push('', 'PRINCIPALES DEUDORES:');
    deudores.forEach((d) => lines.push(`- ${d.nombre}: $${(d.saldo ?? 0).toLocaleString('es-CO')}`));
  }

  return lines.join('\n');
}
