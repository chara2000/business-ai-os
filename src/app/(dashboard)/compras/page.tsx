'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, Plus, Eye, Check, Scan,
  DollarSign, Package, ChevronRight, CheckCircle2,
  Clock, Building2, Trash2, Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { getEmpresaId } from '@/lib/getEmpresaId';
import { getUsuarioId, generateDocNumber } from '@/lib/db-helpers';
import { calcImpuestos, getTasaIva, formatTasaIva } from '@/lib/tax';
import { useEmpresa } from '@/lib/hooks/useEmpresa';
import { ActionButton } from '@/components/ui/ActionButton';
import { FormModal } from '@/components/ui/FormModal';
import { ClientDate } from '@/components/ui/ClientDate';
import { Modal } from '@/components/ui/Modal';
import { ModuleShell } from '@/components/ui/ModuleShell';
import { SearchField } from '@/components/ui/SearchField';
import { TablePanel } from '@/components/ui/TablePanel';
import { InvoiceScanModal } from '@/components/ocr/InvoiceScanModal';
import type { ParsedInvoice } from '@/lib/ocr/parse-invoice';

const supabase = createClient();

const ESTADOS = {
  solicitud: { label: 'Solicitud', class: 'badge-muted' },
  cotizacion: { label: 'Cotización', class: 'badge-warning' },
  orden: { label: 'Orden Enviada', class: 'badge-info' },
  recibida: { label: 'Recibida', class: 'badge-success' },
  cancelada: { label: 'Cancelada', class: 'badge-danger' },
};

type Orden = {
  id: string;
  numero: string;
  estado: string;
  total: number;
  created_at: string;
  fecha_entrega_esperada?: string;
  notas?: string;
  proveedor_id?: string;
  metodo_pago?: string;
  es_credito?: boolean;
  proveedor?: { nombre: string };
  items_orden_compra?: { id: string; producto_id: string; cantidad: number; precio_unitario: number; subtotal: number; producto?: { nombre: string; codigo: string } }[];
};

type LineItem = { producto_id: string; cantidad: number; precio: number; subtotal: number };

function NuevaOrdenModal({ onClose, onSaved, tasaIva }: { onClose: () => void; onSaved: () => void; tasaIva: number }) {
  const empresaId = getEmpresaId();
  const [proveedores, setProveedores] = useState<{ id: string; nombre: string }[]>([]);
  const [productos, setProductos] = useState<{ id: string; nombre: string; codigo: string; precio_costo: number }[]>([]);
  const [proveedorId, setProveedorId] = useState('');
  const [estado, setEstado] = useState('solicitud');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [notas, setNotas] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [esCredito, setEsCredito] = useState(false);
  const [items, setItems] = useState<LineItem[]>([{ producto_id: '', cantidad: 1, precio: 0, subtotal: 0 }]);
  const [loading, setLoading] = useState(false);
  const [showOcr, setShowOcr] = useState(false);

  const applyOcr = (data: ParsedInvoice) => {
    setNotas([data.proveedor_nombre, data.nit ? `NIT: ${data.nit}` : '', data.concepto, data.notas].filter(Boolean).join(' · '));
    if (data.total > 0) toast.success(`Factura leída: $${data.total.toLocaleString('es-CO')}`);
  };

  useEffect(() => {
    if (!empresaId) return;
    Promise.all([
      supabase.from('proveedores').select('id, nombre').eq('empresa_id', empresaId).eq('activo', true),
      supabase.from('productos').select('id, nombre, codigo, precio_costo').eq('empresa_id', empresaId).eq('activo', true),
    ]).then(([p, pr]) => {
      setProveedores(p.data ?? []);
      setProductos(pr.data ?? []);
    });
  }, [empresaId]);

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const { impuestos, total } = calcImpuestos(subtotal, 0, tasaIva);

  const updateItem = (idx: number, productoId: string) => {
    const prod = productos.find((p) => p.id === productoId);
    setItems((it) =>
      it.map((item, i) => {
        if (i !== idx) return item;
        const precio = prod?.precio_costo ?? 0;
        const cantidad = item.cantidad || 1;
        return { producto_id: productoId, cantidad, precio, subtotal: cantidad * precio };
      }),
    );
  };

  const updateCantidad = (idx: number, cantidad: number) => {
    setItems((it) =>
      it.map((item, i) => {
        if (i !== idx) return item;
        const qty = Math.max(1, cantidad);
        return { ...item, cantidad: qty, subtotal: qty * item.precio };
      }),
    );
  };

  const updatePrecio = (idx: number, precio: number) => {
    setItems((it) =>
      it.map((item, i) => {
        if (i !== idx) return item;
        const p = Math.max(0, precio);
        return { ...item, precio: p, subtotal: item.cantidad * p };
      }),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorId) { toast.error('Selecciona un proveedor'); return; }
    if (items.some((i) => !i.producto_id)) { toast.error('Completa todos los productos'); return; }

    const empresa_id = getEmpresaId();
    const usuario_id = getUsuarioId();
    if (!empresa_id || !usuario_id) { toast.error('Sin contexto de empresa'); return; }

    setLoading(true);
    const numero = generateDocNumber('OC');

    const { data: orden, error } = await supabase.from('ordenes_compra').insert([{
      empresa_id,
      proveedor_id: proveedorId,
      numero,
      estado,
      subtotal,
      descuento: 0,
      impuestos,
      total,
      fecha_entrega_esperada: fechaEntrega || null,
      notas,
      metodo_pago: metodoPago,
      es_credito: esCredito,
      usuario_id,
    }]).select('id').single();

    if (error || !orden) {
      toast.error('Error: ' + (error?.message ?? 'desconocido'));
      setLoading(false);
      return;
    }

    const { error: itemsError } = await supabase.from('items_orden_compra').insert(
      items.map((i) => ({
        orden_compra_id: orden.id,
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio,
        subtotal: i.subtotal,
        cantidad_recibida: 0,
      })),
    );

    if (itemsError) toast.error('Error en ítems: ' + itemsError.message);
    else { toast.success('Orden creada ✓'); onSaved(); }
    setLoading(false);
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title="Nueva Orden de Compra"
      subtitle="Solicitud de reabastecimiento"
      icon={ShoppingCart}
      size="xl"
      bodyScroll="always"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <ActionButton loading={loading} onClick={handleSubmit as unknown as React.MouseEventHandler}>
            {loading ? 'Guardando...' : 'Crear Orden'}
          </ActionButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div style={{ marginBottom: 8 }}>
          <button type="button" className="btn-secondary" onClick={() => setShowOcr(true)}>
            <Scan size={16} /> Escanear factura de proveedor
          </button>
        </div>
        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Proveedor</h3>
          <div className="modal-form-grid">
            <div className="input-wrapper">
              <label className="form-label">Proveedor *</label>
              <select className="select" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} required>
                <option value="">Seleccionar...</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="input-wrapper">
              <label className="form-label">Estado inicial</label>
              <select className="select" value={estado} onChange={(e) => setEstado(e.target.value)}>
                {Object.entries(ESTADOS).filter(([k]) => k !== 'cancelada' && k !== 'recibida').map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="input-wrapper">
              <label className="form-label">Entrega esperada</label>
              <input type="date" className="input" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
            </div>
            <div className="input-wrapper">
              <label className="form-label">Método de pago</label>
              <select className="select" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="nequi">Nequi</option>
                <option value="daviplata">Daviplata</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
            <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label className="form-label">Condición de pago</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: '40px' }}>
                <input type="checkbox" id="es_credito" checked={esCredito} onChange={(e) => setEsCredito(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--brand)' }} />
                <label htmlFor="es_credito" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Compra a Crédito</label>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-form-section">
          <div className="modal-section-head">
            <h3 className="modal-form-section-title">Productos</h3>
            <button type="button" className="btn-ghost" onClick={() => setItems((it) => [...it, { producto_id: '', cantidad: 1, precio: 0, subtotal: 0 }])}>
              <Plus size={14} /> Agregar
            </button>
          </div>
          <div className="modal-line-list">
            {items.map((item, idx) => (
              <div key={idx} className="modal-line-row">
                <select className="select" value={item.producto_id} onChange={(e) => updateItem(idx, e.target.value)} required style={{ flex: 2 }}>
                  <option value="">Producto</option>
                  {productos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
                </select>
                <input type="number" className="input" placeholder="Cant." min={1} value={item.cantidad} onChange={(e) => updateCantidad(idx, +e.target.value)} style={{ width: 80 }} />
                <input type="number" className="input" placeholder="Costo" min={0} value={item.precio} onChange={(e) => updatePrecio(idx, +e.target.value)} style={{ width: 120 }} />
                <div className="line-subtotal" style={{ width: 100, textAlign: 'right' }}>${item.subtotal.toLocaleString()}</div>
                {items.length > 1 && (
                  <button type="button" className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setItems((it) => it.filter((_, i) => i !== idx))}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="modal-info-row" style={{ marginTop: 12 }}>
            <span className="muted">Subtotal</span>
            <strong>${subtotal.toLocaleString()}</strong>
          </div>
          <div className="modal-info-row">
            <span className="muted">IVA ({formatTasaIva(tasaIva)})</span>
            <strong>${impuestos.toLocaleString()}</strong>
          </div>
          <div className="modal-info-row modal-info-row--success">
            <span className="muted">Total orden</span>
            <strong>${total.toLocaleString()}</strong>
          </div>
        </div>

        <div className="modal-form-section">
          <div className="input-wrapper">
            <label className="form-label">Notas</label>
            <input className="input" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones..." />
          </div>
        </div>
      </form>
      <InvoiceScanModal open={showOcr} onClose={() => setShowOcr(false)} onParsed={applyOcr} title="Escanear factura de compra" />
    </FormModal>
  );
}

function EditarOrdenModal({ orden, onClose, onSaved, tasaIva }: { orden: Orden; onClose: () => void; onSaved: () => void; tasaIva: number }) {
  const empresaId = getEmpresaId();
  const [proveedores, setProveedores] = useState<{ id: string; nombre: string }[]>([]);
  const [productos, setProductos] = useState<{ id: string; nombre: string; codigo: string; precio_costo: number }[]>([]);
  const [proveedorId, setProveedorId] = useState(orden.proveedor_id || '');
  const [estado, setEstado] = useState(orden.estado);
  const [fechaEntrega, setFechaEntrega] = useState(orden.fecha_entrega_esperada ? orden.fecha_entrega_esperada.split('T')[0] : '');
  const [notas, setNotas] = useState(orden.notas || '');
  const [metodoPago, setMetodoPago] = useState(orden.metodo_pago || 'efectivo');
  const [esCredito, setEsCredito] = useState(orden.es_credito || false);
  const [items, setItems] = useState<LineItem[]>(
    orden.items_orden_compra?.map((it) => ({
      producto_id: it.producto_id,
      cantidad: it.cantidad,
      precio: it.precio_unitario,
      subtotal: it.subtotal,
    })) || []
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    Promise.all([
      supabase.from('proveedores').select('id, nombre').eq('empresa_id', empresaId).eq('activo', true),
      supabase.from('productos').select('id, nombre, codigo, precio_costo').eq('empresa_id', empresaId).eq('activo', true),
    ]).then(([p, pr]) => {
      setProveedores(p.data ?? []);
      setProductos(pr.data ?? []);
    });
  }, [empresaId]);

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const { impuestos, total } = calcImpuestos(subtotal, 0, tasaIva);

  const updateItem = (idx: number, productoId: string) => {
    const prod = productos.find((p) => p.id === productoId);
    setItems((it) =>
      it.map((item, i) => {
        if (i !== idx) return item;
        const precio = prod?.precio_costo ?? 0;
        const cantidad = item.cantidad || 1;
        return { producto_id: productoId, cantidad, precio, subtotal: cantidad * precio };
      }),
    );
  };

  const updateCantidad = (idx: number, cantidad: number) => {
    setItems((it) =>
      it.map((item, i) => {
        if (i !== idx) return item;
        const qty = Math.max(1, cantidad);
        return { ...item, cantidad: qty, subtotal: qty * item.precio };
      }),
    );
  };

  const updatePrecio = (idx: number, precio: number) => {
    setItems((it) =>
      it.map((item, i) => {
        if (i !== idx) return item;
        const p = Math.max(0, precio);
        return { ...item, precio: p, subtotal: item.cantidad * p };
      }),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorId) { toast.error('Selecciona un proveedor'); return; }
    if (items.some((i) => !i.producto_id)) { toast.error('Completa todos los productos'); return; }

    setLoading(true);

    const yaEstabaRecibida = orden.estado === 'recibida';
    const ahoraRecibida = estado === 'recibida';

    const { error: updateError } = await supabase
      .from('ordenes_compra')
      .update({
        proveedor_id: proveedorId,
        estado,
        subtotal,
        impuestos,
        total,
        fecha_entrega_esperada: fechaEntrega || null,
        notas,
        metodo_pago: metodoPago,
        es_credito: esCredito,
      })
      .eq('id', orden.id);

    if (updateError) {
      toast.error('Error al actualizar orden: ' + updateError.message);
      setLoading(false);
      return;
    }

    await supabase.from('items_orden_compra').delete().eq('orden_compra_id', orden.id);

    const { error: itemsError } = await supabase.from('items_orden_compra').insert(
      items.map((i) => ({
        orden_compra_id: orden.id,
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio,
        subtotal: i.subtotal,
        cantidad_recibida: ahoraRecibida ? i.cantidad : 0,
      })),
    );

    if (itemsError) {
      toast.error('Error al actualizar ítems: ' + itemsError.message);
    } else {
      if (ahoraRecibida && !yaEstabaRecibida) {
        const empresa_id = getEmpresaId();
        const usuario_id = getUsuarioId();
        if (empresa_id && usuario_id) {
          for (const item of items) {
            const { data: prod } = await supabase.from('productos').select('stock_actual, precio_costo').eq('id', item.producto_id).single();
            if (!prod) continue;
            const stockNuevo = prod.stock_actual + item.cantidad;
            await supabase.from('productos').update({ stock_actual: stockNuevo, precio_costo: item.precio }).eq('id', item.producto_id);
            await supabase.from('movimientos_inventario').insert([{
              empresa_id,
              producto_id: item.producto_id,
              tipo: 'entrada',
              cantidad: item.cantidad,
              stock_anterior: prod.stock_actual,
              stock_nuevo: stockNuevo,
              costo_unitario: item.precio,
              motivo: `Recepción ${orden.numero}`,
              referencia_id: orden.id,
              referencia_tipo: 'orden_compra',
              usuario_id,
            }]);
          }
        }
      }
      toast.success('Orden actualizada ✓');
      onSaved();
    }
    setLoading(false);
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={`Editar Orden ${orden.numero}`}
      subtitle="Actualizar datos de reabastecimiento"
      icon={Pencil}
      size="xl"
      bodyScroll="always"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <ActionButton loading={loading} onClick={handleSubmit as unknown as React.MouseEventHandler}>
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </ActionButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Proveedor</h3>
          <div className="modal-form-grid">
            <div className="input-wrapper">
              <label className="form-label">Proveedor *</label>
              <select className="select" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} required disabled={orden.estado === 'recibida'}>
                <option value="">Seleccionar...</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="input-wrapper">
              <label className="form-label">Estado</label>
              <select className="select" value={estado} onChange={(e) => setEstado(e.target.value)} disabled={orden.estado === 'recibida'}>
                {Object.entries(ESTADOS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="input-wrapper">
              <label className="form-label">Entrega esperada</label>
              <input type="date" className="input" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} disabled={orden.estado === 'recibida'} />
            </div>
            <div className="input-wrapper">
              <label className="form-label">Método de pago</label>
              <select className="select" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} disabled={orden.estado === 'recibida'}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="nequi">Nequi</option>
                <option value="daviplata">Daviplata</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
            <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label className="form-label">Condición de pago</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: '40px' }}>
                <input type="checkbox" id="edit_es_credito" checked={esCredito} onChange={(e) => setEsCredito(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--brand)' }} disabled={orden.estado === 'recibida'} />
                <label htmlFor="edit_es_credito" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Compra a Crédito</label>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-form-section">
          <div className="modal-section-head">
            <h3 className="modal-form-section-title">Productos</h3>
            {orden.estado !== 'recibida' && (
              <button type="button" className="btn-ghost" onClick={() => setItems((it) => [...it, { producto_id: '', cantidad: 1, precio: 0, subtotal: 0 }])}>
                <Plus size={14} /> Agregar
              </button>
            )}
          </div>
          <div className="modal-line-list">
            {items.map((item, idx) => (
              <div key={idx} className="modal-line-row">
                <select className="select" value={item.producto_id} onChange={(e) => updateItem(idx, e.target.value)} required disabled={orden.estado === 'recibida'} style={{ flex: 2 }}>
                  <option value="">Producto</option>
                  {productos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
                </select>
                <input type="number" className="input" placeholder="Cant." min={1} value={item.cantidad} onChange={(e) => updateCantidad(idx, +e.target.value)} disabled={orden.estado === 'recibida'} style={{ width: 80 }} />
                <input type="number" className="input" placeholder="Costo" min={0} value={item.precio} onChange={(e) => updatePrecio(idx, +e.target.value)} disabled={orden.estado === 'recibida'} style={{ width: 120 }} />
                <div className="line-subtotal" style={{ width: 100, textAlign: 'right' }}>${item.subtotal.toLocaleString()}</div>
                {items.length > 1 && orden.estado !== 'recibida' && (
                  <button type="button" className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setItems((it) => it.filter((_, i) => i !== idx))}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="modal-info-row" style={{ marginTop: 12 }}>
            <span className="muted">Subtotal</span>
            <strong>${subtotal.toLocaleString()}</strong>
          </div>
          <div className="modal-info-row">
            <span className="muted">IVA ({formatTasaIva(tasaIva)})</span>
            <strong>${impuestos.toLocaleString()}</strong>
          </div>
          <div className="modal-info-row modal-info-row--success">
            <span className="muted">Total orden</span>
            <strong>${total.toLocaleString()}</strong>
          </div>
        </div>

        <div className="modal-form-section">
          <div className="input-wrapper">
            <label className="form-label">Notas</label>
            <input className="input" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones..." disabled={orden.estado === 'recibida'} />
          </div>
        </div>
      </form>
    </FormModal>
  );
}

export default function ComprasPage() {
  const { empresaId, empresa } = useEmpresa();
  const tasaIva = getTasaIva(empresa);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNueva, setShowNueva] = useState(false);
  const [editando, setEditando] = useState<Orden | null>(null);
  const [detalle, setDetalle] = useState<Orden | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchOrdenes = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('ordenes_compra')
      .select('*, proveedor:proveedores(nombre), items_orden_compra(*, producto:productos(nombre, codigo))')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false });

    if (error) toast.error('Error al cargar órdenes: ' + error.message);
    else setOrdenes(data || []);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => { fetchOrdenes(); }, [fetchOrdenes]);

  const filtered = ordenes.filter((o) =>
    o.numero?.toLowerCase().includes(search.toLowerCase()) ||
    o.proveedor?.nombre?.toLowerCase().includes(search.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setPage(1); }, [search]);

  const FLUJO = ['solicitud', 'cotizacion', 'orden', 'recibida'];

  const marcarRecibida = async (orden: Orden) => {
    const empresa_id = getEmpresaId();
    const usuario_id = getUsuarioId();
    if (!empresa_id || !usuario_id) return;

    const { error } = await supabase.from('ordenes_compra').update({
      estado: 'recibida',
      fecha_recepcion: new Date().toISOString(),
    }).eq('id', orden.id);

    if (error) { toast.error('No se pudo actualizar: ' + error.message); return; }

    const items = orden.items_orden_compra ?? [];
    for (const item of items) {
      const { data: prod } = await supabase.from('productos').select('stock_actual, precio_costo').eq('id', item.producto_id).single();
      if (!prod) continue;
      const stockNuevo = prod.stock_actual + item.cantidad;
      await supabase.from('productos').update({ stock_actual: stockNuevo, precio_costo: item.precio_unitario }).eq('id', item.producto_id);
      await supabase.from('movimientos_inventario').insert([{
        empresa_id,
        producto_id: item.producto_id,
        tipo: 'entrada',
        cantidad: item.cantidad,
        stock_anterior: prod.stock_actual,
        stock_nuevo: stockNuevo,
        costo_unitario: item.precio_unitario,
        motivo: `Recepción ${orden.numero}`,
        referencia_id: orden.id,
        referencia_tipo: 'orden_compra',
        usuario_id,
      }]);
      await supabase.from('items_orden_compra').update({ cantidad_recibida: item.cantidad }).eq('id', item.id);
    }

    toast.success(`Orden ${orden.numero} recibida — inventario actualizado`);
    fetchOrdenes();
  };

  const eliminarOrden = async (orden: Orden) => {
    if (!window.confirm(`¿Estás seguro de eliminar la orden ${orden.numero}?`)) return;

    if (orden.estado === 'recibida') {
      if (!window.confirm('Esta orden ya fue RECIBIDA. Eliminarla NO revertirá automáticamente el stock de los productos. ¿Deseas continuar?')) return;
    }

    const { error } = await supabase.from('ordenes_compra').delete().eq('id', orden.id);
    if (error) {
      toast.error('Error al eliminar la orden: ' + error.message);
    } else {
      toast.success('Orden eliminada exitosamente');
      fetchOrdenes();
    }
  };

  const moduleStats = [
    { label: 'Órdenes activas', value: ordenes.filter((o) => o.estado !== 'cancelada' && o.estado !== 'recibida').length, icon: ShoppingCart, tone: 'brand' as const },
    { label: 'En tránsito', value: ordenes.filter((o) => o.estado === 'orden').length, icon: Clock, tone: 'warning' as const },
    { label: 'Recibidas', value: ordenes.filter((o) => o.estado === 'recibida').length, icon: CheckCircle2, tone: 'success' as const },
    { label: 'Inversión', value: `$${(ordenes.reduce((s, o) => s + o.total, 0) / 1e6).toFixed(1)}M`, icon: DollarSign, tone: 'neutral' as const },
  ];

  return (
    <ModuleShell
      boundedTable={false}
      stats={moduleStats}
      toolbar={
        <>
          <SearchField value={search} onChange={setSearch} placeholder="Buscar por # de orden o proveedor..." />
          <ActionButton id="btn-nueva-compra" size="sm" icon={<Plus size={14} />} style={{ marginLeft: 'auto' }} onClick={() => setShowNueva(true)}>
            Nueva Orden
          </ActionButton>
        </>
      }
    >
      <div className="card" style={{ padding: 20, flexShrink: 0 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Pipeline de Compras</h3>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {FLUJO.map((estado, i) => {
            const count = ordenes.filter((o) => o.estado === estado).length;
            const st = ESTADOS[estado as keyof typeof ESTADOS];
            const isActive = count > 0;
            return (
              <div key={estado} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '16px 12px', background: isActive ? 'var(--bg-active)' : 'var(--bg-elevated)', border: `1px solid ${isActive ? 'var(--border-hover)' : 'var(--border)'}`, borderRadius: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{count}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>{st.label}</div>
                </div>
                {i < FLUJO.length - 1 && <ChevronRight size={18} color="var(--text-muted)" style={{ margin: '0 8px' }} />}
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="data-panel" style={{ padding: 16 }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 40, marginBottom: 8, borderRadius: 8 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="data-panel empty-state" style={{ padding: 32 }}>
          <div className="empty-icon"><Package size={24} /></div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{search ? 'Sin resultados' : 'No hay órdenes de compra'}</div>
          {!search && (
            <ActionButton icon={<Plus size={14} />} style={{ marginTop: 12 }} onClick={() => setShowNueva(true)}>
              Crear primera orden
            </ActionButton>
          )}
        </div>
      ) : (
        <TablePanel pagination={{ currentPage, totalPages, totalItems: filtered.length, pageSize, onPageChange: setPage }}>
          <table className="table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Proveedor</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Emisión</th>
                <th>Entrega</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {paginated.map((o) => (
                <tr key={o.id}>
                  <td><span style={{ fontWeight: 700, color: 'var(--brand)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{o.numero}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}><Building2 size={12} /></div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{o.proveedor?.nombre}</span>
                    </div>
                  </td>
                  <td><span className={`badge ${ESTADOS[o.estado as keyof typeof ESTADOS]?.class}`}>{ESTADOS[o.estado as keyof typeof ESTADOS]?.label}</span></td>
                  <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: 13 }}>${o.total?.toLocaleString() ?? 0}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}><ClientDate value={o.created_at} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}><ClientDate value={o.fecha_entrega_esperada} fallback="Pendiente" /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-icon btn-icon-sm" title="Ver detalle" onClick={() => setDetalle(o)}><Eye size={12} /></button>
                      {o.estado !== 'recibida' && (
                        <button type="button" className="btn-icon btn-icon-sm" title="Editar orden" onClick={() => setEditando(o)}><Pencil size={12} /></button>
                      )}
                      {(o.estado === 'orden' || o.estado === 'cotizacion') && (
                        <button type="button" className="btn-icon btn-icon-sm" style={{ color: 'var(--success)' }} title="Recibir orden" onClick={() => marcarRecibida(o)}><Check size={12} /></button>
                      )}
                      <button type="button" className="btn-icon btn-icon-sm" style={{ color: 'var(--danger)' }} title="Eliminar orden" onClick={() => eliminarOrden(o)}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablePanel>
      )}

      {showNueva && <NuevaOrdenModal tasaIva={tasaIva} onClose={() => setShowNueva(false)} onSaved={() => { setShowNueva(false); fetchOrdenes(); }} />}

      {editando && <EditarOrdenModal orden={editando} tasaIva={tasaIva} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); fetchOrdenes(); }} />}

      {detalle && (
        <Modal open onClose={() => setDetalle(null)} title={`Orden ${detalle.numero}`} subtitle={detalle.proveedor?.nombre} size="md">
          <div className="modal-form" style={{ gap: 14 }}>
            <div className="modal-info-row"><span className="muted">Estado</span><span className={`badge ${ESTADOS[detalle.estado as keyof typeof ESTADOS]?.class}`}>{ESTADOS[detalle.estado as keyof typeof ESTADOS]?.label}</span></div>
            <div className="modal-info-row"><span className="muted">Método de pago</span><strong>{detalle.metodo_pago ? detalle.metodo_pago.toUpperCase() : 'EFECTIVO'}</strong></div>
            <div className="modal-info-row"><span className="muted">Condición</span><strong>{detalle.es_credito ? 'CRÉDITO' : 'CONTADO'}</strong></div>
            <div className="modal-info-row"><span className="muted">Emisión</span><strong><ClientDate value={detalle.created_at} /></strong></div>
            <div className="modal-info-row"><span className="muted">Entrega esperada</span><strong><ClientDate value={detalle.fecha_entrega_esperada} fallback="Pendiente" /></strong></div>
            
            <div style={{ height: '1px', background: 'var(--border-default)', margin: '4px 0' }} />
            
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: '4px 0 2px' }}>Productos</h4>
            {detalle.items_orden_compra?.map((it, i) => (
              <div key={i} className="modal-info-row" style={{ paddingLeft: 8 }}>
                <span style={{ fontSize: 13 }}>{it.producto?.codigo ? `[${it.producto.codigo}] ` : ''}{it.producto?.nombre ?? 'Producto'}</span>
                <strong>{it.cantidad} × ${it.precio_unitario?.toLocaleString() ?? 0} = ${it.subtotal.toLocaleString()}</strong>
              </div>
            ))}
            
            <div style={{ height: '1px', background: 'var(--border-default)', margin: '4px 0' }} />
            
            <div className="modal-info-row modal-info-row--success">
              <span className="muted">Total orden</span>
              <strong>${detalle.total.toLocaleString()}</strong>
            </div>

            {detalle.notas && (
              <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8, fontSize: 12, marginTop: 4 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>Notas:</div>
                <div style={{ color: 'var(--text-secondary)' }}>{detalle.notas}</div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </ModuleShell>
  );
}
