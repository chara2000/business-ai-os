'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Package, Plus, List, Grid3X3, Edit2, Trash2, AlertTriangle,
  X, Download, Scan, QrCode, ImagePlus,
} from 'lucide-react';
import { CategoriasPanel, MarcasPanel, KardexPanel, INVENTARIO_TABS, type InventarioTabId } from '@/components/inventario/CatalogTabs';
import { DemandForecastPanel } from '@/components/inventario/DemandForecastPanel';
import { BarcodeScannerModal } from '@/components/barcode/BarcodeScannerModal';
import { ProductQrModal } from '@/components/barcode/ProductQrModal';
import { parseQrPayload } from '@/lib/barcode/qr';
import { uploadProductImage } from '@/lib/storage/upload';
import { createClient } from '@/lib/supabase/client';
import { getEmpresaId } from '@/lib/getEmpresaId';
import { useEmpresa } from '@/lib/hooks/useEmpresa';
import { ActionButton } from '@/components/ui/ActionButton';
import { FormModal } from '@/components/ui/FormModal';
import { ModuleShell } from '@/components/ui/ModuleShell';
import { SearchField } from '@/components/ui/SearchField';
import { TablePanel } from '@/components/ui/TablePanel';
import toast from 'react-hot-toast';
import type { Producto } from '@/types';

const supabase = createClient();

/* ─── Modal Form ──────────────────────────────────────────────── */
function ProductForm({ product, onClose, onSaved }: { product?: Producto | null; onClose: () => void; onSaved: () => void }) {
  const empresaId = getEmpresaId();
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([]);
  const [marcas, setMarcas] = useState<{ id: string; nombre: string }[]>([]);
  const [form, setForm] = useState({
    codigo: product?.codigo ?? '',
    codigo_barras: product?.codigo_barras ?? '',
    nombre: product?.nombre ?? '',
    precio_costo: product?.precio_costo ?? 0,
    precio_venta: product?.precio_venta ?? 0,
    stock_actual: product?.stock_actual ?? 0,
    stock_minimo: product?.stock_minimo ?? 0,
    unidad: product?.unidad ?? 'unidad',
    categoria_id: product?.categoria_id ?? '',
    marca_id: product?.marca_id ?? '',
    imagen_url: product?.imagen_url ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    Promise.all([
      supabase.from('categorias').select('id, nombre').eq('empresa_id', empresaId),
      supabase.from('marcas').select('id, nombre').eq('empresa_id', empresaId),
    ]).then(([c, m]) => {
      setCategorias(c.data ?? []);
      setMarcas(m.data ?? []);
    });
  }, [empresaId]);

  const margen = form.precio_venta > 0
    ? (((form.precio_venta - form.precio_costo) / form.precio_venta) * 100).toFixed(1)
    : '0.0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('No autenticado'); setLoading(false); return; }
    const empresa_id = getEmpresaId();
    if (!empresa_id) { toast.error('Sin empresa'); setLoading(false); return; }

    const margenVal = form.precio_venta > 0 ? ((form.precio_venta - form.precio_costo) / form.precio_venta) * 100 : 0;
    const payload = {
      empresa_id, ...form,
      categoria_id: form.categoria_id || null,
      marca_id: form.marca_id || null,
      codigo_barras: form.codigo_barras || null,
      imagen_url: form.imagen_url || null,
      margen: margenVal,
    };

    if (product) {
      const { error } = await supabase.from('productos').update(payload).eq('id', product.id);
      if (error) toast.error('Error: ' + error.message); else { toast.success('Producto actualizado'); onSaved(); }
    } else {
      const { error } = await supabase.from('productos').insert([payload]);
      if (error) toast.error('Error: ' + error.message); else { toast.success('Producto creado'); onSaved(); }
    }
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !empresaId) return;
    setUploading(true);
    try {
      const url = await uploadProductImage(empresaId, file);
      setForm((f) => ({ ...f, imagen_url: url }));
      toast.success('Imagen subida');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir imagen');
    }
    setUploading(false);
  };

  const handleScan = (raw: string) => {
    const parsed = parseQrPayload(raw);
    const code = parsed?.codigo ?? raw.trim();
    setForm((f) => ({ ...f, codigo_barras: code }));
    toast.success(`Código capturado: ${code}`);
  };

  return (
    <>
    <FormModal
      open
      onClose={onClose}
      title={product ? 'Editar Producto' : 'Nuevo Producto'}
      subtitle="Detalles, precios y control de inventario"
      icon={Package}
      size="lg"
      bodyScroll="always"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <ActionButton loading={loading} onClick={handleSubmit as unknown as React.MouseEventHandler}>
            {loading ? 'Guardando...' : product ? 'Actualizar' : 'Crear'}
          </ActionButton>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="modal-form">
        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Producto</h3>
          <div className="modal-form-grid modal-form-grid--2-1">
            <div className="input-wrapper">
              <label className="form-label">Código *</label>
              <input className="input" placeholder="PROD-001" value={form.codigo}
                onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} required />
            </div>
            <div className="input-wrapper">
              <label className="form-label">Nombre del producto *</label>
              <input className="input" placeholder="Ej: Batería Bosch AA x4" value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
            </div>
          </div>
          <div className="modal-form-grid">
            <div className="input-wrapper">
              <label className="form-label">Código de barras / EAN</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" placeholder="7701234567890" value={form.codigo_barras}
                  onChange={e => setForm(f => ({ ...f, codigo_barras: e.target.value }))} style={{ flex: 1 }} />
                <button type="button" className="btn-ghost" onClick={() => setShowScanner(true)} title="Escanear">
                  <Scan size={16} />
                </button>
              </div>
            </div>
            <div className="input-wrapper">
              <label className="form-label">Imagen del producto</label>
              <label className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', height: 44 }}>
                <ImagePlus size={16} />
                {uploading ? 'Subiendo...' : form.imagen_url ? 'Cambiar imagen' : 'Subir imagen'}
                <input type="file" accept="image/*" hidden onChange={handleImageUpload} disabled={uploading} />
              </label>
            </div>
          </div>
          {form.imagen_url && (
            <img src={form.imagen_url} alt="Vista previa" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
          )}
          <div className="modal-form-grid">
            <div className="input-wrapper">
              <label className="form-label">Categoría</label>
              <select className="select" value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                <option value="">Sin categoría</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="input-wrapper">
              <label className="form-label">Marca</label>
              <select className="select" value={form.marca_id} onChange={e => setForm(f => ({ ...f, marca_id: e.target.value }))}>
                <option value="">Sin marca</option>
                {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Precios</h3>
          <div className="modal-form-grid">
            <div className="input-wrapper">
              <label className="form-label">Precio de costo *</label>
              <input type="number" className="input" placeholder="0" min={0} value={form.precio_costo}
                onChange={e => setForm(f => ({ ...f, precio_costo: +e.target.value }))} required />
            </div>
            <div className="input-wrapper">
              <label className="form-label">Precio de venta *</label>
              <input type="number" className="input" placeholder="0" min={0} value={form.precio_venta}
                onChange={e => setForm(f => ({ ...f, precio_venta: +e.target.value }))} required />
            </div>
          </div>
          <div
            className={`modal-info-row ${
              Number(margen) > 30
                ? 'modal-info-row--success'
                : Number(margen) > 15
                  ? 'modal-info-row--warning'
                  : 'modal-info-row--danger'
            }`}
          >
            <span className="muted">Margen de ganancia calculado</span>
            <strong style={{ color: Number(margen) > 30 ? 'var(--success)' : Number(margen) > 15 ? 'var(--warning)' : 'var(--danger)' }}>
              {margen}%
            </strong>
          </div>
        </div>

        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Inventario</h3>
          <div className="modal-form-grid modal-form-grid--3">
            <div className="input-wrapper">
              <label className="form-label">Stock actual</label>
              <input type="number" className="input" placeholder="0" min={0} value={form.stock_actual}
                onChange={e => setForm(f => ({ ...f, stock_actual: +e.target.value }))} />
            </div>
            <div className="input-wrapper">
              <label className="form-label">Stock mínimo</label>
              <input type="number" className="input" placeholder="0" min={0} value={form.stock_minimo}
                onChange={e => setForm(f => ({ ...f, stock_minimo: +e.target.value }))} />
            </div>
            <div className="input-wrapper">
              <label className="form-label">Unidad</label>
              <select className="select" value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))}>
                {['unidad', 'caja', 'paquete', 'rollo', 'galón', 'kg', 'litro', 'metro', 'par'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </form>
    </FormModal>
    <BarcodeScannerModal open={showScanner} onClose={() => setShowScanner(false)} onScan={handleScan} />
    </>
  );
}

/* ─── Main Page ───────────────────────────────────────────────── */
export default function InventarioPage() {
  const { empresaId } = useEmpresa();
  const [activeTab, setActiveTab] = useState<InventarioTabId>('productos');
  const [products, setProducts] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Producto | null>(null);
  const [qrProduct, setQrProduct] = useState<Producto | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchProducts = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    const { data, error } = await supabase.from('productos').select('*, categoria:categorias(nombre)').eq('empresa_id', empresaId).order('created_at', { ascending: false });
    if (error) toast.error('Error al cargar inventario');
    else setProducts(data || []);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return;
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (error) toast.error('Error: ' + error.message);
    else { toast.success('Producto eliminado'); fetchProducts(); }
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
      || (p.codigo_barras ?? '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' ? true :
      filterStatus === 'low' ? p.stock_actual > 0 && p.stock_actual <= p.stock_minimo :
      p.stock_actual === 0;
    return matchSearch && matchStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setPage(1); }, [search, filterStatus]);

  const stats = {
    total: products.length,
    low: products.filter(p => p.stock_actual > 0 && p.stock_actual <= p.stock_minimo).length,
    out: products.filter(p => p.stock_actual === 0).length,
    value: products.reduce((s, p) => s + (p.precio_venta * p.stock_actual), 0),
  };

  const handleScanSearch = (raw: string) => {
    const parsed = parseQrPayload(raw);
    const code = parsed?.codigo ?? raw.trim();
    setSearch(code);
    toast.success(`Buscando: ${code}`);
  };

  const moduleStats = [
    { label: 'Productos', value: stats.total, icon: Package, tone: 'brand' as const },
    { label: 'Stock bajo', value: stats.low, icon: AlertTriangle, tone: 'warning' as const },
    { label: 'Agotados', value: stats.out, icon: X, tone: 'danger' as const },
    { label: 'Valor stock', value: `$${(stats.value / 1e6).toFixed(1)}M`, icon: Package, tone: 'success' as const },
  ];

  return (
    <ModuleShell
      boundedTable={false}
      stats={activeTab === 'productos' ? moduleStats : undefined}
      toolbar={activeTab === 'productos' ? (
        <>
          <SearchField value={search} onChange={setSearch} placeholder="Buscar por nombre o código..." />
          <button type="button" className="btn-ghost" style={{ height: 36 }} onClick={() => setShowScanner(true)} title="Escanear código">
            <Scan size={14} /> Escanear
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            {([['all', 'Todos'], ['low', 'Bajo'], ['out', 'Agotados']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterStatus(key)}
                className={`btn-ghost ${filterStatus === key ? 'active' : ''}`}
                style={{
                  padding: '6px 10px', fontSize: 11, height: 36,
                  ...(filterStatus === key ? { background: 'var(--brand-soft)', color: 'var(--brand)', borderColor: 'var(--brand-border)' } : {}),
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
              {([['list', List], ['grid', Grid3X3]] as const).map(([mode, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: 5, borderRadius: 5, cursor: 'pointer', border: 'none',
                    background: viewMode === mode ? 'var(--bg-card-solid)' : 'transparent',
                    color: viewMode === mode ? 'var(--brand)' : 'var(--text-muted)',
                  }}
                >
                  <Icon size={13} />
                </button>
              ))}
            </div>
            <button type="button" className="btn-ghost" style={{ height: 36, fontSize: 12 }} onClick={() => toast('Exportación en desarrollo', { icon: '📥' })}>
              <Download size={13} /> Exportar
            </button>
            <ActionButton size="sm" icon={<Plus size={14} />} onClick={() => { setEditProduct(null); setShowForm(true); }}>
              Nuevo
            </ActionButton>
          </div>
        </>
      ) : undefined}
    >
      <div className="inventario-tab-shell">
      <div className="tabs-premium tabs-premium--inset">
        {INVENTARIO_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`tab-premium ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'categorias' && <CategoriasPanel />}
      {activeTab === 'marcas' && <MarcasPanel />}
      {activeTab === 'kardex' && <KardexPanel />}
      {activeTab === 'prediccion' && <DemandForecastPanel />}

      {activeTab === 'productos' && (
      <>
      {loading ? (
        <div className="data-panel" style={{ padding: 16 }}>
          <div className="skeleton" style={{ height: 40, width: '100%', borderRadius: 8, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 40, width: '100%', borderRadius: 8, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 40, width: '100%', borderRadius: 8 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon"><Package size={24} /></div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {search ? 'No se encontraron productos' : 'Inventario vacío'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {search ? `Sin coincidencias para "${search}"` : 'Agrega tu primer producto para comenzar'}
          </div>
          {!search && (
            <ActionButton icon={<Plus size={14} />} style={{ marginTop: 8 }} onClick={() => { setEditProduct(null); setShowForm(true); }}>
              Agregar Producto
            </ActionButton>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <TablePanel pagination={{ currentPage, totalPages, totalItems: filtered.length, pageSize, onPageChange: setPage }}>
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Costo</th>
                <th>Venta</th>
                <th>Margen</th>
                <th>Stock</th>
                <th>Estado</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(p => {
                const isLow = p.stock_actual > 0 && p.stock_actual <= p.stock_minimo;
                const isOut = p.stock_actual === 0;
                return (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {p.codigo}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Package size={14} color="var(--text-secondary)" />
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.nombre}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-muted">{p.categoria?.nombre ?? '—'}</span></td>
                    <td><span style={{ color: 'var(--text-secondary)' }}>${p.precio_costo.toLocaleString()}</span></td>
                    <td><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>${p.precio_venta.toLocaleString()}</span></td>
                    <td>
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: p.margen > 30 ? 'var(--success)' : p.margen > 15 ? 'var(--warning)' : 'var(--danger)'
                      }}>
                        {p.margen.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {(isOut || isLow) && <AlertTriangle size={12} color={isOut ? 'var(--danger)' : 'var(--warning)'} />}
                        <span style={{ fontWeight: 600, color: isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--success)' }}>
                          {p.stock_actual} {p.unidad}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${isOut ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}`}>
                        {isOut ? 'Agotado' : isLow ? 'Stock Bajo' : 'Disponible'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" style={{ width: 26, height: 26 }} title="Ver QR" onClick={() => setQrProduct(p)}>
                          <QrCode size={12} />
                        </button>
                        <button className="btn-icon" style={{ width: 26, height: 26 }} onClick={() => { setEditProduct(p); setShowForm(true); }}>
                          <Edit2 size={12} />
                        </button>
                        <button className="btn-icon" style={{ width: 26, height: 26, color: 'var(--danger)' }} onClick={() => handleDelete(p.id)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TablePanel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {filtered.map(p => {
            const isLow = p.stock_actual > 0 && p.stock_actual <= p.stock_minimo;
            const isOut = p.stock_actual === 0;
            return (
              <div key={p.id} className="card" style={{ padding: 18 }}>
                <div style={{
                  height: 100, background: 'var(--bg-elevated)', borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                  border: '1px solid var(--border)',
                }}>
                  <Package size={32} color="var(--text-muted)" />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-light)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{p.codigo}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.2 }}>{p.nombre}</div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Precio</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>${p.precio_venta.toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stock</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--success)' }}>
                      {p.stock_actual} {p.unidad}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" style={{ flex: 1, padding: 8 }} onClick={() => { setEditProduct(p); setShowForm(true); }}>
                    <Edit2 size={12} /> Editar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProductForm
          product={editProduct}
          onClose={() => { setShowForm(false); setEditProduct(null); }}
          onSaved={() => { setShowForm(false); setEditProduct(null); fetchProducts(); }}
        />
      )}

      {qrProduct && empresaId && (
        <ProductQrModal
          open
          onClose={() => setQrProduct(null)}
          codigo={qrProduct.codigo}
          nombre={qrProduct.nombre}
          empresaId={empresaId}
          codigoBarras={qrProduct.codigo_barras}
        />
      )}

      <BarcodeScannerModal open={showScanner} onClose={() => setShowScanner(false)} onScan={handleScanSearch} />
      </>
      )}
      </div>
    </ModuleShell>
  );
}
