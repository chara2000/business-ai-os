'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, Users, Package, DollarSign, ShoppingBag,
  AlertTriangle, CreditCard, Truck, ArrowUpRight, Search, Filter,
  Download, ArrowLeftRight, ShoppingCart, Upload, ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { useEmpresa } from '@/lib/hooks/useEmpresa';
import { formatCurrency, formatCompact } from '@/lib/utils';
import { aggregateCashflow } from '@/lib/db-helpers';

const supabase = createClient();

const WALLET_ACTIONS = [
  { icon: Download, label: 'Exportar', href: '/reportes' },
  { icon: ArrowLeftRight, label: 'Transferir', href: '/finanzas' },
  { icon: ShoppingCart, label: 'Compras', href: '/compras' },
  { icon: Upload, label: 'Cobrar', href: '/creditos' },
];

type RecentVenta = {
  id: string;
  numero: string;
  total: number;
  created_at: string;
  estado: string;
  cliente: { nombre: string } | null;
};
type LowStock = { id: string; nombre: string; codigo: string; stock_actual: number; stock_minimo: number };

export default function DashboardPage() {
  const router = useRouter();
  const { empresaId } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<'all' | 'completada' | 'pendiente'>('all');
  const [cashflow, setCashflow] = useState<{ mes: string; value: number }[]>([]);
  const [stats, setStats] = useState({
    ingresos: 0, gastos: 0, balance: 0, ahorro: 0,
    clientes: 0, productos: 0, ventas: 0,
    creditosPend: 0, creditosMonto: 0, stockBajo: 0, proveedores: 0,
  });
  const [recentVentas, setRecentVentas] = useState<RecentVenta[]>([]);
  const [lowStock, setLowStock] = useState<LowStock[]>([]);

  const fetchData = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [
        { count: clientes }, { count: productos }, { count: ventas }, { count: proveedores },
        { data: ventasData }, { data: gastosData }, { data: recientes },
        { data: productosData }, { data: creditosData },
        { data: ventasMes }, { data: gastosMes },
      ] = await Promise.all([
        supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId),
        supabase.from('productos').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId),
        supabase.from('ventas').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId),
        supabase.from('proveedores').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId),
        supabase.from('ventas').select('total').eq('empresa_id', empresaId).eq('estado', 'completada'),
        supabase.from('gastos').select('monto').eq('empresa_id', empresaId),
        supabase.from('ventas').select('id, numero, total, created_at, estado, cliente:clientes(nombre)')
          .eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(8),
        supabase.from('productos').select('id, nombre, codigo, stock_actual, stock_minimo').eq('empresa_id', empresaId),
        supabase.from('creditos').select('saldo_pendiente, estado').eq('empresa_id', empresaId),
        supabase.from('ventas').select('total, created_at').eq('empresa_id', empresaId).eq('estado', 'completada'),
        supabase.from('gastos').select('monto, created_at').eq('empresa_id', empresaId),
      ]);

      const ingresos = ventasData?.reduce((s, v) => s + (v.total || 0), 0) ?? 0;
      const gastos = gastosData?.reduce((s, g) => s + (g.monto || 0), 0) ?? 0;
      const creditosActivos = (creditosData ?? []).filter((c) => c.estado !== 'pagado');
      const creditosMonto = creditosActivos.reduce((s, c) => s + (c.saldo_pendiente || 0), 0);
      const bajo = (productosData ?? [])
        .filter((p) => p.stock_actual <= p.stock_minimo && p.stock_minimo > 0)
        .sort((a, b) => a.stock_actual - b.stock_actual).slice(0, 4);

      setStats({
        ingresos, gastos, balance: ingresos - gastos, ahorro: Math.max(0, ingresos - gastos) * 0.15,
        clientes: clientes ?? 0, productos: productos ?? 0, ventas: ventas ?? 0,
        creditosPend: creditosActivos.length, creditosMonto,
        stockBajo: (productosData ?? []).filter((p) => p.stock_actual <= p.stock_minimo && p.stock_minimo > 0).length,
        proveedores: proveedores ?? 0,
      });
      setRecentVentas(
        (recientes ?? []).map((v) => ({
          ...v,
          cliente: Array.isArray(v.cliente) ? v.cliente[0] ?? null : v.cliente,
        }))
      );
      setLowStock(bajo);
      const flujo = aggregateCashflow(ventasMes ?? [], gastosMes ?? [], chartPeriod === 'annual' ? 12 : 6);
      setCashflow(flujo.map((f) => ({ mes: f.mes, value: f.ingresos - f.gastos })));
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredActivities = recentVentas.filter((v) => {
    const matchSearch = !activitySearch || v.numero?.includes(activitySearch) || v.cliente?.nombre?.toLowerCase().includes(activitySearch.toLowerCase());
    const matchFilter = activityFilter === 'all' || v.estado === activityFilter;
    return matchSearch && matchFilter;
  });

  const marginPct = stats.ingresos > 0 ? ((stats.balance / stats.ingresos) * 100).toFixed(1) : '0';

  return (
    <div className="dash-fintech">
      {/* KPI row — OripioFin */}
      <div className="dash-fintech-kpis">
        <div className="kpi-hero-balance">
          <div className="kpi-hero-pattern" aria-hidden />
          <div className="kpi-hero-top">
            <span>Balance total</span>
            <span className="kpi-pill-white">+{marginPct}%</span>
          </div>
          <div className="kpi-hero-amount">{loading ? '—' : formatCompact(stats.balance)}</div>
          <Link href="/finanzas" className="kpi-hero-link">Ver detalles →</Link>
        </div>

        <div className="kpi-card-white">
          <div className="kpi-card-white-head">
            <span className="kpi-icon-box kpi-icon-savings"><DollarSign size={18} /></span>
            <span className="kpi-pill-green">+3.2%</span>
          </div>
          <div className="kpi-card-white-label">Ingresos</div>
          <div className="kpi-card-white-value">{loading ? '—' : formatCompact(stats.ingresos)}</div>
        </div>

        <div className="kpi-card-white">
          <div className="kpi-card-white-head">
            <span className="kpi-icon-box kpi-icon-invest"><TrendingUp size={18} /></span>
            <span className="kpi-pill-green">+1.8%</span>
          </div>
          <div className="kpi-card-white-label">Gastos</div>
          <div className="kpi-card-white-value">{loading ? '—' : formatCompact(stats.gastos)}</div>
        </div>

        <div className="kpi-card-white">
          <div className="kpi-card-white-head">
            <span className="kpi-icon-box kpi-icon-lime"><Users size={18} /></span>
            <span className="kpi-pill-lime">Activos</span>
          </div>
          <div className="kpi-card-white-label">Clientes</div>
          <div className="kpi-card-white-value">{loading ? '—' : stats.clientes}</div>
        </div>
      </div>

      {/* Middle row */}
      <div className="dash-fintech-mid">
        {/* Wallet — OripioFin */}
        <div className="fintech-card dash-wallet-card">
          <div className="fintech-card-head">
            <h3>Mi cartera</h3>
            <Link href="/clientes" className="fintech-link">Ver todo</Link>
          </div>
          <div className="wallet-list">
            {[
              { code: 'COP', label: 'Ventas', amount: stats.ingresos, active: true },
              { code: 'CRD', label: 'Créditos', amount: stats.creditosMonto, active: stats.creditosPend > 0 },
              { code: 'INV', label: 'Inventario', amount: stats.productos, active: true },
              { code: 'PRV', label: 'Proveedores', amount: stats.proveedores, active: true },
            ].map((w) => (
              <div key={w.code} className="wallet-row">
                <div className="wallet-flag">{w.code.slice(0, 1)}</div>
                <div className="wallet-info">
                  <strong>{w.code}</strong>
                  <span>{w.label}</span>
                </div>
                <div className="wallet-amount">
                  {typeof w.amount === 'number' && w.amount > 999 ? formatCompact(w.amount) : w.amount}
                </div>
                <span className={`wallet-status ${w.active ? 'active' : 'inactive'}`}>
                  {w.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart — Calescence */}
        <div className="fintech-card dash-chart-card">
          <div className="fintech-card-head">
            <div>
              <h3>Flujo de caja</h3>
              <p className="fintech-card-sub">Rendimiento del negocio</p>
            </div>
            <div className="chart-toggle">
              <button type="button" className={chartPeriod === 'monthly' ? 'active' : ''} onClick={() => setChartPeriod('monthly')}>Mensual</button>
              <button type="button" className={chartPeriod === 'annual' ? 'active' : ''} onClick={() => setChartPeriod('annual')}>Anual</button>
            </div>
          </div>
          <div className="dash-chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflow.length ? cashflow : [{ mes: '—', value: 0 }]} barCategoryGap="22%" margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border-default)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#1A1A1A', border: 'none', borderRadius: 12,
                    color: '#fff', fontSize: 12, padding: '10px 14px',
                  }}
                  formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Flujo']}
                  cursor={{ fill: 'var(--brand-soft)' }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={36}>
                  {(cashflow.length ? cashflow : [{ mes: '—', value: 0 }]).map((_, i) => (
                    <Cell key={i} fill={i === (cashflow.length || 1) - 1 ? 'url(#barGradActive)' : 'var(--border-strong)'} />
                  ))}
                </Bar>
                <defs>
                  <linearGradient id="barGradActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C8F542" />
                    <stop offset="100%" stopColor="#A3E635" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* My Wallet — Calescence */}
        <div className="fintech-card dash-my-wallet">
          <div className="fintech-card-head">
            <h3>Resumen operativo</h3>
          </div>
          <div className="my-wallet-balance">{loading ? '—' : formatCurrency(stats.balance)}</div>
          <div className="my-wallet-actions">
            {WALLET_ACTIONS.map(({ icon: Icon, label, href }) => (
              <button key={label} type="button" className="my-wallet-action" onClick={() => router.push(href)} title={label}>
                <Icon size={16} />
              </button>
            ))}
          </div>
          <div className="my-wallet-progress">
            <div className="my-wallet-progress-label">
              <span>Meta mensual</span>
              <span>{marginPct}%</span>
            </div>
            <div className="my-wallet-bar">
              <div className="my-wallet-bar-fill" style={{ width: `${Math.min(100, Number(marginPct))}%` }} />
            </div>
          </div>
          <div className="my-wallet-stats">
            <div><span>Ventas</span><strong>{stats.ventas}</strong></div>
            <div><span>Stock bajo</span><strong className="text-danger">{stats.stockBajo}</strong></div>
            <div><span>Créditos</span><strong>{formatCompact(stats.creditosMonto)}</strong></div>
          </div>
        </div>
      </div>

      {/* Bottom — Activities + Stock */}
      <div className="dash-fintech-bottom">
        <div className="fintech-card dash-activities-card">
          <div className="fintech-card-head">
            <h3>Actividad reciente</h3>
            <div className="activities-toolbar">
              <div className="activities-search">
                <Search size={14} />
                <input placeholder="Buscar..." value={activitySearch} onChange={(e) => setActivitySearch(e.target.value)} />
              </div>
              <button type="button" className="activities-filter" onClick={() => setActivityFilter((f) => f === 'all' ? 'completada' : f === 'completada' ? 'pendiente' : 'all')}>
                <Filter size={14} /> {activityFilter === 'all' ? 'Filtrar' : activityFilter}
              </button>
            </div>
          </div>
          <div className="activities-table-wrap">
            <table className="fintech-table">
              <thead>
                <tr>
                  <th>Actividad</th>
                  <th>Orden</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="table-empty">Cargando...</td></tr>
                ) : filteredActivities.length === 0 ? (
                  <tr><td colSpan={5} className="table-empty">Sin actividad</td></tr>
                ) : filteredActivities.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div className="activity-cell">
                        <span className="activity-icon"><ShoppingBag size={14} /></span>
                        <span>Venta {v.numero}</span>
                      </div>
                    </td>
                    <td className="mono-muted">{v.numero}</td>
                    <td>{new Date(v.created_at).toLocaleDateString('es-CO')}</td>
                    <td className="cell-bold">{formatCurrency(v.total)}</td>
                    <td>
                      <span className={`status-dot ${v.estado === 'completada' ? 'completed' : 'pending'}`}>
                        {v.estado === 'completada' ? 'Completada' : v.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="fintech-card dash-invest-card">
          <div className="fintech-card-head">
            <h3>Alertas & stock</h3>
            <span className="kpi-pill-lime">+{stats.stockBajo} alertas</span>
          </div>
          <div className="invest-list">
            {lowStock.length === 0 ? (
              <div className="invest-empty">
                <Package size={24} />
                <span>Sin alertas de stock</span>
              </div>
            ) : lowStock.map((p, i) => (
              <div key={p.id} className={`invest-row ${i === 1 ? 'highlight-lime' : i === 0 ? 'highlight-dark' : ''}`}>
                <div className="invest-icon">{p.nombre[0]}</div>
                <div className="invest-info">
                  <strong>{p.nombre}</strong>
                  <span>{p.codigo}</span>
                </div>
                <div className="invest-change">
                  <AlertTriangle size={12} />
                  {p.stock_actual}/{p.stock_minimo}
                </div>
              </div>
            ))}
          </div>
          <Link href="/inventario" className="invest-footer-link">
            Ver inventario <ArrowUpRight size={14} />
          </Link>

          <div className="friends-card">
            <div className="friends-head">
              <span>Equipo & clientes</span>
              <span className="kpi-pill-green">+{stats.clientes}</span>
            </div>
            <div className="friends-avatars">
              {['A', 'B', 'C', 'D'].map((l, i) => (
                <span key={l} className="friends-avatar" style={{ zIndex: 4 - i }}>{l}</span>
              ))}
              <span className="friends-avatar friends-more">+{Math.max(0, stats.clientes - 4)}</span>
            </div>
            <div className="friends-amount">{formatCompact(stats.creditosMonto)} <small>por cobrar</small></div>
          </div>
        </div>
      </div>
    </div>
  );
}
