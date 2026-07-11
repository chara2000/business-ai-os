'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, AlertTriangle, Check,
  DollarSign, TrendingDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { getEmpresaId } from '@/lib/getEmpresaId';
import { getUsuarioId } from '@/lib/db-helpers';
import { useEmpresa } from '@/lib/hooks/useEmpresa';
import { ActionButton } from '@/components/ui/ActionButton';
import { FormModal } from '@/components/ui/FormModal';
import { ClientDate } from '@/components/ui/ClientDate';
import { ModuleShell } from '@/components/ui/ModuleShell';
import { SearchField } from '@/components/ui/SearchField';
import { TablePanel } from '@/components/ui/TablePanel';
import type { Credito } from '@/types';

const supabase = createClient();

function AbonoModal({ credito, onClose, onSaved }: { credito: Credito; onClose: () => void; onSaved: () => void }) {
  const [monto, setMonto] = useState(0);
  const [metodo, setMetodo] = useState('efectivo');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (monto <= 0 || monto > credito.saldo_pendiente) {
      toast.error('Monto inválido'); return;
    }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('No autenticado'); setLoading(false); return; }

    const empresa_id = getEmpresaId();
    const usuario_id = getUsuarioId();
    if (!empresa_id || !usuario_id) { toast.error('Sin empresa asignada'); setLoading(false); return; }

    const nuevoMontoPagado = credito.monto_pagado + monto;
    const nuevoSaldo = credito.monto_total - nuevoMontoPagado;
    let nuevoEstado = credito.estado;
    if (nuevoSaldo <= 0) nuevoEstado = 'pagado';
    else if (nuevoMontoPagado > 0 && credito.estado === 'pendiente') nuevoEstado = 'parcial';

    const { error: abonoError } = await supabase.from('abonos').insert([{
      empresa_id, credito_id: credito.id, monto, metodo_pago: metodo, notas, usuario_id
    }]);

    if (abonoError) { toast.error('Error al registrar abono: ' + abonoError.message); setLoading(false); return; }

    const { error: updateError } = await supabase.from('creditos').update({
      monto_pagado: nuevoMontoPagado, saldo_pendiente: nuevoSaldo, estado: nuevoEstado
    }).eq('id', credito.id);

    if (updateError) {
      toast.error('Error al actualizar crédito: ' + updateError.message);
    } else {
      if (credito.cliente_id) {
        const { data: cliente } = await supabase.from('clientes').select('saldo_pendiente').eq('id', credito.cliente_id).single();
        if (cliente) {
          await supabase.from('clientes').update({
            saldo_pendiente: Math.max(0, (cliente.saldo_pendiente ?? 0) - monto),
          }).eq('id', credito.cliente_id);
        }
      }
      toast.success(`Abono de $${monto.toLocaleString()} registrado ✓`);
      onSaved();
    }
    setLoading(false);
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title="Registrar Abono"
      subtitle={`Cliente: ${credito.cliente?.nombre}`}
      icon={CreditCard}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <ActionButton loading={loading} style={{ minWidth: 140, justifyContent: 'center' }} onClick={handleSubmit as unknown as React.MouseEventHandler}>
            {loading ? 'Procesando...' : 'Registrar Abono'}
          </ActionButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-info-row modal-info-row--danger">
          <span className="muted">Saldo pendiente</span>
          <strong style={{ color: 'var(--danger)', fontSize: '1.1rem' }}>
            ${credito.saldo_pendiente.toLocaleString()}
          </strong>
        </div>

        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Abono</h3>
          <div className="input-wrapper">
            <label className="form-label">Valor del abono *</label>
            <div className="modal-input-prefix">
              <span className="prefix">$</span>
              <input type="number" className="input" min={1} max={credito.saldo_pendiente}
                value={monto || ''} onChange={e => setMonto(+e.target.value)}
                placeholder="Ingresa el monto" required style={{ fontWeight: 600 }} />
            </div>
            {monto > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--success)', marginTop: 8, fontWeight: 600 }}>
                <TrendingDown size={14} />
                Nuevo saldo: ${(credito.saldo_pendiente - monto).toLocaleString()}
              </div>
            )}
          </div>
          <div className="input-wrapper">
            <label className="form-label">Método de pago</label>
            <select className="select" value={metodo} onChange={e => setMetodo(e.target.value)}>
              {['efectivo', 'transferencia', 'nequi', 'daviplata', 'tarjeta'].map(m =>
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              )}
            </select>
          </div>
          <div className="input-wrapper">
            <label className="form-label">Notas / referencia</label>
            <input className="input" placeholder="Opcional..." value={notas} onChange={e => setNotas(e.target.value)} />
          </div>
        </div>
      </form>
    </FormModal>
  );
}

const STATUS_STYLES = {
  pendiente: { label: 'Pendiente', class: 'badge-warning' },
  parcial: { label: 'Parcial', class: 'badge-info' },
  pagado: { label: 'Pagado', class: 'badge-success' },
  vencido: { label: 'Vencido', class: 'badge-danger' },
};

const FILTERS = [['all', 'Todos'], ['pendiente', 'Pendientes'], ['vencido', 'Vencidos'], ['parcial', 'Parciales'], ['pagado', 'Pagados']] as const;

export default function CreditosPage() {
  const { empresaId } = useEmpresa();
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [abonoCredito, setAbonoCredito] = useState<Credito | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchCreditos = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('creditos')
      .select('*, cliente:clientes(*)')
      .eq('empresa_id', empresaId)
      .order('fecha_vencimiento', { ascending: true });

    if (error) toast.error('Error al cargar créditos');
    else setCreditos(data || []);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => { fetchCreditos(); }, [fetchCreditos]);

  const filtered = creditos.filter(c => {
    const matchSearch = (c.cliente?.nombre ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.estado === filterStatus;
    return matchSearch && matchStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setPage(1); }, [search, filterStatus]);

  const totalCartera = creditos.filter(c => c.estado !== 'pagado').reduce((s, c) => s + c.saldo_pendiente, 0);
  const vencidos = creditos.filter(c => c.estado === 'vencido').length;
  const pendientes = creditos.filter(c => c.estado === 'pendiente' || c.estado === 'parcial').length;
  const totalPagados = creditos.filter(c => c.estado === 'pagado').length;

  const moduleStats = [
    { label: 'Cartera', value: `$${(totalCartera / 1000).toFixed(0)}K`, icon: DollarSign, tone: 'danger' as const },
    { label: 'Activos', value: pendientes, icon: CreditCard, tone: 'warning' as const },
    { label: 'Vencidos', value: vencidos, icon: AlertTriangle, tone: 'danger' as const },
    { label: 'Liquidados', value: totalPagados, icon: Check, tone: 'success' as const },
  ];

  return (
    <ModuleShell
      boundedTable
      stats={moduleStats}
      toolbar={
        <>
          <SearchField value={search} onChange={setSearch} placeholder="Buscar por cliente..." />
          <div className="toolbar-segment">
            {FILTERS.map(([k, l]) => (
              <button key={k} type="button" className={filterStatus === k ? 'toolbar-segment-active' : ''} onClick={() => setFilterStatus(k)}>
                {l}
              </button>
            ))}
          </div>
        </>
      }
    >
      {loading ? (
        <div className="data-panel" style={{ padding: 16 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 56, marginBottom: 8, borderRadius: 10 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="data-panel empty-state" style={{ padding: 32 }}>
          <div className="empty-icon"><CreditCard size={24} /></div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>No hay créditos</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {search ? `Sin resultados para "${search}"` : 'El historial de cuentas por cobrar está vacío.'}
          </div>
        </div>
      ) : (
        <TablePanel
          className="table-panel--list"
          pagination={{ currentPage, totalPages, totalItems: filtered.length, pageSize, onPageChange: setPage }}
        >
          <div className="credit-list">
          {paginated.map(c => {
            const st = STATUS_STYLES[c.estado];
            const pct = c.monto_total > 0 ? (c.monto_pagado / c.monto_total) * 100 : 0;
            const vencimiento = new Date(c.fecha_vencimiento);
            const isVencido = c.estado === 'vencido';
            return (
              <div key={c.id} className="credit-row">
                <div className="avatar" style={{
                  width: 40, height: 40, fontSize: 14, borderRadius: 12, flexShrink: 0,
                  background: isVencido ? 'var(--danger-soft)' : 'var(--brand-soft)',
                  color: isVencido ? 'var(--danger)' : 'var(--brand)',
                  border: `1px solid ${isVencido ? 'var(--danger)' : 'var(--brand-border)'}`,
                }}>
                  {(c.cliente?.nombre ?? 'C')[0].toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{c.cliente?.nombre}</span>
                    <span className={`badge ${st.class}`}>{st.label}</span>
                    {isVencido && <AlertTriangle size={13} color="var(--danger)" />}
                  </div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                    <span>Total: <strong style={{ color: 'var(--text-secondary)' }}>${c.monto_total.toLocaleString()}</strong></span>
                    <span>Pagado: <strong style={{ color: 'var(--success)' }}>${c.monto_pagado.toLocaleString()}</strong></span>
                    <span>Vence: <strong style={{ color: isVencido ? 'var(--danger)' : 'var(--text-secondary)' }}><ClientDate value={vencimiento} /></strong></span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${pct}%`, background: isVencido ? 'var(--danger)' : 'var(--success)' }} />
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>Saldo</div>
                  <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-mono)', color: isVencido ? 'var(--danger)' : 'var(--text-primary)', marginBottom: 8 }}>
                    ${c.saldo_pendiente.toLocaleString()}
                  </div>
                  {c.estado !== 'pagado' ? (
                    <ActionButton size="sm" icon={<DollarSign size={13} />} onClick={() => setAbonoCredito(c)}>
                      Abonar
                    </ActionButton>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>
                      <Check size={14} /> Pagado
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </TablePanel>
      )}

      {abonoCredito && (
        <AbonoModal
          credito={abonoCredito}
          onClose={() => setAbonoCredito(null)}
          onSaved={() => { setAbonoCredito(null); fetchCreditos(); }}
        />
      )}
    </ModuleShell>
  );
}
