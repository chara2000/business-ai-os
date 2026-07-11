'use client';

import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Plus, Package, DollarSign, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { getEmpresaId } from '@/lib/getEmpresaId';
import { getUsuarioId } from '@/lib/db-helpers';
import { logAudit } from '@/lib/audit';
import { useEmpresa } from '@/lib/hooks/useEmpresa';
import { ActionButton } from '@/components/ui/ActionButton';
import { FormModal } from '@/components/ui/FormModal';
import { ModuleShell } from '@/components/ui/ModuleShell';
import { SearchField } from '@/components/ui/SearchField';
import { TablePanel } from '@/components/ui/TablePanel';
import { ClientDate } from '@/components/ui/ClientDate';
import type { Devolucion, ReturnStatus } from '@/types';

const supabase = createClient();

const ESTADOS: Record<ReturnStatus, string> = {
  devuelto_inventario: 'Devuelto a inventario',
  garantia: 'Garantía',
  proveedor: 'A proveedor',
  perdida: 'Pérdida',
};

type VentaOpt = {
  id: string;
  numero: string;
  items_venta?: { producto_id: string; cantidad: number; precio_unitario: number; producto?: { nombre: string } }[];
};

function NuevaDevolucionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const empresaId = getEmpresaId();
  const [ventas, setVentas] = useState<VentaOpt[]>([]);
  const [productos, setProductos] = useState<{ id: string; nombre: string; stock_actual: number }[]>([]);
  const [ventaId, setVentaId] = useState('');
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [motivo, setMotivo] = useState('');
  const [estado, setEstado] = useState<ReturnStatus>('devuelto_inventario');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    Promise.all([
      supabase.from('ventas').select('id, numero, items_venta(producto_id, cantidad, precio_unitario, producto:productos(nombre))').eq('empresa_id', empresaId).neq('estado', 'cancelada').order('created_at', { ascending: false }).limit(50),
      supabase.from('productos').select('id, nombre, stock_actual').eq('empresa_id', empresaId).eq('activo', true),
    ]).then(([v, p]) => {
      setVentas((v.data ?? []) as unknown as VentaOpt[]);
      setProductos(p.data ?? []);
    });
  }, [empresaId]);

  const ventaSel = ventas.find((v) => v.id === ventaId);
  const productosVenta = ventaSel?.items_venta ?? [];
  const productoOpts = ventaId && productosVenta.length > 0
    ? productosVenta.map((it) => ({ id: it.producto_id, nombre: it.producto?.nombre ?? 'Producto', max: it.cantidad }))
    : productos.map((p) => ({ id: p.id, nombre: p.nombre, max: 9999 }));

  const precioUnit = productosVenta.find((it) => it.producto_id === productoId)?.precio_unitario ?? 0;
  const montoDevuelto = precioUnit * cantidad;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productoId || !motivo.trim()) { toast.error('Producto y motivo son requeridos'); return; }
    if (cantidad <= 0) { toast.error('Cantidad inválida'); return; }

    const empresa_id = getEmpresaId();
    const usuario_id = getUsuarioId();
    if (!empresa_id || !usuario_id) { toast.error('Sin contexto de empresa'); return; }

    setLoading(true);
    const { data: producto } = await supabase.from('productos').select('stock_actual, precio_costo').eq('id', productoId).single();

    const { data: devolucion, error } = await supabase.from('devoluciones').insert([{
      empresa_id,
      venta_id: ventaId || null,
      producto_id: productoId,
      cantidad,
      motivo: motivo.trim(),
      estado,
      monto_devuelto: montoDevuelto,
      usuario_id,
    }]).select('id').single();

    if (error || !devolucion) {
      toast.error('Error: ' + (error?.message ?? 'desconocido'));
      setLoading(false);
      return;
    }

    if (estado === 'devuelto_inventario' && producto) {
      const stockNuevo = producto.stock_actual + cantidad;
      await supabase.from('productos').update({ stock_actual: stockNuevo }).eq('id', productoId);
      await supabase.from('movimientos_inventario').insert([{
        empresa_id,
        producto_id: productoId,
        tipo: 'entrada',
        cantidad,
        stock_anterior: producto.stock_actual,
        stock_nuevo: stockNuevo,
        costo_unitario: producto.precio_costo,
        motivo: `Devolución: ${motivo.trim()}`,
        referencia_id: devolucion.id,
        referencia_tipo: 'devolucion',
        usuario_id,
      }]);
    }

    if (ventaId) {
      await supabase.from('ventas').update({ estado: 'devuelta' }).eq('id', ventaId);
    }

    await logAudit(supabase, {
      empresaId: empresa_id,
      usuarioId: usuario_id,
      accion: 'crear_devolucion',
      entidad: 'devolucion',
      entidadId: devolucion.id,
      datosNuevos: { producto_id: productoId, cantidad, monto_devuelto: montoDevuelto },
    });

    toast.success('Devolución registrada ✓');
    onSaved();
    setLoading(false);
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title="Nueva Devolución"
      subtitle="Registra devolución de producto"
      icon={RotateCcw}
      size="lg"
      bodyScroll="always"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <ActionButton loading={loading} onClick={handleSubmit as unknown as React.MouseEventHandler}>
            Registrar
          </ActionButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-section">
          <div className="input-wrapper">
            <label className="form-label">Venta relacionada (opcional)</label>
            <select className="select" value={ventaId} onChange={(e) => { setVentaId(e.target.value); setProductoId(''); }}>
              <option value="">Sin venta vinculada</option>
              {ventas.map((v) => <option key={v.id} value={v.id}>{v.numero}</option>)}
            </select>
          </div>
          <div className="modal-form-grid">
            <div className="input-wrapper">
              <label className="form-label">Producto *</label>
              <select className="select" value={productoId} onChange={(e) => setProductoId(e.target.value)} required>
                <option value="">Seleccionar</option>
                {productoOpts.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="input-wrapper">
              <label className="form-label">Cantidad *</label>
              <input type="number" className="input" min={1} value={cantidad} onChange={(e) => setCantidad(+e.target.value)} required />
            </div>
          </div>
          <div className="input-wrapper">
            <label className="form-label">Motivo *</label>
            <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: Producto defectuoso" required />
          </div>
          <div className="input-wrapper">
            <label className="form-label">Estado</label>
            <select className="select" value={estado} onChange={(e) => setEstado(e.target.value as ReturnStatus)}>
              {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {montoDevuelto > 0 && (
            <div className="modal-info-row modal-info-row--warning">
              <span className="muted">Monto a devolver</span>
              <strong>${montoDevuelto.toLocaleString('es-CO')}</strong>
            </div>
          )}
        </div>
      </form>
    </FormModal>
  );
}

export default function DevolucionesPage() {
  const { empresaId } = useEmpresa();
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchData = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('devoluciones')
      .select('*, producto:productos(nombre, codigo), cliente:clientes(nombre)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false });
    if (error) toast.error('Error al cargar devoluciones');
    else setDevoluciones(data ?? []);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = devoluciones.filter((d) =>
    d.motivo.toLowerCase().includes(search.toLowerCase()) ||
    (d.producto?.nombre ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalMonto = devoluciones.reduce((s, d) => s + (d.monto_devuelto ?? 0), 0);

  const moduleStats = [
    { label: 'Devoluciones', value: devoluciones.length, icon: RotateCcw, tone: 'brand' as const },
    { label: 'Monto devuelto', value: `$${(totalMonto / 1000).toFixed(0)}K`, icon: DollarSign, tone: 'warning' as const },
    { label: 'A inventario', value: devoluciones.filter((d) => d.estado === 'devuelto_inventario').length, icon: Package, tone: 'success' as const },
    { label: 'Pérdidas', value: devoluciones.filter((d) => d.estado === 'perdida').length, icon: AlertTriangle, tone: 'danger' as const },
  ];

  return (
    <ModuleShell
      boundedTable
      stats={moduleStats}
      toolbar={
        <>
          <SearchField value={search} onChange={setSearch} placeholder="Buscar por producto o motivo..." />
          <ActionButton size="sm" icon={<Plus size={14} />} style={{ marginLeft: 'auto' }} onClick={() => setShowForm(true)}>
            Nueva Devolución
          </ActionButton>
        </>
      }
    >
      {loading ? (
        <div className="data-panel" style={{ padding: 16 }}>
          <div className="skeleton" style={{ height: 40, width: '100%', borderRadius: 8 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon"><RotateCcw size={24} /></div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>Sin devoluciones registradas</div>
          <ActionButton icon={<Plus size={14} />} style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>
            Registrar Devolución
          </ActionButton>
        </div>
      ) : (
        <TablePanel pagination={{ currentPage, totalPages, totalItems: filtered.length, pageSize, onPageChange: setPage }}>
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th>Monto</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.producto?.nombre ?? '—'}</td>
                  <td>{d.cantidad}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{d.motivo}</td>
                  <td><span className="badge badge-muted">{ESTADOS[d.estado]}</span></td>
                  <td style={{ fontWeight: 700 }}>${(d.monto_devuelto ?? 0).toLocaleString('es-CO')}</td>
                  <td style={{ color: 'var(--text-muted)' }}><ClientDate value={d.created_at} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablePanel>
      )}

      {showForm && (
        <NuevaDevolucionModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData(); }} />
      )}
    </ModuleShell>
  );
}
