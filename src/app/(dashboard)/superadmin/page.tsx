'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Crown, Plus, Search, Eye, Building2, Users, Package,
  TrendingUp, Store, MapPin, Phone, Mail, KeyRound, DollarSign, BarChart3,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAppStore } from '@/stores/appStore';
import { Modal } from '@/components/ui/Modal';
import { ActionButton } from '@/components/ui/ActionButton';
import { CredentialsPanel } from '@/components/ui/CredentialsPanel';
import { TablePanel } from '@/components/ui/TablePanel';
import { ROLE_LABELS } from '@/lib/roles';
import type { Empresa, BusinessType } from '@/types';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'ferreteria', label: 'Ferretería' },
  { value: 'tienda', label: 'Tienda' },
  { value: 'farmacia', label: 'Farmacia' },
  { value: 'taller', label: 'Taller' },
  { value: 'distribuidora', label: 'Distribuidora' },
  { value: 'comercio', label: 'Comercio' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'otro', label: 'Otro' },
];

interface EmpresaWithStats extends Empresa {
  usuarios?: [{ count: number }];
  ventas?: [{ count: number }];
  productos?: [{ count: number }];
  clientes?: [{ count: number }];
}

export default function SuperAdminPage() {
  const router = useRouter();
  const isSuperAdmin = useAppStore((s) => s.isSuperAdmin());
  const setImpersonatedEmpresa = useAppStore((s) => s.setImpersonatedEmpresa);
  const clearImpersonation = useAppStore((s) => s.clearImpersonation);
  const [empresas, setEmpresas] = useState<EmpresaWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentialEmpresa, setCredentialEmpresa] = useState<Empresa | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    tipo_negocio: 'restaurante' as BusinessType,
    email: '',
    telefono: '',
    direccion: '',
    ciudad: '',
    pais: 'Colombia',
    moneda: 'COP',
    plan: 'starter',
    crear_credenciales: true,
    admin_nombre: '',
    admin_apellido: '',
    admin_email: '',
    admin_password: '',
    admin_rol: 'owner' as 'owner' | 'admin',
  });
  const [credTabKey, setCredTabKey] = useState(0);
  const [saasMetrics, setSaasMetrics] = useState<{
    mrr: number; arr: number; activeTenants: number; newTenants30d: number;
    churnRate: number; arpu: number; revenueByPlan: { plan: string; tenants: number; mrr: number }[];
    growth: { mes: string; nuevos: number }[];
  } | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin/metrics');
      const json = await res.json();
      if (json.success) setSaasMetrics(json.data);
    } catch { /* ignore */ }
  }, []);

  const fetchEmpresas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/empresas');
      const json = await res.json();
      if (json.success) setEmpresas(json.data ?? []);
      else toast.error(json.error || 'Error al cargar');
    } catch {
      toast.error('Error de conexión');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) {
      router.push('/dashboard');
      return;
    }
    clearImpersonation();
    fetch('/api/superadmin/impersonate', { method: 'DELETE' }).catch(() => {});
    fetchEmpresas();
    fetchMetrics();
  }, [isSuperAdmin, router, fetchEmpresas, fetchMetrics, clearImpersonation]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        nombre: form.nombre,
        tipo_negocio: form.tipo_negocio,
        email: form.email,
        telefono: form.telefono,
        direccion: form.direccion,
        ciudad: form.ciudad,
        pais: form.pais,
        moneda: form.moneda,
        plan: form.plan,
      };
      if (form.crear_credenciales) {
        payload.admin_nombre = form.admin_nombre;
        payload.admin_apellido = form.admin_apellido;
        payload.admin_email = form.admin_email;
        payload.admin_password = form.admin_password;
        payload.admin_rol = form.admin_rol;
      }
      const res = await fetch('/api/superadmin/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        if (json.credentials) {
          setCreatedCreds(json.credentials);
          toast.success('Establecimiento y credenciales creados');
        } else {
          toast.success('Establecimiento creado');
          setShowCreate(false);
          resetForm();
        }
        fetchEmpresas();
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error('Error al crear');
    }
    setCreating(false);
  };

  const resetForm = () => setForm({
    nombre: '', tipo_negocio: 'restaurante', email: '', telefono: '', direccion: '', ciudad: '',
    pais: 'Colombia', moneda: 'COP', plan: 'starter', crear_credenciales: true,
    admin_nombre: '', admin_apellido: '', admin_email: '', admin_password: '', admin_rol: 'owner',
  });

  const openCredentials = (emp: Empresa) => {
    setCredentialEmpresa(emp);
    setCreatedCreds(null);
    setCredTabKey((k) => k + 1);
    setShowCredentials(true);
  };

  const handleViewAs = async (empresa: Empresa) => {
    try {
      const res = await fetch('/api/superadmin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresa.id }),
      });
      const json = await res.json();
      if (json.success) {
        setImpersonatedEmpresa(empresa);
        toast.success(`Viendo: ${empresa.nombre}`);
        router.push('/dashboard');
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error('Error al cambiar contexto');
    }
  };

  const filtered = empresas.filter((e) =>
    e.nombre.toLowerCase().includes(search.toLowerCase()) ||
    e.tipo_negocio.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const getCount = (arr?: [{ count: number }]) => arr?.[0]?.count ?? 0;

  if (!isSuperAdmin) return null;

  return (
    <div className="page-fintech-wrap animate-fade-in">
      {saasMetrics && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <BarChart3 size={20} color="var(--brand)" />
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Métricas SaaS</h2>
          </div>
          <div className="dashboard-grid grid-4" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: 'var(--accent-teal-soft)' }}>
                <DollarSign size={24} color="var(--accent-teal)" />
              </div>
              <div className="stat-card-content">
                <span className="stat-card-label">MRR</span>
                <span className="stat-card-value">${saasMetrics.mrr.toLocaleString('es-CO')}</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: 'var(--accent-blue-soft)' }}>
                <TrendingUp size={24} color="var(--brand)" />
              </div>
              <div className="stat-card-content">
                <span className="stat-card-label">ARR</span>
                <span className="stat-card-value">${saasMetrics.arr.toLocaleString('es-CO')}</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: 'var(--accent-pink-soft)' }}>
                <Users size={24} color="var(--accent-pink)" />
              </div>
              <div className="stat-card-content">
                <span className="stat-card-label">ARPU</span>
                <span className="stat-card-value">${saasMetrics.arpu.toLocaleString('es-CO')}</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon" style={{ background: 'var(--accent-yellow-soft)' }}>
                <Crown size={24} color="var(--accent-yellow)" />
              </div>
              <div className="stat-card-content">
                <span className="stat-card-label">Churn 30d</span>
                <span className="stat-card-value">{saasMetrics.churnRate}%</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            <div className="fintech-card" style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Ingresos por plan</h3>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={saasMetrics.revenueByPlan.filter((p) => p.mrr > 0)}>
                    <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="plan" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <Tooltip formatter={(v) => [`$${Number(v).toLocaleString('es-CO')}`, 'MRR']} />
                    <Bar dataKey="mrr" radius={[6, 6, 0, 0]}>
                      {saasMetrics.revenueByPlan.map((_, i) => (
                        <Cell key={i} fill={['var(--brand)', 'var(--info)', 'var(--success)', 'var(--warning)'][i % 4]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="fintech-card" style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Nuevos tenants</h3>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={saasMetrics.growth}>
                    <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="nuevos" fill="var(--brand)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Header stats */}
      <div className="dashboard-grid grid-4" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--accent-blue-soft)' }}>
            <Building2 size={24} color="var(--brand)" />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Total Establecimientos</span>
            <span className="stat-card-value">{empresas.length}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--accent-teal-soft)' }}>
            <Store size={24} color="var(--accent-teal)" />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Activos</span>
            <span className="stat-card-value">{empresas.filter((e) => e.activa).length}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--accent-pink-soft)' }}>
            <Users size={24} color="var(--accent-pink)" />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Restaurantes</span>
            <span className="stat-card-value">{empresas.filter((e) => e.tipo_negocio === 'restaurante').length}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--accent-yellow-soft)' }}>
            <Crown size={24} color="var(--accent-yellow)" />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Plan Pro+</span>
            <span className="stat-card-value">{empresas.filter((e) => ['pro', 'enterprise'].includes(e.plan)).length}</span>
          </div>
        </div>
      </div>

      {/* Actions bar */}
      <div className="fintech-card" style={{ padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 42 }}
              placeholder="Buscar establecimiento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ActionButton icon={<Plus size={18} />} onClick={() => setShowCreate(true)}>
            Nuevo Establecimiento
          </ActionButton>
        </div>
      </div>

      {/* Table */}
      <TablePanel className="table-wrapper" padded={false} pagination={{ currentPage, totalPages, totalItems: filtered.length, pageSize, onPageChange: setPage }}>
        <table className="table">
          <thead>
            <tr>
              <th>Establecimiento</th>
              <th>Tipo</th>
              <th>Plan</th>
              <th>Usuarios</th>
              <th>Productos</th>
              <th>Clientes</th>
              <th>Ventas</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="table-empty">Cargando establecimientos...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="table-empty">No hay establecimientos</td></tr>
            ) : paginated.map((emp) => (
              <tr key={emp.id}>
                <td>
                  <div className="table-cell-entity">
                    <div className="table-cell-avatar">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <strong>{emp.nombre}</strong>
                      <span>{emp.ciudad || emp.email || '—'}</span>
                    </div>
                  </div>
                </td>
                <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{emp.tipo_negocio}</td>
                <td><span className="badge badge-brand">{emp.plan}</span></td>
                <td><span className="badge badge-info">{getCount(emp.usuarios)}</span></td>
                <td>{getCount(emp.productos)}</td>
                <td>{getCount(emp.clientes)}</td>
                <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{getCount(emp.ventas)}</td>
                <td>
                  <span className={`badge ${emp.activa ? 'badge-success' : 'badge-danger'}`}>
                    {emp.activa ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <button type="button" className="btn-table btn-table--lime" onClick={() => openCredentials(emp)} title="Gestionar accesos">
                      <KeyRound size={14} />
                      Acceso
                    </button>
                    <button type="button" className="btn-table btn-table--view" onClick={() => handleViewAs(emp)} title="Ver como">
                      <Eye size={14} />
                      Ver
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo Establecimiento"
        subtitle="Crea un nuevo restaurante o negocio en el sistema"
        icon={Building2}
        size="xl"
        bodyScroll="always"
        footer={
          <>
            <button type="button" className="modal-btn-cancel" onClick={() => setShowCreate(false)}>Cancelar</button>
            <ActionButton type="submit" form="create-empresa-form" loading={creating}>
              {creating ? 'Creando...' : 'Crear Establecimiento'}
            </ActionButton>
          </>
        }
      >
        <form id="create-empresa-form" onSubmit={handleCreate} className="modal-form">
          <div className="modal-form-section">
            <h3 className="modal-form-section-title">Identidad</h3>
            <div className="input-wrapper">
              <label className="form-label">Nombre del Establecimiento *</label>
              <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required placeholder="Restaurante La Esquina" />
            </div>
            <div className="modal-form-grid">
              <div className="input-wrapper">
                <label className="form-label">Tipo de Negocio *</label>
                <select className="select" value={form.tipo_negocio} onChange={(e) => setForm({ ...form, tipo_negocio: e.target.value as BusinessType })}>
                  {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="input-wrapper">
                <label className="form-label">Plan</label>
                <select className="select" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
          </div>

          <div className="modal-form-section">
            <h3 className="modal-form-section-title">Contacto</h3>
            <div className="modal-form-grid">
              <div className="input-wrapper">
                <label className="form-label"><Mail size={12} /> Email</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contacto@negocio.com" />
              </div>
              <div className="input-wrapper">
                <label className="form-label"><Phone size={12} /> Teléfono</label>
                <input className="input" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="+57 300 000 0000" />
              </div>
            </div>
          </div>

          <div className="modal-form-section">
            <h3 className="modal-form-section-title">Ubicación</h3>
            <div className="input-wrapper">
              <label className="form-label"><MapPin size={12} /> Dirección</label>
              <input className="input" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Calle 10 #20-30" />
            </div>
            <div className="modal-form-grid modal-form-grid--3">
              <div className="input-wrapper">
                <label className="form-label">Ciudad</label>
                <input className="input" value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} placeholder="Bogotá" />
              </div>
              <div className="input-wrapper">
                <label className="form-label">País</label>
                <input className="input" value={form.pais} onChange={(e) => setForm({ ...form, pais: e.target.value })} />
              </div>
              <div className="input-wrapper">
                <label className="form-label">Moneda</label>
                <select className="select" value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                  <option value="COP">COP</option>
                  <option value="USD">USD</option>
                  <option value="MXN">MXN</option>
                </select>
              </div>
            </div>
          </div>

          <div className="modal-form-section">
            <h3 className="modal-form-section-title"><KeyRound size={14} /> Credenciales del administrador</h3>
            <label className="modal-check-row" style={{ marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={form.crear_credenciales}
                onChange={(e) => setForm({ ...form, crear_credenciales: e.target.checked })}
              />
              <span>Crear credenciales de acceso al panel</span>
            </label>
            {form.crear_credenciales && (
              <>
                <div className="modal-form-grid">
                  <div className="input-wrapper">
                    <label className="form-label">Nombre admin *</label>
                    <input className="input" value={form.admin_nombre} onChange={(e) => setForm({ ...form, admin_nombre: e.target.value })} required={form.crear_credenciales} placeholder="María" />
                  </div>
                  <div className="input-wrapper">
                    <label className="form-label">Apellido admin *</label>
                    <input className="input" value={form.admin_apellido} onChange={(e) => setForm({ ...form, admin_apellido: e.target.value })} required={form.crear_credenciales} placeholder="García" />
                  </div>
                </div>
                <div className="modal-form-grid">
                  <div className="input-wrapper">
                    <label className="form-label">Email de acceso *</label>
                    <input type="email" className="input" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} required={form.crear_credenciales} placeholder="admin@negocio.com" />
                  </div>
                  <div className="input-wrapper">
                    <label className="form-label">Contraseña *</label>
                    <input type="password" className="input" minLength={8} value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} required={form.crear_credenciales} placeholder="Mínimo 8 caracteres" />
                  </div>
                </div>
                <div className="input-wrapper">
                  <label className="form-label">Rol inicial</label>
                  <select className="select" value={form.admin_rol} onChange={(e) => setForm({ ...form, admin_rol: e.target.value as 'owner' | 'admin' })}>
                    <option value="owner">{ROLE_LABELS.owner}</option>
                    <option value="admin">{ROLE_LABELS.admin}</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </form>
      </Modal>

      {/* Credenciales creadas al crear establecimiento */}
      {createdCreds && !showCredentials && (
        <Modal
          open
          onClose={() => { setCreatedCreds(null); setShowCreate(false); resetForm(); }}
          title="Credenciales de acceso"
          subtitle="Comparte estos datos con el administrador del establecimiento"
          icon={KeyRound}
          size="md"
          footer={
            <ActionButton onClick={() => { setCreatedCreds(null); setShowCreate(false); resetForm(); }}>
              Entendido
            </ActionButton>
          }
        >
          <div className="modal-form">
            <div className="modal-info-row"><span className="muted">Email</span><strong>{createdCreds.email}</strong></div>
            <div className="modal-info-row"><span className="muted">Contraseña</span><strong>{createdCreds.password}</strong></div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
              El administrador puede iniciar sesión en /login y gestionar su equipo desde Equipo.
            </p>
          </div>
        </Modal>
      )}

      {/* Panel de accesos */}
      <Modal
        open={showCredentials}
        onClose={() => { setShowCredentials(false); setCredentialEmpresa(null); }}
        title={`Accesos — ${credentialEmpresa?.nombre ?? ''}`}
        subtitle="Crear, listar y resetear contraseñas del establecimiento"
        icon={KeyRound}
        size="lg"
        bodyScroll="always"
        footer={
          <button type="button" className="modal-btn-cancel" onClick={() => setShowCredentials(false)}>Cerrar</button>
        }
      >
        {credentialEmpresa && (
          <CredentialsPanel
            key={credTabKey}
            empresaId={credentialEmpresa.id}
            empresaNombre={credentialEmpresa.nombre}
            apiBase="/api/superadmin/usuarios"
            actorRol="super_admin"
          />
        )}
      </Modal>
    </div>
  );
}
