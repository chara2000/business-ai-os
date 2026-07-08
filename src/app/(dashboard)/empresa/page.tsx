'use client';

import { useEffect, useState } from 'react';
import {
  Building2, MapPin, Phone, Mail, Globe, CreditCard,
  Users, Package, TrendingUp, Save, Store,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { useEmpresa } from '@/lib/hooks/useEmpresa';
import { Card, StatCard } from '@/components/ui/Card';
import { CreditCardWidget } from '@/components/ui/CreditCard';
import { ActionButton } from '@/components/ui/ActionButton';
import { formatCurrency } from '@/lib/utils';
import { getTasaIva, formatTasaIva } from '@/lib/tax';
import type { Empresa } from '@/types';

const supabase = createClient();

export default function EmpresaPage() {
  const { empresaId, empresa: ctxEmpresa } = useEmpresa();
  const [empresa, setEmpresa] = useState<Partial<Empresa>>({});
  const [stats, setStats] = useState({ productos: 0, clientes: 0, ventas: 0, ventasTotal: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!empresaId) return;

    async function load() {
      const { data } = await supabase.from('empresas').select('*').eq('id', empresaId).single();
      if (data) setEmpresa(data);

      const [
        { count: productos },
        { count: clientes },
        { count: ventas },
        { data: ventasData },
      ] = await Promise.all([
        supabase.from('productos').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId),
        supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId),
        supabase.from('ventas').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId),
        supabase.from('ventas').select('total').eq('empresa_id', empresaId).eq('estado', 'completada'),
      ]);

      const ventasTotal = ventasData?.reduce((s, v) => s + (v.total || 0), 0) ?? 0;
      setStats({ productos: productos ?? 0, clientes: clientes ?? 0, ventas: ventas ?? 0, ventasTotal });
    }

    load();
  }, [empresaId]);

  const tasaIva = getTasaIva(empresa);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) return;
    setLoading(true);
    const configuracion = {
      ...(typeof empresa.configuracion === 'object' && empresa.configuracion ? empresa.configuracion : {}),
      tasa_iva: tasaIva,
    };
    const { error } = await supabase.from('empresas').update({
      nombre: empresa.nombre,
      telefono: empresa.telefono,
      email: empresa.email,
      direccion: empresa.direccion,
      ciudad: empresa.ciudad,
      pais: empresa.pais,
      moneda: empresa.moneda,
      configuracion,
    }).eq('id', empresaId);

    if (error) toast.error(error.message);
    else toast.success('Empresa actualizada');
    setLoading(false);
  };

  return (
    <div className="page-fintech-wrap animate-fade-in">
      {/* Stats row */}
      <div className="dashboard-grid grid-4" style={{ marginBottom: 28 }}>
        <StatCard label="Mi Balance" value={formatCurrency(stats.ventasTotal)} icon={<CreditCard size={22} color="var(--accent-yellow)" />} iconBg="var(--accent-yellow-soft)" />
        <StatCard label="Productos" value={stats.productos} icon={<Package size={22} color="var(--brand)" />} iconBg="var(--accent-blue-soft)" />
        <StatCard label="Clientes" value={stats.clientes} icon={<Users size={22} color="var(--accent-pink)" />} iconBg="var(--accent-pink-soft)" />
        <StatCard label="Ventas" value={stats.ventas} icon={<TrendingUp size={22} color="var(--accent-teal)" />} iconBg="var(--accent-teal-soft)" />
      </div>

      <div className="dashboard-grid grid-2-1">
        {/* Company info */}
        <Card title="Información del Establecimiento" padding="28px" className="fintech-card">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="input-wrapper">
                <label className="form-label"><Building2 size={12} /> Nombre</label>
                <input className="input" value={empresa.nombre ?? ''} onChange={(e) => setEmpresa({ ...empresa, nombre: e.target.value })} />
              </div>
              <div className="input-wrapper">
                <label className="form-label"><Store size={12} /> Tipo de Negocio</label>
                <input className="input" value={empresa.tipo_negocio ?? ''} disabled style={{ textTransform: 'capitalize' }} />
              </div>
            </div>
            <div className="input-wrapper">
              <label className="form-label"><MapPin size={12} /> Dirección</label>
              <input className="input" value={empresa.direccion ?? ''} onChange={(e) => setEmpresa({ ...empresa, direccion: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div className="input-wrapper">
                <label className="form-label">Ciudad</label>
                <input className="input" value={empresa.ciudad ?? ''} onChange={(e) => setEmpresa({ ...empresa, ciudad: e.target.value })} />
              </div>
              <div className="input-wrapper">
                <label className="form-label"><Globe size={12} /> País</label>
                <input className="input" value={empresa.pais ?? ''} onChange={(e) => setEmpresa({ ...empresa, pais: e.target.value })} />
              </div>
              <div className="input-wrapper">
                <label className="form-label">Moneda</label>
                <select className="select" value={empresa.moneda ?? 'COP'} onChange={(e) => setEmpresa({ ...empresa, moneda: e.target.value })}>
                  <option value="COP">COP</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="input-wrapper">
                <label className="form-label"><Phone size={12} /> Teléfono</label>
                <input className="input" value={empresa.telefono ?? ''} onChange={(e) => setEmpresa({ ...empresa, telefono: e.target.value })} />
              </div>
              <div className="input-wrapper">
                <label className="form-label"><Mail size={12} /> Email</label>
                <input type="email" className="input" value={empresa.email ?? ''} onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })} />
              </div>
            </div>
            <div className="input-wrapper">
              <label className="form-label">Tasa IVA (ej: 0.19 = 19%)</label>
              <input
                type="number"
                className="input"
                min={0}
                max={1}
                step={0.01}
                value={tasaIva}
                onChange={(e) => setEmpresa({
                  ...empresa,
                  configuracion: { ...(empresa.configuracion ?? {}), tasa_iva: +e.target.value },
                })}
              />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                Actual: {formatTasaIva(tasaIva)} — se aplica en ventas y compras
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <ActionButton type="submit" loading={loading} icon={!loading ? <Save size={16} /> : undefined}>
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </ActionButton>
            </div>
          </form>
        </Card>

        {/* Card widget */}
        <Card title="Mi Tarjeta" padding="24px">
          <CreditCardWidget
            balance={stats.ventasTotal}
            holder={ctxEmpresa?.nombre?.slice(0, 20) ?? 'Business OS'}
            validThru="12/28"
            cardNumber="3778 **** **** 1234"
            variant="primary"
          />
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <span className="badge badge-brand">Plan: {empresa.plan ?? 'starter'}</span>
            <span className={`badge ${empresa.activa ? 'badge-success' : 'badge-danger'}`}>
              {empresa.activa ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
