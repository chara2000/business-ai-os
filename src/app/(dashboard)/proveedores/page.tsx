'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Star, ShoppingCart, Clock, Building2, ShieldCheck, Edit2, Truck
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { getEmpresaId } from '@/lib/getEmpresaId';
import { useEmpresa } from '@/lib/hooks/useEmpresa';
import { ActionButton } from '@/components/ui/ActionButton';
import { FormModal } from '@/components/ui/FormModal';
import { ModuleShell } from '@/components/ui/ModuleShell';
import { SearchField } from '@/components/ui/SearchField';
import { TablePanel } from '@/components/ui/TablePanel';
import type { Proveedor } from '@/types';

const supabase = createClient();

/* ─── Components ──────────────────────────────────────────────── */
function StarRating({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} size={12}
          fill={s <= Math.round(value) ? 'var(--warning)' : 'none'}
          color={s <= Math.round(value) ? 'var(--warning)' : 'var(--border)'}
        />
      ))}
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginLeft: 4 }}>{value.toFixed(1)}</span>
    </div>
  );
}

/* ─── Modal Form ──────────────────────────────────────────────── */
function ProveedorForm({ proveedor, onClose, onSaved }: { proveedor?: Proveedor | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nombre: proveedor?.nombre ?? '',
    contacto: proveedor?.contacto ?? '',
    telefono: proveedor?.telefono ?? '',
    email: proveedor?.email ?? '',
    ciudad: proveedor?.ciudad ?? '',
    nit: proveedor?.nit ?? '',
    tiempo_entrega_dias: proveedor?.tiempo_entrega_dias ?? 1,
    condiciones_pago: proveedor?.condiciones_pago ?? 'Contado',
    notas: proveedor?.notas ?? '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('No autenticado'); setLoading(false); return; }

    const empresa_id = getEmpresaId();
    if (!empresa_id) { toast.error('Sin empresa asignada'); setLoading(false); return; }

    const payload = { ...form, empresa_id, activo: true };

    let error;
    if (proveedor?.id) {
      ({ error } = await supabase.from('proveedores').update(payload).eq('id', proveedor.id));
    } else {
      ({ error } = await supabase.from('proveedores').insert([payload]));
    }

    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success(proveedor ? 'Proveedor actualizado ✓' : 'Proveedor creado ✓');
      onSaved();
    }
    setLoading(false);
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={proveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
      subtitle="Información corporativa y condiciones logísticas"
      icon={Truck}
      size="lg"
      bodyScroll="always"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <ActionButton loading={loading} style={{ minWidth: 140, justifyContent: 'center' }} onClick={handleSubmit as unknown as React.MouseEventHandler}>
            {loading ? 'Guardando...' : 'Guardar Proveedor'}
          </ActionButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Empresa</h3>
          <div className="modal-form-grid modal-form-grid--2-1">
            <div className="input-wrapper">
              <label className="form-label">Nombre Empresa *</label>
              <input className="input" value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} required placeholder="Energía Colombia SAS" />
            </div>
            <div className="input-wrapper">
              <label className="form-label">NIT</label>
              <input className="input" value={form.nit} onChange={e => setForm(f => ({...f, nit: e.target.value}))} placeholder="900123456" />
            </div>
          </div>
        </div>
        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Contacto</h3>
          <div className="modal-form-grid">
            <div className="input-wrapper">
              <label className="form-label">Representante / Contacto</label>
              <input className="input" value={form.contacto} onChange={e => setForm(f => ({...f, contacto: e.target.value}))} placeholder="Nombre del vendedor" />
            </div>
            <div className="input-wrapper">
              <label className="form-label">Teléfono</label>
              <input className="input" value={form.telefono} onChange={e => setForm(f => ({...f, telefono: e.target.value}))} placeholder="601-xxx-xxxx" />
            </div>
            <div className="input-wrapper">
              <label className="form-label">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="ventas@empresa.com" />
            </div>
            <div className="input-wrapper">
              <label className="form-label">Ciudad</label>
              <input className="input" value={form.ciudad} onChange={e => setForm(f => ({...f, ciudad: e.target.value}))} placeholder="Bogotá" />
            </div>
          </div>
        </div>
        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Condiciones</h3>
          <div className="modal-form-grid">
            <div className="input-wrapper">
              <label className="form-label">Tiempo de Entrega Estimado</label>
              <div style={{ position: 'relative' }}>
                <input type="number" min={1} className="input" value={form.tiempo_entrega_dias} onChange={e => setForm(f => ({...f, tiempo_entrega_dias: +e.target.value}))} style={{ paddingRight: 40 }} />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-muted)' }}>días</span>
              </div>
            </div>
            <div className="input-wrapper">
              <label className="form-label">Condiciones de Pago</label>
              <select className="select" value={form.condiciones_pago} onChange={e => setForm(f => ({...f, condiciones_pago: e.target.value}))}>
                {['Contado', '8 días', '15 días', '30 días', '45 días', '60 días'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="input-wrapper">
            <label className="form-label">Notas Adicionales</label>
            <input className="input" value={form.notas} onChange={e => setForm(f => ({...f, notas: e.target.value}))} placeholder="Observaciones, acuerdos, descuentos especiales..." />
          </div>
        </div>
      </form>
    </FormModal>
  );
}

/* ─── Main Page ───────────────────────────────────────────────── */
export default function ProveedoresPage() {
  const { empresaId } = useEmpresa();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editProv, setEditProv] = useState<Proveedor | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchProveedores = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    const { data, error } = await supabase.from('proveedores').select('*').eq('empresa_id', empresaId).order('nombre');
    if (error) toast.error('Error al cargar proveedores');
    else setProveedores(data || []);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => { fetchProveedores(); }, [fetchProveedores]);

  const filtered = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (p.contacto ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setPage(1); }, [search]);

  const moduleStats = [
    { label: 'Proveedores', value: proveedores.length, icon: Building2, tone: 'brand' as const },
    { label: 'Activos', value: proveedores.filter(p => p.activo).length, icon: ShieldCheck, tone: 'success' as const },
    { label: 'Calificación', value: `★ ${proveedores.length ? Math.max(...proveedores.map(p => p.calificacion ?? 0)).toFixed(1) : '0.0'}`, icon: Star, tone: 'warning' as const },
    { label: 'Entrega prom.', value: `${proveedores.length ? (proveedores.reduce((s,p) => s + (p.tiempo_entrega_dias ?? 0), 0) / proveedores.length).toFixed(0) : 0}d`, icon: Clock, tone: 'neutral' as const },
  ];

  return (
    <ModuleShell
      boundedTable
      stats={moduleStats}
      toolbar={
        <>
          <SearchField value={search} onChange={setSearch} placeholder="Buscar proveedor..." />
          <ActionButton id="btn-nuevo-proveedor" size="sm" icon={<Plus size={14} />} style={{ marginLeft: 'auto' }} onClick={() => { setEditProv(null); setShowForm(true); }}>
            Nuevo Proveedor
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
          <div className="empty-icon"><Building2 size={24} /></div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{search ? 'No se encontraron proveedores' : 'Sin proveedores'}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {search ? `No hay resultados para "${search}"` : 'Agrega tu primer proveedor a la red'}
          </div>
          {!search && (
            <ActionButton size="sm" icon={<Plus size={14} />} style={{ marginTop: 8 }} onClick={() => { setEditProv(null); setShowForm(true); }}>
              Agregar Proveedor
            </ActionButton>
          )}
        </div>
      ) : (
        <TablePanel pagination={{ currentPage, totalPages, totalItems: filtered.length, pageSize, onPageChange: setPage }}>
          <table className="table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Contacto</th>
                <th>Rating</th>
                <th>Entrega</th>
                <th>Pago</th>
                <th>Estado</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {paginated.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{
                        width: 34, height: 34, fontSize: 12, borderRadius: 10,
                        background: 'var(--brand-soft)', color: 'var(--brand)', border: '1px solid var(--brand-border)',
                      }}>
                        {p.nombre[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{p.nombre}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.ciudad || p.nit || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12 }}>{p.contacto || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.telefono || p.email || '—'}</div>
                  </td>
                  <td><StarRating value={p.calificacion ?? 0} /></td>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{p.tiempo_entrega_dias ?? 1} días</td>
                  <td style={{ fontSize: 12, color: 'var(--brand)' }}>{p.condiciones_pago ?? 'Contado'}</td>
                  <td>
                    <span className={`badge ${p.activo ? 'badge-success' : 'badge-muted'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-icon btn-icon-sm" title="Editar" onClick={() => { setEditProv(p); setShowForm(true); }}>
                        <Edit2 size={12} />
                      </button>
                      <Link href="/compras" className="btn-icon btn-icon-sm" title="Nueva orden" style={{ textDecoration: 'none' }}>
                        <ShoppingCart size={12} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablePanel>
      )}

      {showForm && (
        <ProveedorForm
          proveedor={editProv}
          onClose={() => { setShowForm(false); setEditProv(null); }}
          onSaved={() => { setShowForm(false); setEditProv(null); fetchProveedores(); }}
        />
      )}
    </ModuleShell>
  );
}
