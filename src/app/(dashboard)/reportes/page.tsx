'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, Package, Users, DollarSign,
  Download, ArrowUpRight, ArrowDownRight, Target,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, AreaChart, Area, Cell, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { useEmpresa } from '@/lib/hooks/useEmpresa';
import { aggregateCashflow, filterByPeriod, downloadCsv } from '@/lib/db-helpers';
import { TablePanel } from '@/components/ui/TablePanel';
import { useClientPagination } from '@/lib/hooks/useClientPagination';

const supabase = createClient();

const BAR_COLORS = ['var(--brand-light)', 'var(--info)', 'var(--success)', 'var(--warning)', 'var(--danger)'];

export default function ReportesPage() {
  const { empresaId } = useEmpresa();
  const [periodo, setPeriodo] = useState('mes');
  const [loading, setLoading] = useState(true);
  const [topProductos, setTopProductos] = useState<{ nombre: string; ventas: number; ingresos: number; trend: number }[]>([]);
  const [forecastTop, setForecastTop] = useState<{ nombre: string; demanda_proyectada_30d: number; cantidad_sugerida: number; urgencia: string }[]>([]);
  const [ventasMensuales, setVentasMensuales] = useState<{ mes: string; ventas: number; objetivo: number }[]>([]);
  const [kpis, setKpis] = useState({ ventasTotales: 0, productosVendidos: 0, clientesNuevos: 0, gananciaNeta: 0 });

  const fetchReportes = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);

    const { data: ventas } = await supabase
      .from('ventas')
      .select('*, items_venta(*, producto:productos(nombre, precio_costo))')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false });

    const { data: gastos } = await supabase.from('gastos').select('monto, created_at').eq('empresa_id', empresaId);
    const { count: clientesNuevos } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresaId);

    const periodoKey = periodo === 'año' ? 'anual' : periodo as 'semana' | 'mes' | 'trimestre' | 'anual';
    const ventasFiltradas = filterByPeriod(ventas ?? [], periodoKey);

    let ventasTotales = 0;
    let productosVendidos = 0;
    let costoTotal = 0;
    const prodMap: Record<string, { nombre: string; ventas: number; ingresos: number; trend: number }> = {};

    ventasFiltradas.forEach((v) => {
      ventasTotales += v.total;
      (v.items_venta ?? []).forEach((i: { cantidad: number; precio_unitario: number; producto?: { nombre: string; precio_costo?: number } }) => {
        productosVendidos += i.cantidad;
        const pName = i.producto?.nombre || 'Producto';
        if (!prodMap[pName]) prodMap[pName] = { nombre: pName, ventas: 0, ingresos: 0, trend: 0 };
        prodMap[pName].ventas += i.cantidad;
        prodMap[pName].ingresos += i.precio_unitario * i.cantidad;
        costoTotal += (i.producto?.precio_costo ?? 0) * i.cantidad;
      });
    });

    const totalGastos = (gastos ?? []).reduce((s, g) => s + (g.monto || 0), 0);
    const gananciaNeta = ventasTotales - costoTotal - totalGastos;

    setKpis({
      ventasTotales,
      productosVendidos,
      clientesNuevos: clientesNuevos ?? 0,
      gananciaNeta: Math.max(0, gananciaNeta),
    });

    const tops = Object.values(prodMap).sort((a, b) => b.ventas - a.ventas).slice(0, 5);
    setTopProductos(tops);

    const mensual = aggregateCashflow(ventas ?? [], gastos ?? [], 7);
    setVentasMensuales(mensual.map((m) => ({ mes: m.mes, ventas: m.ingresos, objetivo: m.objetivo ?? 0 })));

    try {
      const fcRes = await fetch('/api/inventario/prediccion');
      const fcJson = await fcRes.json();
      if (fcJson.data) {
        setForecastTop(
          fcJson.data.slice(0, 5).map((f: { nombre: string; demanda_proyectada_30d: number; cantidad_sugerida: number; urgencia: string }) => ({
            nombre: f.nombre,
            demanda_proyectada_30d: f.demanda_proyectada_30d,
            cantidad_sugerida: f.cantidad_sugerida,
            urgencia: f.urgencia,
          })),
        );
      }
    } catch { /* ignore */ }

    setLoading(false);
  }, [empresaId, periodo]);

  useEffect(() => { fetchReportes(); }, [fetchReportes]);

  const { paginated: paginatedForecast, pagination: forecastPagination } = useClientPagination(forecastTop, 10);
  const { paginated: paginatedProductos, pagination: productosPagination } = useClientPagination(topProductos, 10);

  const exportReport = () => {
    downloadCsv(
      'reporte-productos.csv',
      ['Producto', 'Volumen', 'Ingresos'],
      topProductos.map((p) => [p.nombre, p.ventas, p.ingresos]),
    );
    toast.success('Reporte exportado');
  };

  const STAT_CARDS = [
    { label: 'Ventas Totales', value: `$${(kpis.ventasTotales / 1000000).toFixed(1)}M`, change: loading ? '—' : `${kpis.ventasTotales > 0 ? '+' : ''}${kpis.ventasTotales > 0 ? '100' : '0'}%`, positive: kpis.ventasTotales > 0, icon: TrendingUp, iconBg: 'var(--success-soft)', iconColor: 'var(--success)' },
    { label: 'Volumen Unidades', value: kpis.productosVendidos, change: '—', positive: true, icon: Package, iconBg: 'var(--brand-soft)', iconColor: 'var(--brand-light)' },
    { label: 'Clientes', value: kpis.clientesNuevos, change: '—', positive: true, icon: Users, iconBg: 'var(--danger-soft)', iconColor: 'var(--danger)' },
    { label: 'Beneficio Neto', value: `$${(kpis.gananciaNeta / 1000000).toFixed(1)}M`, change: '—', positive: kpis.gananciaNeta >= 0, icon: DollarSign, iconBg: 'var(--warning-soft)', iconColor: 'var(--warning)' },
  ];

  return (
    <div className="page-fintech-wrap">
      <div className="fintech-toolbar">
        <div className="toolbar-segment">
          {['Semana', 'Mes', 'Trimestre', 'Año'].map((p) => {
            const key = p.toLowerCase();
            return (
              <button key={p} type="button" onClick={() => setPeriodo(key)} className={periodo === key ? 'toolbar-segment-active' : undefined}>{p}</button>
            );
          })}
        </div>
        <button type="button" className="btn-secondary" style={{ fontSize: 13, padding: '8px 16px' }} onClick={exportReport}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {STAT_CARDS.map((s) => (
          <div key={s.label} className="fintech-stat fintech-stat-brand" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div className="kpi-icon" style={{ background: s.iconBg, width: 38, height: 38 }}>
                <s.icon size={18} color={s.iconColor} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '4px 8px', borderRadius: 20, background: s.positive ? 'var(--success-soft)' : 'var(--danger-soft)', color: s.positive ? 'var(--success)' : 'var(--danger)' }}>
                {s.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {s.change}
              </div>
            </div>
            <div className="kpi-value" style={{ fontSize: 26, color: s.iconColor }}>{loading ? '—' : s.value}</div>
            <div className="kpi-label" style={{ marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
        <div className="fintech-card" style={{ padding: 24 }}>
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Target size={18} color="var(--brand-light)" />
              Ventas vs Objetivos
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Datos reales de tu establecimiento</p>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ventasMensuales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGradVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-light)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--brand-light)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tickFormatter={(v) => `$${(Number(v) / 1000000).toFixed(0)}M`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v, name) => [`$${Number(v).toLocaleString()}`, name === 'ventas' ? 'Real' : 'Objetivo']} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13 }} />
                <Legend wrapperStyle={{ paddingTop: 20, fontSize: 13 }} iconType="circle" />
                <Area type="monotone" dataKey="ventas" name="Ventas" stroke="var(--brand-light)" strokeWidth={3} fill="url(#areaGradVentas)" />
                <Area type="monotone" dataKey="objetivo" name="Objetivo" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="5 5" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="fintech-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Package size={18} color="var(--brand-light)" />
              Líderes de Volumen
            </h3>
          </div>
          {topProductos.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin ventas en el período seleccionado</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              {topProductos.map((p, i) => {
                const maxVentas = Math.max(...topProductos.map((x) => x.ventas));
                const pct = maxVentas > 0 ? (p.ventas / maxVentas) * 100 : 0;
                return (
                  <div key={p.nombre + i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{p.nombre}</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{p.ventas} u</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-active)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: BAR_COLORS[i % BAR_COLORS.length], borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="fintech-card" style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={18} color="var(--warning)" />
          Predicción de demanda (30 días)
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Productos con mayor demanda proyectada según historial de ventas
        </p>
        {forecastTop.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin datos suficientes para predecir</p>
        ) : (
          <TablePanel padded={false} pagination={forecastPagination}>
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Demanda proyectada</th>
                  <th>Reorden sugerido</th>
                  <th>Urgencia</th>
                </tr>
              </thead>
              <tbody>
                {paginatedForecast.map((f) => (
                  <tr key={f.nombre}>
                    <td>{f.nombre}</td>
                    <td>{f.demanda_proyectada_30d} uds</td>
                    <td>{f.cantidad_sugerida > 0 ? `+${f.cantidad_sugerida}` : '—'}</td>
                    <td><span className={`badge badge-${f.urgencia === 'alta' ? 'danger' : f.urgencia === 'media' ? 'warning' : 'info'}`}>{f.urgencia}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>
        )}
      </div>

      <div className="fintech-card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Rendimiento de Inventario</h3>
        {topProductos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No hay datos para mostrar</p>
        ) : (
          <TablePanel padded={false} pagination={productosPagination}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>#</th>
                  <th>Producto</th>
                  <th>Volumen</th>
                  <th>Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProductos.map((p, i) => {
                  const globalIndex = (productosPagination.currentPage - 1) * productosPagination.pageSize + i;
                  return (
                  <tr key={p.nombre + globalIndex}>
                    <td style={{ paddingLeft: 24 }}><span style={{ fontWeight: 800, color: BAR_COLORS[globalIndex % BAR_COLORS.length] }}>{globalIndex + 1}</span></td>
                    <td>{p.nombre}</td>
                    <td><span className="badge badge-info">{p.ventas} uds</span></td>
                    <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>${p.ingresos.toLocaleString()}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </TablePanel>
        )}
      </div>
    </div>
  );
}
