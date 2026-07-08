import type { SupabaseClient } from '@supabase/supabase-js';

export type DemandForecast = {
  producto_id: string;
  nombre: string;
  codigo: string;
  stock_actual: number;
  stock_minimo: number;
  ventas_30d: number;
  promedio_semanal: number;
  demanda_proyectada_30d: number;
  cantidad_sugerida: number;
  urgencia: 'alta' | 'media' | 'baja' | 'ok';
  tendencia_pct: number;
};

function weekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

export async function computeDemandForecast(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<DemandForecast[]> {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const [{ data: productos }, { data: ventas }] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, codigo, stock_actual, stock_minimo')
      .eq('empresa_id', empresaId)
      .eq('activo', true),
    supabase
      .from('ventas')
      .select('created_at, items_venta(producto_id, cantidad)')
      .eq('empresa_id', empresaId)
      .eq('estado', 'completada')
      .gte('created_at', since.toISOString()),
  ]);

  const salesByProduct: Record<string, { total: number; byWeek: Record<string, number> }> = {};

  (ventas ?? []).forEach((v) => {
    const wk = weekKey(new Date(v.created_at));
    (v.items_venta ?? []).forEach((item: { producto_id: string; cantidad: number }) => {
      if (!salesByProduct[item.producto_id]) {
        salesByProduct[item.producto_id] = { total: 0, byWeek: {} };
      }
      salesByProduct[item.producto_id].total += item.cantidad;
      salesByProduct[item.producto_id].byWeek[wk] =
        (salesByProduct[item.producto_id].byWeek[wk] ?? 0) + item.cantidad;
    });
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return (productos ?? []).map((p) => {
    const stats = salesByProduct[p.id] ?? { total: 0, byWeek: {} };
    const weeks = Object.keys(stats.byWeek).sort();
    const weeklyValues = weeks.map((w) => stats.byWeek[w]);
    const promedioSemanal = weeklyValues.length > 0
      ? weeklyValues.reduce((s, v) => s + v, 0) / weeklyValues.length
      : stats.total / 4;

    const demandaProyectada = Math.ceil(promedioSemanal * 4.3);
    const safetyStock = Math.max(p.stock_minimo, Math.ceil(promedioSemanal));
    const cantidadSugerida = Math.max(0, demandaProyectada + safetyStock - p.stock_actual);

    let urgencia: DemandForecast['urgencia'] = 'ok';
    if (p.stock_actual <= p.stock_minimo) urgencia = 'alta';
    else if (cantidadSugerida > 0) urgencia = 'media';
    else if (demandaProyectada > p.stock_actual * 0.8) urgencia = 'baja';

    const last2 = weeklyValues.slice(-2);
    const prev2 = weeklyValues.slice(-4, -2);
    const lastAvg = last2.length ? last2.reduce((s, v) => s + v, 0) / last2.length : 0;
    const prevAvg = prev2.length ? prev2.reduce((s, v) => s + v, 0) / prev2.length : lastAvg;
    const tendenciaPct = prevAvg > 0 ? Math.round(((lastAvg - prevAvg) / prevAvg) * 100) : 0;

    return {
      producto_id: p.id,
      nombre: p.nombre,
      codigo: p.codigo,
      stock_actual: p.stock_actual,
      stock_minimo: p.stock_minimo,
      ventas_30d: Math.round(stats.total * (30 / 90)),
      promedio_semanal: Math.round(promedioSemanal * 10) / 10,
      demanda_proyectada_30d: demandaProyectada,
      cantidad_sugerida: cantidadSugerida,
      urgencia,
      tendencia_pct: tendenciaPct,
    };
  })
    .filter((f) => f.ventas_30d > 0 || f.urgencia === 'alta')
    .sort((a, b) => {
      const order = { alta: 0, media: 1, baja: 2, ok: 3 };
      return order[a.urgencia] - order[b.urgencia] || b.cantidad_sugerida - a.cantidad_sugerida;
    })
    .slice(0, 25);
}
