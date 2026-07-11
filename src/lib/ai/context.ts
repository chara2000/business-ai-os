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
    cuentasProveedorRes,
  ] = await Promise.all([
    supabase.from('empresas').select('nombre, tipo_negocio, moneda, ciudad, plan').eq('id', empresaId).single(),
    supabase.from('productos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('activo', true),
    supabase.from('productos').select('nombre, stock_actual, stock_minimo').eq('empresa_id', empresaId).eq('activo', true).limit(100),
    supabase.from('ventas').select('total').eq('empresa_id', empresaId).gte('created_at', todayStart).neq('estado', 'cancelada'),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('activo', true),
    supabase.from('creditos').select('saldo_pendiente, clientes(nombre, apellido)').eq('empresa_id', empresaId).in('estado', ['pendiente', 'parcial', 'vencido']).gt('saldo_pendiente', 0).limit(10),
    supabase
      .from('cuentas_por_pagar_proveedor')
      .select('saldo_pendiente, proveedores(nombre)')
      .eq('empresa_id', empresaId)
      .in('estado', ['pendiente', 'parcial', 'vencido'])
      .gt('saldo_pendiente', 0)
      .limit(10),
  ]);

  const empresa = empresaRes.data ?? { nombre: 'Mi negocio', tipo_negocio: 'comercio', moneda: 'COP', ciudad: null, plan: 'free' };
  const ventasHoy = ventasHoyRes.data ?? [];
  const totalVentasHoy = ventasHoy.reduce((s, v) => s + (v.total || 0), 0);
  const creditos = creditosRes.data ?? [];
  const totalDeuda = creditos.reduce((s, c) => s + (c.saldo_pendiente || 0), 0);
  const cuentasProveedor = cuentasProveedorRes.error ? [] : (cuentasProveedorRes.data ?? []);
  const totalDeudaProveedor = cuentasProveedor.reduce((s, c) => s + (c.saldo_pendiente || 0), 0);

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

  const cuentas_por_pagar = cuentasProveedor.map((c) => {
    const proveedor = c.proveedores as { nombre?: string } | null;
    return { nombre: proveedor?.nombre ?? 'Proveedor', saldo: c.saldo_pendiente };
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
      cuentas_por_pagar: cuentas_por_pagar.length,
      deuda_proveedores_total: totalDeudaProveedor,
    },
    stock_bajo: stockBajo,
    deudores,
    cuentas_por_pagar,
  };
}

export function formatContextForPrompt(ctx: Awaited<ReturnType<typeof buildBusinessContext>>): string {
  const { empresa, resumen, stock_bajo, deudores, cuentas_por_pagar } = ctx;
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
    `- Cuentas por pagar: ${resumen.cuentas_por_pagar ?? 0} (deuda proveedores: $${(resumen.deuda_proveedores_total ?? 0).toLocaleString('es-CO')})`,
  ];

  if (stock_bajo.length > 0) {
    lines.push('', 'STOCK BAJO:');
    stock_bajo.forEach((p) => lines.push(`- ${p.nombre}: ${p.stock} (mín: ${p.minimo})`));
  }

  if (deudores.length > 0) {
    lines.push('', 'PRINCIPALES DEUDORES:');
    deudores.forEach((d) => lines.push(`- ${d.nombre}: $${(d.saldo ?? 0).toLocaleString('es-CO')}`));
  }

  if (cuentas_por_pagar.length > 0) {
    lines.push('', 'CUENTAS POR PAGAR:');
    cuentas_por_pagar.forEach((c) => lines.push(`- ${c.nombre}: $${(c.saldo ?? 0).toLocaleString('es-CO')}`));
  }

  return lines.join('\n');
}

export function formatExecutiveSummary(ctx: Awaited<ReturnType<typeof buildBusinessContext>>): string {
  const { resumen, stock_bajo, deudores, cuentas_por_pagar } = ctx;
  const lines = [
    '📊 *Resumen ejecutivo*',
    '',
    `💰 Ventas hoy: ${resumen.ventas_hoy_cantidad} por $${resumen.ventas_hoy_total.toLocaleString('es-CO')}`,
    `📦 Productos activos: ${resumen.productos_activos}`,
    `👥 Clientes activos: ${resumen.clientes_activos}`,
    `⚠️ Stock bajo: ${resumen.productos_stock_bajo} productos`,
    `💳 Deuda pendiente: $${resumen.deuda_total.toLocaleString('es-CO')} (${resumen.creditos_pendientes} créditos)`,
    `🏦 Por pagar a proveedores: $${(resumen.deuda_proveedores_total ?? 0).toLocaleString('es-CO')} (${resumen.cuentas_por_pagar ?? 0} cuentas)`,
  ];

  if (stock_bajo.length > 0) {
    lines.push('', '🔻 *Reponer pronto:*');
    stock_bajo.slice(0, 5).forEach((p) => lines.push(`• ${p.nombre}: ${p.stock} uds (mín ${p.minimo})`));
  }

  if (deudores.length > 0) {
    lines.push('', '⏰ *Cobrar hoy:*');
    deudores.slice(0, 5).forEach((d) => lines.push(`• ${d.nombre}: $${(d.saldo ?? 0).toLocaleString('es-CO')}`));
  }

  if (cuentas_por_pagar.length > 0) {
    lines.push('', '🏢 *Pagar a proveedores:*');
    cuentas_por_pagar.slice(0, 5).forEach((d) => lines.push(`• ${d.nombre}: $${(d.saldo ?? 0).toLocaleString('es-CO')}`));
  }

  const tips: string[] = [];
  if (resumen.productos_stock_bajo > 0) tips.push(`Reponer ${resumen.productos_stock_bajo} productos con stock bajo.`);
  if (resumen.creditos_pendientes > 0) tips.push(`Cobrar a ${resumen.creditos_pendientes} clientes con deuda.`);
  if ((resumen.cuentas_por_pagar ?? 0) > 0) tips.push(`Programar pagos a ${resumen.cuentas_por_pagar} proveedores.`);
  if (resumen.ventas_hoy_cantidad === 0) tips.push('Aún no hay ventas hoy — ¿promocionar productos clave?');

  if (tips.length) {
    lines.push('', '💡 *Recomendaciones:*');
    tips.forEach((t) => lines.push(`• ${t}`));
  }

  return lines.join('\n');
}
