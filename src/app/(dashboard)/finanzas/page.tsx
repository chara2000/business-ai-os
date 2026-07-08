'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, PieChart,
  Plus, Download, Scan,
  Wallet, Activity
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { getEmpresaId } from '@/lib/getEmpresaId';
import { getUsuarioId, aggregateCashflow, aggregateGastosByCategory, downloadCsv } from '@/lib/db-helpers';
import { useEmpresa } from '@/lib/hooks/useEmpresa';
import { ActionButton } from '@/components/ui/ActionButton';
import { FormModal } from '@/components/ui/FormModal';
import { ModuleShell } from '@/components/ui/ModuleShell';
import { InvoiceScanModal } from '@/components/ocr/InvoiceScanModal';
import type { ParsedInvoice } from '@/lib/ocr/parse-invoice';
import toast from 'react-hot-toast';

const supabase = createClient();

const GASTO_COLORS = ['var(--brand)', 'var(--info)', 'var(--success)', 'var(--warning)', 'var(--text-muted)'];

function fmt(n: number) {
  return `$${(n / 1000000).toFixed(1)}M`;
}

/* ─── Modal Form ──────────────────────────────────────────────── */
function GastoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ concepto: '', monto: '', categoria: 'Operativo', metodo_pago: 'efectivo', notas: '' });
  const [loading, setLoading] = useState(false);
  const [showOcr, setShowOcr] = useState(false);

  const applyOcr = (data: ParsedInvoice) => {
    setForm({
      concepto: data.concepto || data.proveedor_nombre || 'Factura escaneada',
      monto: String(data.total || data.subtotal || ''),
      categoria: ['Operativo', 'Compras', 'Servicios', 'Transporte', 'Impuestos', 'Otros'].includes(data.categoria_sugerida)
        ? data.categoria_sugerida : 'Compras',
      metodo_pago: form.metodo_pago,
      notas: [data.proveedor_nombre, data.nit ? `NIT: ${data.nit}` : '', data.notas].filter(Boolean).join(' · '),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.concepto || !form.monto) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('No autenticado'); setLoading(false); return; }

    const empresa_id = getEmpresaId();
    const usuario_id = getUsuarioId();
    if (!empresa_id || !usuario_id) { toast.error('Sin empresa asignada'); setLoading(false); return; }

    const { error } = await supabase.from('gastos').insert([{
      empresa_id,
      concepto: form.concepto,
      monto: parseFloat(form.monto),
      categoria: form.categoria,
      metodo_pago: form.metodo_pago,
      notas: form.notas,
      usuario_id,
    }]);

    if (error) {
      toast.error('Error al registrar: ' + error.message);
    } else {
      toast.success('Gasto registrado ✓');
      onSaved();
    }
    setLoading(false);
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title="Registrar Egreso"
      subtitle="Gastos operativos o administrativos"
      icon={DollarSign}
      size="md"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <ActionButton loading={loading} onClick={handleSubmit as unknown as React.MouseEventHandler}>
            {loading ? 'Guardando...' : 'Registrar Egreso'}
          </ActionButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div style={{ marginBottom: 12 }}>
          <button type="button" className="btn-secondary" onClick={() => setShowOcr(true)}>
            <Scan size={16} /> Escanear factura con IA
          </button>
        </div>
        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Detalle del egreso</h3>
          <div className="input-wrapper">
            <label className="form-label">Concepto *</label>
            <input className="input" required placeholder="Ej: Pago de servicios públicos" value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} />
          </div>
          <div className="modal-form-grid">
            <div className="input-wrapper">
              <label className="form-label">Monto *</label>
              <div className="modal-input-prefix">
                <span className="prefix">$</span>
                <input type="number" className="input" required min={1} placeholder="0" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
              </div>
            </div>
            <div className="input-wrapper">
              <label className="form-label">Categoría</label>
              <select className="select" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                {['Operativo', 'Nómina', 'Servicios', 'Transporte', 'Compras', 'Arriendo', 'Impuestos', 'Otros'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Pago</h3>
          <div className="input-wrapper">
            <label className="form-label">Método de Pago</label>
            <select className="select" value={form.metodo_pago} onChange={e => setForm(f => ({ ...f, metodo_pago: e.target.value }))}>
              {['efectivo', 'transferencia', 'tarjeta', 'nequi', 'daviplata'].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
          <div className="input-wrapper">
            <label className="form-label">Notas Adicionales</label>
            <input className="input" placeholder="Observaciones o referencias..." value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
          </div>
        </div>
      </form>
      <InvoiceScanModal open={showOcr} onClose={() => setShowOcr(false)} onParsed={applyOcr} />
    </FormModal>
  );
}

/* ─── Main Page ───────────────────────────────────────────────── */
export default function FinanzasPage() {
  const { empresaId } = useEmpresa();
  const [periodo, setPeriodo] = useState('mes');
  const [loading, setLoading] = useState(true);
  const [flujoData, setFlujoData] = useState<{ mes: string; ingresos: number; gastos: number }[]>([]);
  const [gastosCategorias, setGastosCategorias] = useState<{ categoria: string; monto: number; color: string }[]>([]);
  const [movimientos, setMovimientos] = useState<{ tipo: string; concepto: string; monto: number; fecha: string; metodo: string; sortKey: number }[]>([]);
  const [showGastoModal, setShowGastoModal] = useState(false);

  const fetchFinanzas = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    const { data: ventas } = await supabase.from('ventas').select('total, created_at').eq('empresa_id', empresaId).eq('estado', 'completada').order('created_at', { ascending: false });
    const { data: gastos } = await supabase.from('gastos').select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false });
    const { data: abonos } = await supabase.from('abonos').select('monto, metodo_pago, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(30);

    setFlujoData(aggregateCashflow(ventas ?? [], gastos ?? []));
    setGastosCategorias(aggregateGastosByCategory(gastos ?? [], GASTO_COLORS));

    const movs: { tipo: string; concepto: string; monto: number; fecha: string; metodo: string; sortKey: number }[] = [];
    (ventas ?? []).slice(0, 30).forEach((v, i) => {
      movs.push({ tipo: 'ingreso', concepto: 'Venta registrada', monto: v.total, fecha: new Date(v.created_at).toLocaleDateString('es-CO'), metodo: 'venta', sortKey: new Date(v.created_at).getTime() + i });
    });
    (gastos ?? []).forEach((g) => {
      movs.push({ tipo: 'egreso', concepto: g.concepto, monto: g.monto, fecha: new Date(g.created_at).toLocaleDateString('es-CO'), metodo: g.metodo_pago, sortKey: new Date(g.created_at).getTime() });
    });
    (abonos ?? []).forEach((a) => {
      movs.push({ tipo: 'ingreso', concepto: 'Abono a crédito', monto: a.monto, fecha: new Date(a.created_at).toLocaleDateString('es-CO'), metodo: a.metodo_pago, sortKey: new Date(a.created_at).getTime() });
    });
    movs.sort((a, b) => b.sortKey - a.sortKey);
    setMovimientos(movs.slice(0, 15));
    setLoading(false);
  }, [empresaId]);

  useEffect(() => { fetchFinanzas(); }, [fetchFinanzas]);

  const totalIngresos = flujoData.reduce((s, d) => s + d.ingresos, 0);
  const totalGastos = flujoData.reduce((s, d) => s + d.gastos, 0);
  const gananciaTotal = totalIngresos - totalGastos;
  const margenPromedio = totalIngresos > 0 ? ((gananciaTotal / totalIngresos) * 100).toFixed(1) : '0';
  const ultimoMes = flujoData.at(-1);

  const exportFinanzas = () => {
    downloadCsv(
      'movimientos-finanzas.csv',
      ['Tipo', 'Concepto', 'Método', 'Fecha', 'Monto'],
      movimientos.map((m) => [m.tipo, m.concepto, m.metodo, m.fecha, m.monto]),
    );
    toast.success('Exportación descargada');
  };

  const moduleStats = [
    { label: 'Ingresos', value: fmt(ultimoMes?.ingresos ?? 0), icon: TrendingUp, tone: 'success' as const },
    { label: 'Gastos', value: fmt(ultimoMes?.gastos ?? 0), icon: TrendingDown, tone: 'danger' as const },
    { label: 'Ganancia', value: fmt((ultimoMes?.ingresos ?? 0) - (ultimoMes?.gastos ?? 0)), icon: Wallet, tone: 'brand' as const },
    { label: 'Margen', value: `${margenPromedio}%`, icon: PieChart, tone: 'warning' as const },
  ];

  return (
    <ModuleShell
      stats={moduleStats}
      toolbar={
        <div className="toolbar-segment" style={{ marginLeft: 0 }}>
          {['Semana', 'Mes', 'Año'].map(p => {
            const key = p.toLowerCase();
            return (
              <button key={p} type="button" className={periodo === key ? 'toolbar-segment-active' : ''} onClick={() => setPeriodo(key)}>
                {p}
              </button>
            );
          })}
          <button type="button" className="btn-ghost" style={{ fontSize: 12, marginLeft: 8 }} onClick={exportFinanzas}>
            <Download size={14} /> Exportar
          </button>
          <ActionButton size="sm" icon={<Plus size={14} />} style={{ marginLeft: 'auto' }} onClick={() => setShowGastoModal(true)}>
            Registrar Egreso
          </ActionButton>
        </div>
      }
    >
        {/* Flujo de caja */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 className="panel-title">
                <Activity size={17} color="var(--brand)" />
                Flujo de caja
              </h3>
              <p className="panel-subtitle">Balance entre ingresos operativos y gastos — últimos 6 meses</p>
            </div>
          </div>
          
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flujoData} barCategoryGap="25%" margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [`$${Number(v).toLocaleString()}`, '']}
                  cursor={{ fill: 'var(--bg-active)' }}
                  contentStyle={{
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 12, fontSize: 13, color: 'var(--text-primary)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)', padding: '12px 16px'
                  }}
                  itemStyle={{ fontWeight: 600, padding: '2px 0' }}
                />
                <Legend wrapperStyle={{ paddingTop: 20, fontSize: 13, color: 'var(--text-secondary)' }} iconType="circle" />
                <Bar dataKey="ingresos" name="Ingresos" fill="var(--success)" radius={[6,6,0,0]} maxBarSize={40} />
                <Bar dataKey="gastos" name="Gastos Operativos" fill="var(--danger)" radius={[6,6,0,0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(320px, 2fr)', gap: 16 }}>
        {/* Gastos por categoría */}
        <div className="card" style={{ padding: 22 }}>
          <h3 className="panel-title">Estructura de gastos</h3>
          <p className="panel-subtitle" style={{ marginBottom: 20 }}>Distribución operativa del mes actual</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, justifyContent: 'center' }}>
            {gastosCategorias.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin gastos registrados este período</p>
            ) : gastosCategorias.map((g) => {
              const totalCat = gastosCategorias.reduce((s, c) => s + c.monto, 0);
              const pct = totalCat > 0 ? ((g.monto / totalCat) * 100).toFixed(0) : '0';
              return (
                <div key={g.categoria}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: g.color }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{g.categoria}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>${g.monto.toLocaleString()}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 32, textAlign: 'right' }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-active)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: g.color, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Movimientos recientes */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <h3 className="panel-title">Libro mayor</h3>
            <p className="panel-subtitle">Últimos movimientos registrados</p>
          </div>

          <div className="data-panel data-panel--bounded data-panel--ledger">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Método</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`badge ${m.tipo === 'ingreso' ? 'badge-success' : 'badge-danger'}`}>
                        {m.tipo === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{m.concepto}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.metodo}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.fecha}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: 13, color: m.tipo === 'ingreso' ? 'var(--success)' : 'var(--danger)' }}>
                      {m.tipo === 'ingreso' ? '+' : '-'}${m.monto.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showGastoModal && (
        <GastoModal
          onClose={() => setShowGastoModal(false)}
          onSaved={() => { setShowGastoModal(false); fetchFinanzas(); }}
        />
      )}
    </ModuleShell>
  );
}
