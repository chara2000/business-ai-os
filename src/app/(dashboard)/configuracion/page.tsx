'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Settings, Building2, Users, Bot, MessageCircle,
  Save, Link as LinkIcon, Shield, CreditCard, Send, CheckCircle,
  Smartphone, Monitor, Sun, Moon,
} from 'lucide-react';
import { PwaSettingsPanel } from '@/components/pwa/PwaSettingsPanel';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { useEmpresa } from '@/lib/hooks/useEmpresa';
import { ActionButton } from '@/components/ui/ActionButton';
import { useThemeStore } from '@/stores/themeStore';
import { PLAN_CATALOG, getNextPlan, getPlanDefinition } from '@/lib/billing/plans';
import type { SubscriptionPlan } from '@/types';
import type { WompiCheckoutParams } from '@/lib/billing/wompi';
import { WompiCheckout } from '@/components/billing/WompiCheckout';

const supabase = createClient();

function ConfiguracionContent() {
  const searchParams = useSearchParams();
  const { empresaId } = useEmpresa();
  const { theme, setTheme } = useThemeStore();
  const [activeTab, setActiveTab] = useState('perfil');
  const [loading, setLoading] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [whatsappLinked, setWhatsappLinked] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [botStatus, setBotStatus] = useState<{ username?: string } | null>(null);

  const [profile, setProfile] = useState({
    nombre: '', apellido: '', email: '', telefono: '',
    direccion: '', ciudad: '', pais: 'Colombia', codigo_postal: '',
  });
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [planInfo, setPlanInfo] = useState({
    plan: 'free' as SubscriptionPlan,
    activa: true,
    plan_expira_en: '' as string | null,
    billing_status: 'manual',
    stripe_customer_id: null as string | null,
  });

  const [botConfig, setBotConfig] = useState({ telegram_code: '', whatsapp_number: '' });
  const [wompiCheckout, setWompiCheckout] = useState<WompiCheckoutParams | null>(null);

  const reloadPlanInfo = async () => {
    if (!empresaId) return;
    const { data: emp } = await supabase.from('empresas').select('plan, activa, plan_expira_en, billing_status').eq('id', empresaId).single();
    if (emp) {
      setPlanInfo({
        plan: (emp.plan ?? 'free') as SubscriptionPlan,
        activa: emp.activa ?? true,
        plan_expira_en: emp.plan_expira_en,
        billing_status: emp.billing_status ?? 'manual',
        stripe_customer_id: null,
      });
    }
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);

    const ref = searchParams.get('ref');
    const txId = searchParams.get('id');
    if (searchParams.get('checkout') === 'return' && ref) {
      fetch(`/api/billing/verify?ref=${encodeURIComponent(ref)}${txId ? `&id=${encodeURIComponent(txId)}` : ''}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.status === 'APPROVED') {
            toast.success('¡Pago aprobado con Wompi! Plan activado.');
            reloadPlanInfo();
          } else if (json.pending) {
            toast('Pago en proceso. Te avisaremos cuando se confirme.', { icon: '⏳' });
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (userData) {
        setProfile({
          nombre: userData.nombre ?? '',
          apellido: userData.apellido ?? '',
          email: userData.email ?? '',
          telefono: '',
          direccion: '',
          ciudad: '',
          pais: 'Colombia',
          codigo_postal: '',
        });
        setTelegramLinked(!!userData.telegram_chat_id);
        setWhatsappLinked(!!userData.whatsapp_number);
        setWhatsappNumber(userData.whatsapp_number ?? '');
        setBotConfig((b) => ({ ...b, whatsapp_number: userData.whatsapp_number ?? '' }));
      }

      if (empresaId) {
        const { data: emp } = await supabase.from('empresas').select('*').eq('id', empresaId).single();
        if (emp) {
          setProfile((p) => ({
            ...p,
            telefono: emp.telefono ?? '',
            direccion: emp.direccion ?? '',
            ciudad: emp.ciudad ?? '',
            pais: emp.pais ?? 'Colombia',
          }));
          setPlanInfo({
            plan: (emp.plan ?? 'free') as SubscriptionPlan,
            activa: emp.activa ?? true,
            plan_expira_en: emp.plan_expira_en,
            billing_status: emp.billing_status ?? 'manual',
            stripe_customer_id: emp.stripe_customer_id ?? null,
          });
        }
      }

      try {
        const res = await fetch('/api/telegram/setup');
        const json = await res.json();
        if (json.bot) setBotStatus(json.bot);
      } catch { /* ignore */ }
    }
    load();
  }, [empresaId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    await supabase.from('usuarios').update({
      nombre: profile.nombre,
      apellido: profile.apellido,
    }).eq('auth_user_id', user.id);

    if (empresaId) {
      await supabase.from('empresas').update({
        telefono: profile.telefono,
        direccion: profile.direccion,
        ciudad: profile.ciudad,
        pais: profile.pais,
      }).eq('id', empresaId);
    }

    toast.success('Perfil guardado');
    setLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.next.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres'); return; }
    if (passwordForm.next !== passwordForm.confirm) { toast.error('Las contraseñas no coinciden'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: passwordForm.next });
    if (error) toast.error(error.message);
    else {
      toast.success('Contraseña actualizada');
      setPasswordForm({ current: '', next: '', confirm: '' });
    }
    setLoading(false);
  };

  const handleUpgradePlan = async (targetPlan?: SubscriptionPlan) => {
    if (!empresaId) return;
    const nextPlan = targetPlan ?? getNextPlan(planInfo.plan);
    if (!nextPlan) return;

    setLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: nextPlan }),
      });
      const json = await res.json();

      if (res.ok && json.checkout) {
        setWompiCheckout(json.checkout);
        setLoading(false);
        return;
      }

      if (json.fallback || res.status === 503) {
        const { error } = await supabase.from('empresas').update({ plan: nextPlan }).eq('id', empresaId);
        if (error) toast.error(error.message);
        else {
          setPlanInfo((p) => ({ ...p, plan: nextPlan }));
          toast.success(`Plan actualizado a ${nextPlan} (modo demo)`);
        }
        setLoading(false);
        return;
      }

      toast.error(json.error ?? 'No se pudo iniciar el pago');
    } catch {
      toast.error('Error al procesar el upgrade');
    }
    setLoading(false);
  };

  const handleRenewPlan = () => {
    handleUpgradePlan(planInfo.plan === 'free' ? 'starter' : planInfo.plan);
  };

  const handleLinkTelegram = async () => {
    if (!botConfig.telegram_code) {
      toast.error('Ingresa el código de Telegram');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_code: botConfig.telegram_code }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Telegram vinculado correctamente');
        setTelegramLinked(true);
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error('Error al vincular');
    }
    setLoading(false);
  };

  const handleUnlinkTelegram = async () => {
    await fetch('/api/telegram/link', { method: 'DELETE' });
    setTelegramLinked(false);
    toast.success('Telegram desvinculado');
  };

  const handleLinkWhatsApp = async () => {
    if (!botConfig.whatsapp_number) {
      toast.error('Ingresa tu número de WhatsApp');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_number: botConfig.whatsapp_number }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('WhatsApp vinculado correctamente');
        setWhatsappLinked(true);
        setWhatsappNumber(json.whatsapp_number ?? botConfig.whatsapp_number);
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error('Error al vincular WhatsApp');
    }
    setLoading(false);
  };

  const handleUnlinkWhatsApp = async () => {
    await fetch('/api/whatsapp/link', { method: 'DELETE' });
    setWhatsappLinked(false);
    setWhatsappNumber('');
    setBotConfig((b) => ({ ...b, whatsapp_number: '' }));
    toast.success('WhatsApp desvinculado');
  };

  const handleSetupBot = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/telegram/setup', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'Bot configurado');
        setBotStatus(json.bot);
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error('Error al configurar bot');
    }
    setLoading(false);
  };

  const TABS = [
    { id: 'perfil', label: 'Editar Perfil', icon: Users },
    { id: 'bots', label: 'Asistente IA', icon: Bot },
    { id: 'app', label: 'App móvil', icon: Smartphone },
    { id: 'seguridad', label: 'Seguridad', icon: Shield },
    { id: 'facturacion', label: 'Facturación', icon: CreditCard },
  ];

  return (
    <div className="page-fintech-wrap animate-fade-in">
      <div className="fintech-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px 0' }}>
        <div className="tabs-premium" style={{ marginBottom: 28 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-premium ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '28px' }}>
          {activeTab === 'perfil' && (
            <form onSubmit={handleSaveProfile}>
              <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
                <div style={{ position: 'relative' }}>
                  <div className="avatar avatar-lg" style={{ width: 100, height: 100, fontSize: 32 }}>
                    {profile.nombre?.[0]}{profile.apellido?.[0]}
                  </div>
                  <button type="button" className="btn-icon" style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, background: 'var(--brand)', color: 'var(--brand-on)' }}>
                    <Settings size={14} />
                  </button>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="input-wrapper">
                      <label className="form-label">Tu Nombre</label>
                      <input className="input" value={profile.nombre} onChange={(e) => setProfile({ ...profile, nombre: e.target.value })} />
                    </div>
                    <div className="input-wrapper">
                      <label className="form-label">Apellido</label>
                      <input className="input" value={profile.apellido} onChange={(e) => setProfile({ ...profile, apellido: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="input-wrapper">
                      <label className="form-label">Email</label>
                      <input type="email" className="input" value={profile.email} disabled />
                    </div>
                    <div className="input-wrapper">
                      <label className="form-label">Teléfono</label>
                      <input className="input" value={profile.telefono} onChange={(e) => setProfile({ ...profile, telefono: e.target.value })} />
                    </div>
                  </div>
                  <div className="input-wrapper">
                    <label className="form-label">Dirección</label>
                    <input className="input" value={profile.direccion} onChange={(e) => setProfile({ ...profile, direccion: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div className="input-wrapper">
                      <label className="form-label">Ciudad</label>
                      <input className="input" value={profile.ciudad} onChange={(e) => setProfile({ ...profile, ciudad: e.target.value })} />
                    </div>
                    <div className="input-wrapper">
                      <label className="form-label">País</label>
                      <input className="input" value={profile.pais} onChange={(e) => setProfile({ ...profile, pais: e.target.value })} />
                    </div>
                    <div className="input-wrapper">
                      <label className="form-label">Código Postal</label>
                      <input className="input" value={profile.codigo_postal} onChange={(e) => setProfile({ ...profile, codigo_postal: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <ActionButton type="submit" loading={loading} icon={!loading ? <Save size={16} /> : undefined}>
                      Guardar
                    </ActionButton>
                  </div>
                </div>
              </div>

              <div className="theme-picker-section">
                <h3>Apariencia</h3>
                <p>Elige cómo quieres ver BusinessOS en tu pantalla.</p>
                <div className="theme-picker">
                  {([
                    { id: 'light' as const, label: 'Claro', icon: Sun },
                    { id: 'dark' as const, label: 'Oscuro', icon: Moon },
                    { id: 'system' as const, label: 'Sistema', icon: Monitor },
                  ]).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className={`theme-picker-btn ${theme === id ? 'active' : ''}`}
                      onClick={() => setTheme(id)}
                    >
                      <Icon size={20} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {activeTab === 'bots' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="card" style={{ padding: 24, background: 'var(--bg-input)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-blue-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle size={24} color="var(--brand)" />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: 16 }}>Bot de Telegram</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {botStatus?.username ? `@${botStatus.username}` : '@Saas_ia_bot'} — Business Assistant
                    </p>
                  </div>
                  {telegramLinked && (
                    <span className="badge badge-success" style={{ marginLeft: 'auto' }}>
                      <CheckCircle size={12} /> Vinculado
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                  1. Abre Telegram y busca <strong>@Saas_ia_bot</strong><br />
                  2. Envía <strong>/start</strong> para obtener tu código<br />
                  3. Pega el código aquí (formato: TG-123456789)<br />
                  4. Chatea por texto o voz — mismo asistente que en <strong>/ai</strong><br />
                  5. Comandos: <strong>/chat</strong> /ventas /inventario /deudas /ayuda
                </p>

                {!telegramLinked ? (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <input
                      className="input"
                      placeholder="TG-123456789"
                      value={botConfig.telegram_code}
                      onChange={(e) => setBotConfig((b) => ({ ...b, telegram_code: e.target.value }))}
                      style={{ flex: 1 }}
                    />
                    <ActionButton loading={loading} icon={<LinkIcon size={16} />} onClick={handleLinkTelegram}>
                      Vincular
                    </ActionButton>
                  </div>
                ) : (
                  <button type="button" className="btn-ghost" onClick={handleUnlinkTelegram}>
                    Desvincular Telegram
                  </button>
                )}
              </div>

              <div className="card" style={{ padding: 24, background: 'var(--bg-input)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle size={24} color="var(--success)" />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: 16 }}>WhatsApp Business</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Vincula tu número para usar el asistente por WhatsApp
                    </p>
                  </div>
                  {whatsappLinked && (
                    <span className="badge badge-success" style={{ marginLeft: 'auto' }}>
                      <CheckCircle size={12} /> Vinculado
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                  1. Ingresa tu número con código de país (ej: 573001234567)<br />
                  2. Envía un mensaje al bot de WhatsApp configurado<br />
                  3. El asistente responderá con datos de tu empresa
                </p>

                {!whatsappLinked ? (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <input
                      className="input"
                      placeholder="573001234567"
                      value={botConfig.whatsapp_number}
                      onChange={(e) => setBotConfig({ ...botConfig, whatsapp_number: e.target.value })}
                      style={{ flex: 1 }}
                    />
                    <ActionButton loading={loading} icon={<LinkIcon size={16} />} onClick={handleLinkWhatsApp}>
                      Vincular
                    </ActionButton>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Número vinculado: <strong>{whatsappNumber}</strong></p>
                    <button type="button" className="btn-ghost" onClick={handleUnlinkWhatsApp}>
                      Desvincular WhatsApp
                    </button>
                  </div>
                )}
              </div>

              <button type="button" className="btn-secondary" onClick={handleSetupBot} disabled={loading}>
                <Send size={16} /> Configurar Webhook del Bot
              </button>
            </div>
          )}

          {activeTab === 'app' && <PwaSettingsPanel />}

          {activeTab === 'seguridad' && (
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-wrapper">
                <label className="form-label">Contraseña actual</label>
                <input type="password" className="input" placeholder="••••••••" value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="input-wrapper">
                  <label className="form-label">Nueva contraseña</label>
                  <input type="password" className="input" placeholder="Mínimo 8 caracteres" value={passwordForm.next} onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })} required minLength={8} />
                </div>
                <div className="input-wrapper">
                  <label className="form-label">Confirmar contraseña</label>
                  <input type="password" className="input" placeholder="••••••••" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} required />
                </div>
              </div>
              <ActionButton type="submit" loading={loading} icon={<Shield size={16} />} style={{ alignSelf: 'flex-start' }}>
                Actualizar Contraseña
              </ActionButton>
            </form>
          )}

          {activeTab === 'facturacion' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 24, background: 'var(--bg-input)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <div className="empty-icon"><CreditCard size={24} /></div>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: 18, textTransform: 'capitalize' }}>Plan {planInfo.plan}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                      {getPlanDefinition(planInfo.plan).priceCOP > 0
                        ? `$${getPlanDefinition(planInfo.plan).priceCOP.toLocaleString('es-CO')}/mes`
                        : 'Gratis'}
                      {' · '}
                      {planInfo.activa ? 'Activo' : 'Inactivo'}
                      {planInfo.plan_expira_en && ` · Vence ${new Date(planInfo.plan_expira_en).toLocaleDateString('es-CO')}`}
                    </p>
                    {planInfo.billing_status !== 'manual' && (
                      <span className="badge badge-info" style={{ marginTop: 6 }}>Wompi: {planInfo.billing_status}</span>
                    )}
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                      Pagos seguros con Wompi (Bancolombia) — PSE, Nequi, tarjetas y más.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {getNextPlan(planInfo.plan) && (
                    <ActionButton loading={loading} onClick={() => handleUpgradePlan()}>
                      Mejorar a {getNextPlan(planInfo.plan)}
                    </ActionButton>
                  )}
                  {planInfo.plan !== 'free' && (
                    <button type="button" className="btn-secondary" onClick={handleRenewPlan} disabled={loading}>
                      Renovar plan mensual
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                {(['starter', 'pro', 'enterprise'] as SubscriptionPlan[]).map((planId) => {
                  const plan = PLAN_CATALOG[planId];
                  const isCurrent = planInfo.plan === planId;
                  return (
                    <div key={planId} className="card" style={{ padding: 20, border: isCurrent ? '1px solid var(--brand-border)' : undefined }}>
                      <h4 style={{ fontWeight: 700, marginBottom: 4 }}>{plan.name}</h4>
                      <p style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
                        ${plan.priceCOP.toLocaleString('es-CO')}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>/mes</span>
                      </p>
                      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, paddingLeft: 18, lineHeight: 1.7 }}>
                        {plan.features.slice(0, 4).map((f) => <li key={f}>{f}</li>)}
                      </ul>
                      <ActionButton
                        size="sm"
                        loading={loading}
                        disabled={isCurrent}
                        onClick={() => handleUpgradePlan(planId)}
                        style={{ width: '100%' }}
                      >
                        {isCurrent ? 'Plan actual' : `Elegir ${plan.name}`}
                      </ActionButton>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
      {wompiCheckout && (
        <WompiCheckout
          checkout={wompiCheckout}
          onComplete={() => {
            setWompiCheckout(null);
            reloadPlanInfo();
          }}
          onClose={() => setWompiCheckout(null)}
        />
      )}
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <Suspense fallback={<div className="page-fintech-wrap" style={{ padding: 40 }}>Cargando configuración...</div>}>
      <ConfiguracionContent />
    </Suspense>
  );
}
