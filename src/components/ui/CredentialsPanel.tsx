'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  KeyRound, UserPlus, Users, RefreshCw, Copy, Check, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ActionButton } from '@/components/ui/ActionButton';
import { ROLE_LABELS, assignableRoles, getDefaultPermisos } from '@/lib/roles';
import type { UserRole } from '@/types';

type Member = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: UserRole;
  activo: boolean;
};

interface CredentialsPanelProps {
  empresaId: string;
  empresaNombre: string;
  apiBase: '/api/superadmin/usuarios' | '/api/equipo';
  actorRol?: UserRole;
  onClose?: () => void;
}

export function CredentialsPanel({
  empresaId,
  empresaNombre,
  apiBase,
  actorRol = 'super_admin',
}: CredentialsPanelProps) {
  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [resultCreds, setResultCreds] = useState<{ email: string; password: string; label?: string } | null>(null);

  const roles = assignableRoles(actorRol);
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    rol: (roles.includes('owner') ? 'owner' : roles[0]) as UserRole,
  });

  const listUrl = apiBase === '/api/superadmin/usuarios'
    ? `${apiBase}?empresa_id=${empresaId}`
    : apiBase;

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(listUrl);
      const json = await res.json();
      if (json.success) setMembers(json.data ?? []);
    } catch {
      toast.error('Error al cargar usuarios');
    }
    setLoading(false);
  }, [listUrl]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const body = apiBase === '/api/superadmin/usuarios'
        ? { empresa_id: empresaId, ...form, permisos: getDefaultPermisos(form.rol) }
        : { ...form, permisos: getDefaultPermisos(form.rol) };

      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Credenciales creadas');
        if (json.credentials) {
          setResultCreds({ ...json.credentials, label: `${form.nombre} ${form.apellido}` });
        }
        setForm({ nombre: '', apellido: '', email: '', password: '', rol: form.rol });
        setTab('list');
        fetchMembers();
      } else toast.error(json.error);
    } catch {
      toast.error('Error de conexión');
    }
    setCreating(false);
  };

  const handleReset = async (member: Member) => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('Contraseña mínimo 8 caracteres');
      return;
    }
    setResettingId(member.id);
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: member.id, reset_password: newPassword }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Contraseña actualizada');
        setResultCreds({
          email: json.credentials?.email ?? member.email,
          password: newPassword,
          label: `${member.nombre} ${member.apellido}`,
        });
        setNewPassword('');
        setResettingId(null);
      } else toast.error(json.error);
    } catch {
      toast.error('Error al resetear');
    }
    setResettingId(null);
  };

  const copyCreds = (email: string, password: string) => {
    navigator.clipboard.writeText(`Email: ${email}\nContraseña: ${password}`);
    setCopied(true);
    toast.success('Copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  if (resultCreds) {
    return (
      <div className="credentials-panel">
        <div className="credentials-success-card">
          <div className="credentials-success-icon"><Check size={28} /></div>
          <h3>Credenciales listas</h3>
          <p>{resultCreds.label ?? empresaNombre}</p>
          <div className="credentials-fields">
            <div><span>Email</span><strong>{resultCreds.email}</strong></div>
            <div><span>Contraseña</span><strong>{resultCreds.password}</strong></div>
          </div>
          <button
            type="button"
            className="btn-table btn-table--lime"
            onClick={() => copyCreds(resultCreds.email, resultCreds.password)}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            Copiar credenciales
          </button>
          <button type="button" className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setResultCreds(null)}>
            Continuar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="credentials-panel">
      <div className="credentials-tabs">
        <button type="button" className={tab === 'list' ? 'active' : ''} onClick={() => setTab('list')}>
          <Users size={15} /> Usuarios ({members.length})
        </button>
        <button type="button" className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>
          <UserPlus size={15} /> Nuevo acceso
        </button>
      </div>

      {tab === 'list' ? (
        <div className="credentials-list">
          {loading ? (
            <div className="credentials-empty">Cargando usuarios...</div>
          ) : members.length === 0 ? (
            <div className="credentials-empty">
              <KeyRound size={32} />
              <p>Sin usuarios en este establecimiento</p>
              <button type="button" className="btn-table btn-table--lime" onClick={() => setTab('create')}>
                Crear primer acceso
              </button>
            </div>
          ) : (
            members.map((m) => (
              <div key={m.id} className="credentials-user-card">
                <div className="credentials-user-head">
                  <div className="credentials-avatar">{m.nombre[0]}{m.apellido[0]}</div>
                  <div>
                    <strong>{m.nombre} {m.apellido}</strong>
                    <span>{m.email}</span>
                  </div>
                  <span className={`badge ${m.activo ? 'badge-success' : 'badge-danger'}`}>
                    {ROLE_LABELS[m.rol]}
                  </span>
                </div>
                {resettingId === m.id ? (
                  <div className="credentials-reset-form">
                    <input
                      type="password"
                      className="input"
                      placeholder="Nueva contraseña (mín. 8)"
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <div className="table-actions">
                      <button type="button" className="btn-ghost" onClick={() => { setResettingId(null); setNewPassword(''); }}>Cancelar</button>
                      <ActionButton size="sm" onClick={() => handleReset(m)}>Guardar</ActionButton>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-table btn-table--outline"
                    onClick={() => { setResettingId(m.id); setNewPassword(''); }}
                  >
                    <RefreshCw size={14} /> Resetear contraseña
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <form onSubmit={handleCreate} className="modal-form" style={{ marginTop: 4 }}>
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
          <div className="modal-form-grid">
            <div className="input-wrapper">
              <label className="form-label">Email *</label>
              <input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="input-wrapper">
              <label className="form-label">Contraseña *</label>
              <input type="password" className="input" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <div className="input-wrapper">
            <label className="form-label"><Shield size={12} /> Rol</label>
            <select className="select" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as UserRole })}>
              {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <ActionButton type="submit" loading={creating} icon={<KeyRound size={16} />} style={{ marginTop: 8 }}>
            Crear credenciales
          </ActionButton>
        </form>
      )}
    </div>
  );
}
