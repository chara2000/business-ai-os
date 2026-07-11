'use client';

import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Plus, Trash2, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { useEmpresa } from '@/lib/hooks/useEmpresa';
import { getUsuarioId } from '@/lib/db-helpers';
import { ActionButton } from '@/components/ui/ActionButton';
import { FormModal } from '@/components/ui/FormModal';
import { ModuleShell } from '@/components/ui/ModuleShell';
import { TablePanel } from '@/components/ui/TablePanel';
import { SearchField } from '@/components/ui/SearchField';
import { ClientDate } from '@/components/ui/ClientDate';
import type { Gasto } from '@/types';

const supabase = createClient();

const CATEGORIAS_GASTO = [
  'Servicios Públicos',
  'Arriendo',
  'Nómina',
  'Mantenimiento',
  'Marketing',
  'Insumos Oficina',
  'Impuestos',
  'Transporte',
  'Otros'
];

function NuevoGastoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { empresaId } = useEmpresa();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    concepto: '',
    categoria: 'Otros',
    monto: '',
    metodo_pago: 'efectivo',
    notas: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) return;
    const usuario_id = getUsuarioId();
    if (!usuario_id) return;

    if (!form.concepto || !form.monto) {
      toast.error('Concepto y monto son obligatorios');
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('gastos').insert([{
      empresa_id: empresaId,
      concepto: form.concepto,
      categoria: form.categoria,
      monto: Number(form.monto),
      metodo_pago: form.metodo_pago,
      notas: form.notas,
      usuario_id
    }]);

    setLoading(false);
    if (error) {
      toast.error('Error al registrar gasto: ' + error.message);
    } else {
      toast.success('Gasto registrado con éxito');
      onSaved();
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title="Registrar Gasto"
      subtitle="Ingresa los detalles del gasto operativo"
      icon={Receipt}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <ActionButton loading={loading} onClick={handleSubmit as unknown as React.MouseEventHandler}>
            Guardar Gasto
          </ActionButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="input-wrapper">
          <label className="form-label">Concepto (Descripción)</label>
          <input
            type="text"
            className="input"
            required
            value={form.concepto}
            onChange={(e) => setForm({ ...form, concepto: e.target.value })}
            placeholder="Ej. Pago de luz eléctrica"
          />
        </div>
        <div className="modal-form-grid">
          <div className="input-wrapper">
            <label className="form-label">Monto ($)</label>
            <input
              type="number"
              className="input"
              required
              min={0}
              value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="input-wrapper">
            <label className="form-label">Categoría</label>
            <select
              className="select"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              {CATEGORIAS_GASTO.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-form-grid">
          <div className="input-wrapper">
            <label className="form-label">Método de Pago</label>
            <select
              className="select"
              value={form.metodo_pago}
              onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })}
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>
        <div className="input-wrapper">
          <label className="form-label">Notas Adicionales</label>
          <textarea
            className="input"
            rows={2}
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
          />
        </div>
      </form>
    </FormModal>
  );
}

export default function GastosPage() {
  const { empresaId } = useEmpresa();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNuevo, setShowNuevo] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const fetchGastos = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('gastos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false });
      
    if (error) {
      toast.error('Error al cargar gastos');
    } else {
      setGastos(data || []);
    }
    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    fetchGastos();
  }, [fetchGastos]);

  const filtered = gastos.filter(g => 
    g.concepto.toLowerCase().includes(search.toLowerCase()) || 
    g.categoria.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totalMonto = filtered.reduce((s, g) => s + g.monto, 0);

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este gasto permanentemente?')) return;
    const { error } = await supabase.from('gastos').delete().eq('id', id);
    if (error) toast.error('Error: ' + error.message);
    else {
      toast.success('Gasto eliminado');
      setGastos(prev => prev.filter(g => g.id !== id));
    }
  };

  const moduleStats = [
    { label: 'Total Gastos', value: `$${totalMonto.toLocaleString()}`, icon: DollarSign, tone: 'warning' as const },
    { label: 'Registros', value: filtered.length, icon: Receipt, tone: 'brand' as const },
  ];

  return (
    <ModuleShell
      boundedTable={false}
      stats={moduleStats}
      toolbar={
        <>
          <SearchField value={search} onChange={setSearch} placeholder="Buscar por concepto o categoría..." />
          <ActionButton
            icon={<Plus size={14} />}
            style={{ marginLeft: 'auto' }}
            onClick={() => setShowNuevo(true)}
          >
            Registrar Gasto
          </ActionButton>
        </>
      }
    >
      {loading ? (
        <div className="card" style={{ padding: 24, minHeight: 400 }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 40, width: '100%', borderRadius: 8, marginBottom: 12 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon"><Receipt size={24} /></div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {search ? 'No se encontraron gastos' : 'No has registrado gastos'}
          </div>
          {!search && (
            <ActionButton icon={<Plus size={14} />} style={{ marginTop: 8 }} onClick={() => setShowNuevo(true)}>
              Registrar el primero
            </ActionButton>
          )}
        </div>
      ) : (
        <TablePanel pagination={{ currentPage: page, totalPages, totalItems: filtered.length, pageSize, onPageChange: setPage }}>
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Categoría</th>
                <th>Método</th>
                <th>Monto</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {paginated.map((g) => (
                <tr key={g.id}>
                  <td style={{ color: 'var(--text-muted)' }}>
                    <ClientDate value={g.fecha} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{g.concepto}</td>
                  <td><span className="badge badge-muted">{g.categoria}</span></td>
                  <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{g.metodo_pago}</td>
                  <td style={{ fontWeight: 800, color: 'var(--danger)' }}>-${g.monto.toLocaleString()}</td>
                  <td>
                    <button type="button" className="btn-icon btn-icon-sm btn-icon-danger" onClick={() => handleDelete(g.id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablePanel>
      )}

      {showNuevo && (
        <NuevoGastoModal onClose={() => setShowNuevo(false)} onSaved={() => { setShowNuevo(false); fetchGastos(); }} />
      )}
    </ModuleShell>
  );
}
