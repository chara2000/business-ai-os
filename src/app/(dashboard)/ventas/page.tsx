'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Plus, Eye, FileText, Check,
  ShoppingBag, DollarSign, Trash2, AlertCircle, Scan,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { getEmpresaId } from '@/lib/getEmpresaId';
import { getUsuarioId, generateDocNumber, downloadCsv } from '@/lib/db-helpers';
import { ClientDate } from '@/components/ui/ClientDate';
import { calcImpuestos, getTasaIva, formatTasaIva } from '@/lib/tax';
import { logAudit } from '@/lib/audit';
import { printVentaFactura } from '@/lib/pdf/venta-factura';
import { BarcodeScannerModal } from '@/components/barcode/BarcodeScannerModal';
import { parseQrPayload } from '@/lib/barcode/qr';
import { useEmpresa } from '@/lib/hooks/useEmpresa';
import { ActionButton } from '@/components/ui/ActionButton';
import { FormModal } from '@/components/ui/FormModal';
import { Modal } from '@/components/ui/Modal';
import { ModuleShell } from '@/components/ui/ModuleShell';
import { SearchField } from '@/components/ui/SearchField';
import { TablePanel } from '@/components/ui/TablePanel';
import type { Venta } from '@/types';

const supabase = createClient();

type ProductoOpt = { id: string; nombre: string; codigo: string; codigo_barras?: string; precio_venta: number; stock_actual: number };
type ClienteOpt = { id: string; nombre: string; apellido?: string };
type LineItem = { producto_id: string; cantidad: number; precio: number; subtotal: number };

function NuevaVentaModal({ onClose, onSaved, tasaIva }: { onClose: () => void; onSaved: () => void; tasaIva: number }) {
  const empresaId = getEmpresaId();
  const [productos, setProductos] = useState<ProductoOpt[]>([]);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [items, setItems] = useState<LineItem[]>([{ producto_id: '', cantidad: 1, precio: 0, subtotal: 0 }]);
  const [clienteId, setClienteId] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [descuento, setDescuento] = useState(0);
  const [esCredito, setEsCredito] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    Promise.all([
      supabase.from('productos').select('id, nombre, codigo, codigo_barras, precio_venta, stock_actual').eq('empresa_id', empresaId).eq('activo', true),
      supabase.from('clientes').select('id, nombre, apellido').eq('empresa_id', empresaId).eq('activo', true),
    ]).then(([p, c]) => {
      setProductos(p.data ?? []);
      setClientes(c.data ?? []);
    });
  }, [empresaId]);

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const { impuestos, total } = calcImpuestos(subtotal, descuento, tasaIva);

  const addItem = () => setItems((it) => [...it, { producto_id: '', cantidad: 1, precio: 0, subtotal: 0 }]);
  const removeItem = (idx: number) => setItems((it) => it.filter((_, i) => i !== idx));

  const updateItem = (idx: number, productoId: string) => {
    const prod = productos.find((p) => p.id === productoId);
    setItems((it) =>
      it.map((item, i) => {
        if (i !== idx) return item;
        const precio = prod?.precio_venta ?? 0;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some((i) => !i.producto_id || i.precio === 0)) {
      toast.error('Completa todos los productos');
      return;
    }
    if (esCredito && !clienteId) {
      toast.error('Selecciona un cliente para venta a crédito');
      return;
    }

    const empresa_id = getEmpresaId();
    const usuario_id = getUsuarioId();
    if (!empresa_id || !usuario_id) {
      toast.error('Sin contexto de empresa o usuario');
      return;
    }

    setLoading(true);
    const numeroVenta = generateDocNumber('V');

    const { data: venta, error: ventaError } = await supabase
      .from('ventas')
      .insert([{
        empresa_id,
        numero: numeroVenta,
        cliente_id: clienteId || null,
        estado: esCredito ? 'pendiente' : 'completada',
        subtotal,
        descuento,
        impuestos,
        total,
        metodo_pago: esCredito ? 'credito' : metodoPago,
        es_credito: esCredito,
        usuario_id,
      }])
      .select('id')
      .single();

    if (ventaError || !venta) {
      toast.error('Error al registrar: ' + (ventaError?.message ?? 'desconocido'));
      setLoading(false);
      return;
    }

    const itemsPayload = items.map((i) => ({
      venta_id: venta.id,
      producto_id: i.producto_id,
      cantidad: i.cantidad,
      precio_unitario: i.precio,
      descuento: 0,
      subtotal: i.subtotal,
    }));

    const { error: itemsError } = await supabase.from('items_venta').insert(itemsPayload);
    if (itemsError) {
      toast.error('Error en ítems: ' + itemsError.message);
      setLoading(false);
      return;
    }

    for (const item of items) {
      const prod = productos.find((p) => p.id === item.producto_id);
      if (!prod) continue;
      const stockNuevo = Math.max(0, prod.stock_actual - item.cantidad);
      await supabase.from('productos').update({ stock_actual: stockNuevo }).eq('id', item.producto_id);
      await supabase.from('movimientos_inventario').insert([{
        empresa_id,
        producto_id: item.producto_id,
        tipo: 'salida',
        cantidad: item.cantidad,
        stock_anterior: prod.stock_actual,
        stock_nuevo: stockNuevo,
        costo_unitario: item.precio,
        motivo: `Venta ${numeroVenta}`,
        referencia_id: venta.id,
        referencia_tipo: 'venta',
        usuario_id,
      }]);
    }

    if (esCredito && clienteId) {
      const vencimiento = new Date();
      vencimiento.setDate(vencimiento.getDate() + 30);
      await supabase.from('creditos').insert([{
        empresa_id,
        cliente_id: clienteId,
        venta_id: venta.id,
        monto_total: total,
        monto_pagado: 0,
        saldo_pendiente: total,
        estado: 'pendiente',
        fecha_vencimiento: vencimiento.toISOString(),
      }]);
      const { data: cliente } = await supabase.from('clientes').select('saldo_pendiente').eq('id', clienteId).single();
      if (cliente) {
        await supabase.from('clientes').update({
          saldo_pendiente: (cliente.saldo_pendiente ?? 0) + total,
        }).eq('id', clienteId);
      }
    }

    await logAudit(supabase, {
      empresaId: empresa_id,
      usuarioId: usuario_id,
      accion: 'crear_venta',
      entidad: 'venta',
      entidadId: venta.id,
      datosNuevos: { numero: numeroVenta, total, impuestos },
    });

    toast.success('Venta registrada exitosamente ✓');
    onSaved();
    setLoading(false);
  };

  const handleScanProduct = (raw: string) => {
    const parsed = parseQrPayload(raw);
    const code = (parsed?.codigo ?? raw).trim().toLowerCase();
    const prod = productos.find((p) =>
      p.codigo.toLowerCase() === code ||
      (p.codigo_barras ?? '').toLowerCase() === code,
    );
    if (!prod) {
      toast.error(`No encontré producto con código ${code}`);
      return;
    }
    const emptyIdx = items.findIndex((i) => !i.producto_id);
    const idx = emptyIdx >= 0 ? emptyIdx : items.length;
    if (emptyIdx < 0) {
      setItems((it) => [...it, { producto_id: prod.id, cantidad: 1, precio: prod.precio_venta, subtotal: prod.precio_venta }]);
    } else {
      updateItem(idx, prod.id);
    }
    toast.success(`Producto agregado: ${prod.nombre}`);
  };

  return (
    <>
    <FormModal
      open
      onClose={onClose}
      title="Nueva Venta"
      subtitle="Registra una transacción de venta"
      icon={TrendingUp}
      size="xl"
      bodyScroll="always"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <ActionButton loading={loading} onClick={handleSubmit as unknown as React.MouseEventHandler}>
            {loading ? 'Registrando...' : 'Registrar Venta'}
          </ActionButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Venta</h3>
          <div className="modal-form-grid modal-form-grid--2-1">
            <div className="input-wrapper">
              <label className="form-label">Cliente (opcional)</label>
              <select className="select" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">Consumidor final</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre} {c.apellido ?? ''}</option>
                ))}
              </select>
            </div>
            <div className="input-wrapper">
              <label className="form-label">Método de pago *</label>
              <select className="select" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} disabled={esCredito}>
                {['efectivo', 'transferencia', 'tarjeta', 'nequi', 'daviplata'].map((m) => (
                  <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="modal-form-section">
          <div className="modal-section-head">
            <h3 className="modal-form-section-title">Productos</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setShowScanner(true)} className="btn-ghost">
                <Scan size={14} /> Escanear
              </button>
              <button type="button" onClick={addItem} className="btn-ghost">
                <Plus size={14} /> Agregar
              </button>
            </div>
          </div>
          <div className="modal-line-list">
            {items.map((item, idx) => (
              <div key={idx} className="modal-line-row">
                <select className="select" value={item.producto_id} onChange={(e) => updateItem(idx, e.target.value)} required>
                  <option value="">Seleccionar producto</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>{p.codigo} — {p.nombre} (stock: {p.stock_actual})</option>
                  ))}
                </select>
                <input type="number" className="input" placeholder="Cant." min={1} value={item.cantidad}
                  onChange={(e) => updateCantidad(idx, +e.target.value)} />
                <div className="line-subtotal">${item.subtotal.toLocaleString()}</div>
                {items.length > 1 ? (
                  <button type="button" className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => removeItem(idx)}>
                    <Trash2 size={14} />
                  </button>
                ) : <div />}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Resumen</h3>
          <div className="modal-info-row">
            <span className="muted">Subtotal</span>
            <strong>${subtotal.toLocaleString()}</strong>
          </div>
          <div className="modal-info-row">
            <span className="muted">IVA ({formatTasaIva(tasaIva)})</span>
            <strong>${impuestos.toLocaleString()}</strong>
          </div>
          <div className="modal-form-grid">
            <div className="input-wrapper">
              <label className="form-label">Descuento</label>
              <div className="modal-input-prefix">
                <span className="prefix">$</span>
                <input type="number" min={0} value={descuento} onChange={(e) => setDescuento(+e.target.value)} className="input" />
              </div>
            </div>
            <div className="modal-info-row modal-info-row--success">
              <span className="muted">Total a cobrar</span>
              <strong style={{ color: 'var(--success)', fontSize: '1.1rem' }}>${total.toLocaleString()}</strong>
            </div>
          </div>
          <label className="modal-check-row">
            <input type="checkbox" checked={esCredito} onChange={(e) => setEsCredito(e.target.checked)} />
            <span>Registrar como crédito / fiado</span>
          </label>
        </div>
      </form>
    </FormModal>
    <BarcodeScannerModal open={showScanner} onClose={() => setShowScanner(false)} onScan={handleScanProduct} title="Escanear producto para venta" />
    </>
  );
}

export default function VentasPage() {
  const { empresaId, empresa } = useEmpresa();
  const tasaIva = getTasaIva(empresa);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNueva, setShowNueva] = useState(false);
  const [detalle, setDetalle] = useState<Venta | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchVentas = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('ventas')
      .select('*, cliente:clientes(*), items_venta(*, producto:productos(id, nombre, codigo))')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false });
    if (error) toast.error('Error al cargar ventas');
    else setVentas(data || []);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => { fetchVentas(); }, [fetchVentas]);

  const filtered = ventas.filter((v) =>
    v.numero.toLowerCase().includes(search.toLowerCase()) ||
    (v.cliente?.nombre ?? '').toLowerCase().includes(search.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setPage(1); }, [search]);

  const totalHoy = ventas.reduce((s, v) => s + v.total, 0);
  const completadas = ventas.filter((v) => v.estado === 'completada').length;

  const exportVentas = () => {
    downloadCsv(
      'ventas.csv',
      ['Número', 'Cliente', 'Método', 'Subtotal', 'Impuestos', 'Total', 'Estado', 'Fecha'],
      filtered.map((v) => [
        v.numero,
        v.cliente?.nombre ?? 'Consumidor final',
        v.metodo_pago,
        v.subtotal,
        v.impuestos,
        v.total,
        v.estado,
        new Date(v.created_at).toLocaleDateString('es-CO'),
      ]),
    );
    toast.success('Exportación descargada');
  };

  const moduleStats = [
    { label: 'Ingresos', value: `$${(totalHoy / 1000).toFixed(0)}K`, icon: DollarSign, tone: 'success' as const },
    { label: 'Ventas', value: ventas.length, icon: ShoppingBag, tone: 'brand' as const },
    { label: 'Completadas', value: completadas, icon: Check, tone: 'success' as const },
    { label: 'Pendientes', value: ventas.length - completadas, icon: AlertCircle, tone: 'warning' as const },
  ];

  return (
    <ModuleShell
      boundedTable={false}
      stats={moduleStats}
      toolbar={
        <>
          <SearchField value={search} onChange={setSearch} placeholder="Buscar por número o cliente..." />
          <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={exportVentas}>
            <FileText size={14} /> Exportar
          </button>
          <ActionButton id="btn-nueva-venta" size="sm" icon={<Plus size={14} />} style={{ marginLeft: 'auto' }} onClick={() => setShowNueva(true)}>
            Nueva Venta
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
          <div className="empty-icon"><ShoppingBag size={24} /></div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {search ? 'No se encontraron ventas' : 'No hay ventas registradas'}
          </div>
          {!search && (
            <ActionButton icon={<Plus size={14} />} style={{ marginTop: 8 }} onClick={() => setShowNueva(true)}>
              Registrar Venta
            </ActionButton>
          )}
        </div>
      ) : (
        <TablePanel pagination={{ currentPage, totalPages, totalItems: filtered.length, pageSize, onPageChange: setPage }}>
          <table className="table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Método de Pago</th>
                <th>Tipo</th>
                <th>Productos</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {paginated.map((v) => (
                <tr key={v.id}>
                  <td><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-light)', fontFamily: 'var(--font-mono)' }}>{v.numero}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, borderRadius: 8 }}>
                        {(v.cliente?.nombre ?? 'C')[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{v.cliente?.nombre ?? 'Consumidor Final'}</span>
                    </div>
                  </td>
                  <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{v.metodo_pago}</td>
                  <td>{v.es_credito ? <span className="badge badge-warning">Crédito</span> : <span className="badge badge-info">Contado</span>}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {v.items_venta && v.items_venta.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {v.items_venta.map((item, idx) => (
                          <span key={idx}>
                            {item.cantidad}x {item.producto?.nombre || 'Producto eliminado'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">Sin ítems</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 800 }}>${v.total.toLocaleString()}</td>
                  <td><span className={`badge ${v.estado === 'completada' ? 'badge-success' : v.estado === 'cancelada' ? 'badge-danger' : 'badge-warning'}`}>{v.estado}</span></td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    <ClientDate value={v.created_at} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" className="btn-icon btn-icon-sm" title="Ver detalle" onClick={() => setDetalle(v)}>
                        <Eye size={12} />
                      </button>
                      <button type="button" className="btn-icon btn-icon-sm" title="Factura PDF" onClick={() => printVentaFactura(v, empresa)}>
                        <FileText size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablePanel>
      )}

      {showNueva && (
        <NuevaVentaModal tasaIva={tasaIva} onClose={() => setShowNueva(false)} onSaved={() => { setShowNueva(false); fetchVentas(); }} />
      )}

      {detalle && (
        <Modal open onClose={() => setDetalle(null)} title={`Venta ${detalle.numero}`} subtitle={detalle.cliente?.nombre ?? 'Consumidor final'} size="md">
          <div className="modal-form">
            <div className="modal-info-row"><span className="muted">Subtotal</span><strong>${detalle.subtotal.toLocaleString()}</strong></div>
            <div className="modal-info-row"><span className="muted">Impuestos</span><strong>${detalle.impuestos.toLocaleString()}</strong></div>
            <div className="modal-info-row"><span className="muted">Total</span><strong>${detalle.total.toLocaleString()}</strong></div>
            <div className="modal-info-row"><span className="muted">Estado</span><strong>{detalle.estado}</strong></div>
            <div className="modal-info-row"><span className="muted">Fecha</span><strong>{new Date(detalle.created_at).toLocaleString('es-CO')}</strong></div>
            {(detalle as Venta & { items_venta?: { cantidad: number; subtotal: number; producto?: { nombre: string } }[] }).items_venta?.map((it, i) => (
              <div key={i} className="modal-info-row">
                <span>{it.producto?.nombre ?? 'Producto'}</span>
                <strong>{it.cantidad} × ${it.subtotal.toLocaleString()}</strong>
              </div>
            ))}
            <div style={{ marginTop: 16 }}>
              <ActionButton size="sm" icon={<FileText size={14} />} onClick={() => printVentaFactura(detalle, empresa)}>
                Imprimir factura
              </ActionButton>
            </div>
          </div>
        </Modal>
      )}
    </ModuleShell>
  );
}
