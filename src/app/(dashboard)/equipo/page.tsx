'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, Plus, Shield, UserCog, Mail, KeyRound, CheckCircle2, X, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/stores/appStore';
import { useRouter } from 'next/navigation';
import { ActionButton } from '@/components/ui/ActionButton';
import { FormModal } from '@/components/ui/FormModal';
import { ModuleShell } from '@/components/ui/ModuleShell';
import { SearchField } from '@/components/ui/SearchField';
import {
  ALL_PERMISSIONS, ROLE_LABELS, assignableRoles, getDefaultPermisos,
} from '@/lib/roles';
import type { UserRole, Usuario } from '@/types';

type TeamMember = Pick<Usuario, 'id' | 'nombre' | 'apellido' | 'email' | 'rol' | 'permisos' | 'activo' | 'created_at'>;

function CreateUserModal({
  onClose,
  onSaved,
  actorRol,
}: {
  onClose: () => void;
  onSaved: () => void;
  actorRol: UserRole;
}) {
  const roles = assignableRoles(actorRol);
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    rol: roles[roles.length - 1] ?? 'employee',
    permisos: getDefaultPermisos(roles[roles.length - 1] ?? 'employee'),
  });
  const [loading, setLoading] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  const togglePermiso = (id: string) => {
    setForm((f) => ({
      ...f,
      permisos: f.permisos.includes(id)
        ? f.permisos.filter((p) => p !== id)
        : [...f.permisos, id],
    }));
  };

  const handleRolChange = (rol: UserRole) => {
    setForm((f) => ({ ...f, rol, permisos: getDefaultPermisos(rol) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/equipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Usuario creado ✓');
        if (json.credentials) setCreatedCreds(json.credentials);
        else onSaved();
      } else {
        toast.error(json.error || 'Error al crear');
      }
    } catch {
      toast.error('Error de conexión');
    }
    setLoading(false);
  };

  if (createdCreds) {
    return (
      <FormModal
        open
        onClose={onSaved}
        title="Credenciales creadas"
        subtitle="Comparte estos datos con el nuevo miembro del equipo"
        icon={KeyRound}
        size="md"
        footer={<ActionButton onClick={onSaved}>Listo</ActionButton>}
      >
        <div className="modal-form">
          <div className="modal-info-row"><span className="muted">Email</span><strong>{createdCreds.email}</strong></div>
          <div className="modal-info-row"><span className="muted">Contraseña</span><strong>{createdCreds.password}</strong></div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
            El usuario puede iniciar sesión en el panel con estas credenciales.
          </p>
        </div>
      </FormModal>
    );
  }

  return (
    <FormModal
      open
      onClose={onClose}
      title="Nuevo miembro del equipo"
      subtitle="Crea credenciales de acceso al panel"
      icon={Users}
      size="lg"
      bodyScroll="always"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <ActionButton loading={loading} onClick={handleSubmit as unknown as React.MouseEventHandler}>
            {loading ? 'Creando...' : 'Crear credenciales'}
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
              <input className="input" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="input-wrapper">
              <label className="form-label">Apellido *</label>
              <input className="input" required value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="modal-form-section">
          <h3 className="modal-form-section-title">Acceso al panel</h3>
          <div className="modal-form-grid">
            <div className="input-wrapper">
              <label className="form-label"><Mail size={12} /> Email *</label>
              <input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="empleado@negocio.com" />
            </div>
            <div className="input-wrapper">
              <label className="form-label"><KeyRound size={12} /> Contraseña *</label>
              <input type="password" className="input" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
            </div>
          </div>
          <div className="input-wrapper">
            <label className="form-label">Rol *</label>
            <select className="select" value={form.rol} onChange={(e) => handleRolChange(e.target.value as UserRole)}>
              {roles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
        </div>

        {form.rol === 'employee' && (
          <div className="modal-form-section">
            <h3 className="modal-form-section-title">Permisos del empleado</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALL_PERMISSIONS.filter((p) => p.id !== 'equipo').map((p) => (
                <label key={p.id} className="modal-check-row" style={{ margin: 0, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <input type="checkbox" checked={form.permisos.includes(p.id)} onChange={() => togglePermiso(p.id)} />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </form>
    </FormModal>
  );
}

export default function EquipoPage() {
  const router = useRouter();
  const usuario = useAppStore((s) => s.usuario);
  const canManage = usuario?.rol === 'owner' || usuario?.rol === 'admin';
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/equipo');
      const json = await res.json();
      if (json.success) setMembers(json.data ?? []);
      else toast.error(json.error || 'Error al cargar equipo');
    } catch {
      toast.error('Error de conexión');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!canManage) {
      router.push('/dashboard');
      return;
    }
    fetchTeam();
  }, [canManage, router, fetchTeam]);

  const toggleActive = async (member: TeamMember) => {
    if (member.rol === 'owner' && usuario?.rol !== 'owner') {
      toast.error('No puedes desactivar al propietario');
      return;
    }
    const res = await fetch('/api/equipo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: member.id, activo: !member.activo }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success(member.activo ? 'Usuario desactivado' : 'Usuario activado');
      fetchTeam();
    } else toast.error(json.error);
  };

  const handleReset = async (member: TeamMember) => {
    if (!resetPassword || resetPassword.length < 8) {
      toast.error('Contraseña mínimo 8 caracteres');
      return;
    }
    setResetting(true);
    const res = await fetch('/api/equipo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: member.id, reset_password: resetPassword }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success(`Contraseña de ${member.nombre} actualizada`);
      setResetId(null);
      setResetPassword('');
    } else toast.error(json.error);
    setResetting(false);
  };

  const filtered = members.filter((m) =>
    `${m.nombre} ${m.apellido} ${m.email}`.toLowerCase().includes(search.toLowerCase()),
  );

  const moduleStats = [
    { label: 'Total equipo', value: members.length, icon: Users, tone: 'brand' as const },
    { label: 'Administradores', value: members.filter((m) => m.rol === 'admin').length, icon: Shield, tone: 'success' as const },
    { label: 'Empleados', value: members.filter((m) => m.rol === 'employee').length, icon: UserCog, tone: 'warning' as const },
    { label: 'Activos', value: members.filter((m) => m.activo).length, icon: CheckCircle2, tone: 'neutral' as const },
  ];

  if (!canManage || !usuario) return null;

  return (
    <ModuleShell
      boundedTable
      stats={moduleStats}
      toolbar={
        <>
          <SearchField value={search} onChange={setSearch} placeholder="Buscar por nombre o email..." />
          <ActionButton size="sm" icon={<Plus size={14} />} style={{ marginLeft: 'auto' }} onClick={() => setShowCreate(true)}>
            Nuevo usuario
          </ActionButton>
        </>
      }
    >
      {loading ? (
        <div className="data-panel" style={{ padding: 16 }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 40, marginBottom: 8, borderRadius: 8 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="data-panel empty-state" style={{ padding: 32 }}>
          <div className="empty-icon"><Users size={24} /></div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Sin miembros en el equipo</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Crea credenciales para que tu personal acceda al panel.</p>
          <ActionButton icon={<Plus size={14} />} style={{ marginTop: 12 }} onClick={() => setShowCreate(true)}>
            Crear primer usuario
          </ActionButton>
        </div>
      ) : (
        <div className="data-panel data-panel--bounded table-surface">
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Permisos</th>
                <th>Estado</th>
                <th>Alta</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="table-cell-entity">
                      <div className="table-cell-avatar">{m.nombre[0]}{m.apellido[0]}</div>
                      <div>
                        <strong>{m.nombre} {m.apellido}</strong>
                        <span>{ROLE_LABELS[m.rol]}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{m.email}</td>
                  <td><span className="badge badge-brand">{ROLE_LABELS[m.rol]}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 180 }}>
                    {(m.permisos ?? []).slice(0, 2).join(', ')}{(m.permisos?.length ?? 0) > 2 ? '…' : ''}
                  </td>
                  <td>
                    <span className={`badge ${m.activo ? 'badge-success' : 'badge-danger'}`}>
                      {m.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(m.created_at).toLocaleDateString('es-CO')}
                  </td>
                  <td>
                    {resetId === m.id ? (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <input
                          type="password"
                          className="input"
                          style={{ width: 140, padding: '6px 10px', fontSize: 12 }}
                          placeholder="Nueva clave"
                          minLength={8}
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                        />
                        <button type="button" className="btn-table btn-table--lime btn-table--icon" disabled={resetting} onClick={() => handleReset(m)}>
                          <CheckCircle2 size={14} />
                        </button>
                        <button type="button" className="btn-table btn-table--icon" onClick={() => { setResetId(null); setResetPassword(''); }}>
                          <X size={14} />
                        </button>
                      </div>
                    ) : m.id !== usuario.id ? (
                      <div className="table-actions">
                        <button type="button" className="btn-table btn-table--outline btn-table--icon" title="Resetear contraseña" onClick={() => { setResetId(m.id); setResetPassword(''); }}>
                          <RefreshCw size={14} />
                        </button>
                        {m.rol !== 'owner' && (
                          <button type="button" className="btn-table btn-table--icon" title={m.activo ? 'Desactivar' : 'Activar'} onClick={() => toggleActive(m)}>
                            {m.activo ? <X size={14} /> : <CheckCircle2 size={14} />}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && usuario && (
        <CreateUserModal
          actorRol={usuario.rol}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchTeam(); }}
        />
      )}
    </ModuleShell>
  );
}
