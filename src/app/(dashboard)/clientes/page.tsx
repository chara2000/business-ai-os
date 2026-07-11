'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Search, Phone, Mail, MapPin, CreditCard,
  X, Eye, Edit2, Trash2, TrendingUp, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { getEmpresaId } from '@/lib/getEmpresaId';
import { useEmpresa } from '@/lib/hooks/useEmpresa';
import { ActionButton } from '@/components/ui/ActionButton';
import { FormModal } from '@/components/ui/FormModal';
import { ModuleShell } from '@/components/ui/ModuleShell';
import { SearchField } from '@/components/ui/SearchField';
import { TablePanel } from '@/components/ui/TablePanel';
import { formatCurrency } from '@/lib/utils';
import type { Cliente } from '@/types';

const supabase = createClient();

/* ─── Modal Form ──────────────────────────────────────────────── */
function ClienteForm({ cliente, onClose, onSaved }: { cliente?: Cliente | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nombre: cliente?.nombre ?? '',
    apellido: cliente?.apellido ?? '',
    telefono: cliente?.telefono ?? '',
    email: cliente?.email ?? '',
    direccion: cliente?.direccion ?? '',
    nit: cliente?.nit ?? '',
    limite_credito: cliente?.limite_credito ?? 0,
  });
  const [loading, setLoading] = useState(false);
  const update = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('No autenticado'); setLoading(false); return; }
    const empresa_id = getEmpresaId();
    if (!empresa_id) { toast.error('Sin empresa asignada'); setLoading(false); return; }

    const payload = { empresa_id, ...form };
    if (cliente) {
      const { error } = await supabase.from('clientes').update(payload).eq('id', cliente.id);
      if (error) toast.error('Error: ' + error.message); else { toast.success('Cliente actualizado'); onSaved(); }
    } else {
      const { error } = await supabase.from('clientes').insert([payload]);
      if (error) toast.error('Error: ' + error.message); else { toast.success('Cliente creado'); onSaved(); }
    }
    setLoading(false);
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={cliente ? 'Editar Cliente' : 'Nuevo Cliente'}
      subtitle="Datos de contacto y configuración de crédito"
      icon={Users}
      size="lg"
      bodyScroll="always"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <ActionButton loading={loading} onClick={handleSubmit as unknown as React.MouseEventHandler}>
            {loading ? 'Guardando...' : cliente ? 'Actualizar' : 'Crear'}
          </ActionButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Datos personales</h3>
          <div className="modal-form-grid">
            <div className="input-wrapper">
              <label className="form-label">Nombre *</label>
              <input className="input" value={form.nombre} onChange={e => update('nombre', e.target.value)} required placeholder="Juan" />
            </div>
            <div className="input-wrapper">
              <label className="form-label">Apellido</label>
              <input className="input" value={form.apellido} onChange={e => update('apellido', e.target.value)} placeholder="García" />
            </div>
          </div>
          <div className="modal-form-grid">
            <div className="input-wrapper">
              <label className="form-label">NIT / Cédula</label>
              <input className="input" value={form.nit} onChange={e => update('nit', e.target.value)} placeholder="123456789" />
            </div>
            <div className="input-wrapper">
              <label className="form-label">Límite de crédito</label>
              <input type="number" min={0} className="input" value={form.limite_credito} onChange={e => update('limite_credito', +e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>
        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Contacto</h3>
          <div className="modal-form-grid">
            <div className="input-wrapper">
              <label className="form-label">Teléfono</label>
              <input className="input" value={form.telefono} onChange={e => update('telefono', e.target.value)} placeholder="310-xxx-xxxx" />
            </div>
            <div className="input-wrapper">
              <label className="form-label">Correo electrónico</label>
              <input type="email" className="input" value={form.email} onChange={e => update('email', e.target.value)} placeholder="juan@email.com" />
            </div>
          </div>
          <div className="input-wrapper">
            <label className="form-label">Dirección</label>
            <input className="input" value={form.direccion} onChange={e => update('direccion', e.target.value)} placeholder="Calle 10 #20-30, Bogotá" />
          </div>
        </div>
      </form>
    </FormModal>
  );
}

/* ─── Main Page ───────────────────────────────────────────────── */
export default function ClientesPage() {
  const { empresaId } = useEmpresa();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editCliente, setEditCliente] = useState<Cliente | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchClientes = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    const { data, error } = await supabase.from('clientes').select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false });
    if (error) toast.error('Error al cargar clientes');
    else setClientes(data || []);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return;
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) toast.error('Error: ' + error.message);
    else { toast.success('Cliente eliminado'); fetchClientes(); }
  };

  const filtered = clientes.filter(c =>
    `${c.nombre} ${c.apellido}`.toLowerCase().includes(search.toLowerCase()) ||
    (c.telefono ?? '').includes(search) || (c.email ?? '').includes(search)
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setPage(1); }, [search]);

  const totalCartera = clientes.reduce((s, c) => s + (c.saldo_pendiente ?? 0), 0);
  const morosos = clientes.filter(c => (c.saldo_pendiente ?? 0) > 0).length;
  const activos = clientes.filter(c => c.activo).length;

  const getInitials = (nombre: string, apellido?: string) =>
    `${nombre?.[0] ?? ''}${apellido?.[0] ?? ''}`.toUpperCase();

  const moduleStats = [
    { label: 'Clientes', value: clientes.length, icon: Users, tone: 'brand' as const },
    { label: 'Activos', value: activos, icon: TrendingUp, tone: 'success' as const },
    { label: 'Con saldo', value: morosos, icon: AlertCircle, tone: 'warning' as const },
    { label: 'Cartera', value: `$${(totalCartera / 1000).toFixed(0)}K`, icon: CreditCard, tone: 'danger' as const },
  ];

  return (
    <ModuleShell
      boundedTable
      stats={moduleStats}
      toolbar={
        <>
          <SearchField value={search} onChange={setSearch} placeholder="Buscar por nombre, teléfono o email..." />
          <ActionButton id="btn-nuevo-cliente" size="sm" icon={<Plus size={14} />} style={{ marginLeft: 'auto' }} onClick={() => { setEditCliente(null); setShowForm(true); }}>
            Nuevo Cliente
          </ActionButton>
        </>
      }
    >
      {loading ? (
        <div className="data-panel" style={{ padding: 16 }}>
          <div className="skeleton" style={{ height: 36, marginBottom: 8, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 36, marginBottom: 8, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 36, borderRadius: 8 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="data-panel empty-state" style={{ padding: 32 }}>
          <div className="empty-icon"><Users size={24} /></div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{search ? 'Sin resultados' : 'Sin clientes'}</div>
          {!search && (
            <ActionButton size="sm" icon={<Plus size={14} />} style={{ marginTop: 8 }} onClick={() => { setEditCliente(null); setShowForm(true); }}>
              Agregar Cliente
            </ActionButton>
          )}
        </div>
      ) : (
        <TablePanel pagination={{ currentPage, totalPages, totalItems: filtered.length, pageSize, onPageChange: setPage }}>
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contacto</th>
                <th>Crédito</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 11, borderRadius: 8 }}>
                        {getInitials(c.nombre, c.apellido)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{c.nombre} {c.apellido}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.nit || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12 }}>{c.telefono || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email || '—'}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{formatCurrency(c.limite_credito ?? 0)}</td>
                  <td style={{ fontWeight: 700, color: (c.saldo_pendiente ?? 0) > 0 ? 'var(--warning)' : 'var(--text-primary)', fontSize: 12 }}>
                    {formatCurrency(c.saldo_pendiente ?? 0)}
                  </td>
                  <td>
                    <span className={`badge ${c.activo ? 'badge-success' : 'badge-muted'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" className="btn-icon btn-icon-sm" title="Editar" onClick={() => { setEditCliente(c); setShowForm(true); }}><Edit2 size={12} /></button>
                      <button type="button" className="btn-icon btn-icon-sm" title="Eliminar" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(c.id)}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablePanel>
      )}

      {showForm && (
        <ClienteForm
          cliente={editCliente}
          onClose={() => { setShowForm(false); setEditCliente(null); }}
          onSaved={() => { setShowForm(false); setEditCliente(null); fetchClientes(); }}
        />
      )}
    </ModuleShell>
  );
}
