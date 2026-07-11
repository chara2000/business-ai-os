'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Tag, Bookmark, History, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { getEmpresaId } from '@/lib/getEmpresaId';
import { useEmpresa } from '@/lib/hooks/useEmpresa';
import { ActionButton } from '@/components/ui/ActionButton';
import { FormModal } from '@/components/ui/FormModal';
import { SearchField } from '@/components/ui/SearchField';
import { TablePanel } from '@/components/ui/TablePanel';
import { useClientPagination } from '@/lib/hooks/useClientPagination';
import type { Categoria, Marca } from '@/types';

const supabase = createClient();

type Movimiento = {
  id: string;
  tipo: string;
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  motivo?: string;
  referencia_tipo?: string;
  created_at: string;
  producto?: { nombre: string; codigo: string };
  usuario?: { nombre: string; apellido: string };
};

function SimpleFormModal({
  title, fields, initial, onClose, onSave,
}: {
  title: string;
  fields: { key: string; label: string; placeholder?: string }[];
  initial: Record<string, string>;
  onClose: () => void;
  onSave: (data: Record<string, string>) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave(form);
    setLoading(false);
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={title}
      icon={Tag}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <ActionButton loading={loading} onClick={handleSubmit as unknown as React.MouseEventHandler}>Guardar</ActionButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="modal-form">
        {fields.map((f) => (
          <div key={f.key} className="input-wrapper">
            <label className="form-label">{f.label}</label>
            <input className="input" value={form[f.key] ?? ''} placeholder={f.placeholder}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))} required />
          </div>
        ))}
      </form>
    </FormModal>
  );
}

export function CategoriasPanel() {
  const { empresaId } = useEmpresa();
  const [items, setItems] = useState<Categoria[]>([]);
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<Categoria | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!empresaId) return;
    const { data } = await supabase.from('categorias').select('*').eq('empresa_id', empresaId).order('nombre');
    setItems(data ?? []);
  }, [empresaId]);

  useEffect(() => { load(); }, [load]);

  const save = async (form: Record<string, string>) => {
    const empresa_id = getEmpresaId();
    if (!empresa_id) return;
    const payload = { empresa_id, nombre: form.nombre, descripcion: form.descripcion || null };
    const { error } = edit
      ? await supabase.from('categorias').update(payload).eq('id', edit.id)
      : await supabase.from('categorias').insert([payload]);
    if (error) toast.error(error.message);
    else { toast.success('Categoría guardada'); setShowForm(false); setEdit(null); load(); }
  };

  const filtered = items.filter((c) => c.nombre.toLowerCase().includes(search.toLowerCase()));
  const { paginated, pagination } = useClientPagination(filtered, 10, [search]);

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <SearchField value={search} onChange={setSearch} placeholder="Buscar categoría..." />
        <ActionButton size="sm" icon={<Plus size={14} />} style={{ marginLeft: 'auto' }} onClick={() => { setEdit(null); setShowForm(true); }}>
          Nueva Categoría
        </ActionButton>
      </div>
      <TablePanel pagination={pagination}>
        <table className="table">
          <thead><tr><th>Nombre</th><th>Descripción</th><th style={{ width: 80 }} /></tr></thead>
          <tbody>
            {paginated.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{c.descripcion ?? '—'}</td>
                <td>
                  <button className="btn-icon" style={{ width: 26, height: 26 }} onClick={() => { setEdit(c); setShowForm(true); }}>
                    <Edit2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>
      {showForm && (
        <SimpleFormModal
          title={edit ? 'Editar Categoría' : 'Nueva Categoría'}
          fields={[
            { key: 'nombre', label: 'Nombre *', placeholder: 'Ej: Herramientas' },
            { key: 'descripcion', label: 'Descripción', placeholder: 'Opcional' },
          ]}
          initial={{ nombre: edit?.nombre ?? '', descripcion: edit?.descripcion ?? '' }}
          onClose={() => { setShowForm(false); setEdit(null); }}
          onSave={save}
        />
      )}
    </>
  );
}

export function MarcasPanel() {
  const { empresaId } = useEmpresa();
  const [items, setItems] = useState<Marca[]>([]);
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<Marca | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!empresaId) return;
    const { data } = await supabase.from('marcas').select('*').eq('empresa_id', empresaId).order('nombre');
    setItems(data ?? []);
  }, [empresaId]);

  useEffect(() => { load(); }, [load]);

  const save = async (form: Record<string, string>) => {
    const empresa_id = getEmpresaId();
    if (!empresa_id) return;
    const payload = { empresa_id, nombre: form.nombre };
    const { error } = edit
      ? await supabase.from('marcas').update(payload).eq('id', edit.id)
      : await supabase.from('marcas').insert([payload]);
    if (error) toast.error(error.message);
    else { toast.success('Marca guardada'); setShowForm(false); setEdit(null); load(); }
  };

  const filtered = items.filter((m) => m.nombre.toLowerCase().includes(search.toLowerCase()));
  const { paginated, pagination } = useClientPagination(filtered, 10, [search]);

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <SearchField value={search} onChange={setSearch} placeholder="Buscar marca..." />
        <ActionButton size="sm" icon={<Plus size={14} />} style={{ marginLeft: 'auto' }} onClick={() => { setEdit(null); setShowForm(true); }}>
          Nueva Marca
        </ActionButton>
      </div>
      <TablePanel pagination={pagination}>
        <table className="table">
          <thead><tr><th>Marca</th><th style={{ width: 80 }} /></tr></thead>
          <tbody>
            {paginated.map((m) => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>{m.nombre}</td>
                <td>
                  <button className="btn-icon" style={{ width: 26, height: 26 }} onClick={() => { setEdit(m); setShowForm(true); }}>
                    <Edit2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>
      {showForm && (
        <SimpleFormModal
          title={edit ? 'Editar Marca' : 'Nueva Marca'}
          fields={[{ key: 'nombre', label: 'Nombre *', placeholder: 'Ej: Bosch' }]}
          initial={{ nombre: edit?.nombre ?? '' }}
          onClose={() => { setShowForm(false); setEdit(null); }}
          onSave={save}
        />
      )}
    </>
  );
}

export function KardexPanel() {
  const { empresaId } = useEmpresa();
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;
    setLoading(true);
    supabase
      .from('movimientos_inventario')
      .select('*, producto:productos(nombre, codigo), usuario:usuarios(nombre, apellido)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) toast.error('Error al cargar kardex');
        else setMovs(data ?? []);
        setLoading(false);
      });
  }, [empresaId]);

  const filtered = movs.filter((m) =>
    (m.producto?.nombre ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (m.motivo ?? '').toLowerCase().includes(search.toLowerCase()),
  );
  const { paginated, pagination } = useClientPagination(filtered, 10, [search]);

  if (loading) {
    return <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />;
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <SearchField value={search} onChange={setSearch} placeholder="Buscar producto o motivo..." />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <History size={14} /> Últimos 100 movimientos
        </span>
      </div>
      <TablePanel pagination={pagination}>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Tipo</th>
              <th>Cant.</th>
              <th>Stock</th>
              <th>Motivo</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((m) => (
              <tr key={m.id}>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(m.created_at).toLocaleString('es-CO')}</td>
                <td style={{ fontWeight: 600 }}>{m.producto?.nombre ?? '—'}</td>
                <td><span className={`badge ${m.tipo === 'entrada' ? 'badge-success' : m.tipo === 'salida' ? 'badge-danger' : 'badge-muted'}`}>{m.tipo}</span></td>
                <td>{m.cantidad}</td>
                <td>{m.stock_anterior} → {m.stock_nuevo}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{m.motivo ?? m.referencia_tipo ?? '—'}</td>
                <td style={{ fontSize: 12 }}>{m.usuario ? `${m.usuario.nombre}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>
    </>
  );
}

export const INVENTARIO_TABS = [
  { id: 'productos', label: 'Productos', icon: Tag },
  { id: 'prediccion', label: 'Predicción', icon: TrendingUp },
  { id: 'categorias', label: 'Categorías', icon: Bookmark },
  { id: 'marcas', label: 'Marcas', icon: Bookmark },
  { id: 'kardex', label: 'Kardex', icon: History },
] as const;

export type InventarioTabId = (typeof INVENTARIO_TABS)[number]['id'];
