import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Zap, Bot, Package, TrendingUp, Users, CreditCard,
  MessageCircle, Smartphone, Globe, Shield, ArrowRight,
  Check, Star, Sparkles, BarChart3,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Business AI OS — El Sistema Empresarial con Inteligencia Artificial',
  description: 'CRM + ERP con IA para pequeñas y medianas empresas. Administra inventario, ventas, clientes y finanzas desde web, móvil o Telegram/WhatsApp.',
};

const FEATURES = [
  { icon: Bot, title: 'Asistente IA integrado', desc: 'Controla tu negocio hablando con inteligencia artificial. Sin aprender software complicado.', color: 'violet' },
  { icon: Package, title: 'Inventario inteligente', desc: 'Control de stock, kardex, alertas automáticas y predicción de demanda con IA.', color: 'cyan' },
  { icon: TrendingUp, title: 'Ventas en tiempo real', desc: 'Punto de venta, facturas, historial y reportes de rentabilidad al instante.', color: 'green' },
  { icon: Users, title: 'CRM completo', desc: 'Gestión de clientes, créditos, fiados y cartera con alertas de morosidad.', color: 'gold' },
  { icon: MessageCircle, title: 'Bots Telegram & WhatsApp', desc: 'Tu negocio disponible en tus apps de mensajería favoritas. Respuestas en segundos.', color: 'indigo' },
  { icon: BarChart3, title: 'Reportes inteligentes', desc: 'Dashboards visuales con análisis de rentabilidad, tendencias y predicciones.', color: 'rose' },
];

const PLANS = [
  {
    name: 'Starter', price: '$49.900', period: '/mes', popular: false,
    features: ['1 usuario', '500 productos', 'IA básica (100 consultas/mes)', 'Bot Telegram', 'Soporte email'],
  },
  {
    name: 'Pro', price: '$99.900', period: '/mes', popular: true,
    features: ['5 usuarios', 'Productos ilimitados', 'IA avanzada (1.000 consultas/mes)', 'Bot Telegram + WhatsApp', 'PWA móvil', 'Soporte prioritario'],
  },
  {
    name: 'Enterprise', price: '$249.900', period: '/mes', popular: false,
    features: ['Usuarios ilimitados', 'Multi-empresa', 'IA sin límites', 'Todos los bots', 'API acceso', 'Gerente dedicado'],
  },
];

const TESTIMONIALS = [
  { name: 'Ricardo Mora', empresa: 'Ferretería El Tornillo', text: 'Antes tardaba 2 horas en el inventario. Ahora le pregunto a la IA y listo. Increíble.', stars: 5 },
  { name: 'Ana Restrepo', empresa: 'Tienda Naturales', text: 'Mis clientes con fiado ya no se me olvidan. El sistema me avisa automáticamente.', stars: 5 },
  { name: 'Carlos Vega', empresa: 'Taller Mecánico CV', text: 'Lo instalé en mi celular como app. Es como tener un contador en el bolsillo.', stars: 5 },
];

const ICON_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  violet: { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', icon: 'rgb(167,139,250)' },
  cyan:   { bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.25)',  icon: 'rgb(34,211,238)' },
  green:  { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', icon: 'rgb(52,211,153)' },
  gold:   { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', icon: 'rgb(251,191,36)' },
  indigo: { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)', icon: 'rgb(129,140,248)' },
  rose:   { bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.25)',  icon: 'rgb(251,113,133)' },
};

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', overflowX: 'hidden' }}>

      {/* NAVBAR */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: 64,
        background: 'rgba(2,4,16,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, rgb(139,92,246), rgb(99,102,241))', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(139,92,246,0.4)' }}>
            <Zap size={18} color="white" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'white' }}>Business AI OS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/login" style={{ padding: '8px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.70)', textDecoration: 'none', transition: 'color 0.2s' }}>
            Iniciar sesión
          </Link>
          <Link href="/register" className="btn-primary" style={{ textDecoration: 'none', padding: '8px 20px', fontSize: 14 }}>
            Empezar gratis <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ paddingTop: 160, paddingBottom: 100, textAlign: 'center', padding: '160px 24px 100px', position: 'relative' }}>
        {/* Glow effects */}
        <div aria-hidden style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 800, margin: '0 auto' }}>
          <div className="animate-fade-in" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.30)', borderRadius: 20, marginBottom: 28 }}>
            <Sparkles size={13} color="rgb(167,139,250)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgb(167,139,250)' }}>Nuevo: Asistente de voz con Whisper AI</span>
          </div>

          <h1 className="animate-slide-up" style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 900, lineHeight: 1.05, marginBottom: 24 }}>
            <span className="gradient-text">Tu gerente digital</span>
            <br />
            <span style={{ color: 'white' }}>con inteligencia artificial</span>
          </h1>

          <p className="animate-slide-up delay-100" style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: 'rgba(255,255,255,0.60)', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.7 }}>
            Administra toda tu empresa — inventario, ventas, clientes y finanzas — hablando con IA desde web, móvil o WhatsApp. Sin aprender software complicado.
          </p>

          <div className="animate-slide-up delay-200" style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn-primary" style={{ textDecoration: 'none', padding: '14px 32px', fontSize: 16, borderRadius: 14 }}>
              Empezar gratis — 14 días <ArrowRight size={18} />
            </Link>
            <Link href="/dashboard" className="btn-secondary" style={{ textDecoration: 'none', padding: '14px 32px', fontSize: 16, borderRadius: 14 }}>
              Ver demo en vivo
            </Link>
          </div>

          <div className="animate-fade-in delay-400" style={{ display: 'flex', gap: 32, justifyContent: 'center', marginTop: 48, flexWrap: 'wrap' }}>
            {[
              { value: '500+', label: 'Empresas activas' },
              { value: '99.9%', label: 'Uptime' },
              { value: '< 1s', label: 'Respuesta IA' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'white' }}>{s.value}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '80px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, color: 'white', marginBottom: 12 }}>
            Todo lo que tu negocio necesita
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.50)', maxWidth: 540, margin: '0 auto' }}>
            Un sistema completo que se adapta a cualquier tipo de comercio
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            const c = ICON_COLORS[f.color];
            return (
              <div key={f.title} className={`glass-card animate-fade-in delay-${(i % 3 + 1) * 100}`} style={{ padding: 28 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <Icon size={22} color={c.icon} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'white', marginBottom: 10 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* PLATFORMS */}
      <section style={{ padding: '80px 40px', background: 'rgba(139,92,246,0.04)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(26px,3.5vw,40px)', fontWeight: 800, color: 'white', marginBottom: 16 }}>
              Disponible en todos tus dispositivos
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 32 }}>
              Web, app móvil PWA, Telegram y WhatsApp. Tu negocio siempre en tu bolsillo.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { icon: Globe, label: 'Panel web completo', desc: 'Todos los módulos desde cualquier navegador' },
                { icon: Smartphone, label: 'PWA instalable', desc: 'App nativa en Android, iOS y escritorio' },
                { icon: MessageCircle, label: 'Bot Telegram & WhatsApp', desc: 'Consultas y comandos desde tus chats' },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} color="rgb(167,139,250)" />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'white', marginBottom: 3 }}>{item.label}</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{item.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { icon: Shield, label: 'Multi-empresa', sub: 'Datos 100% aislados', color: 'violet' },
              { icon: Bot, label: 'IA empresarial', sub: 'GPT-4o integrado', color: 'cyan' },
              { icon: BarChart3, label: 'Reportes IA', sub: 'Análisis automático', color: 'green' },
              { icon: TrendingUp, label: 'Tiempo real', sub: 'Sin recargar página', color: 'gold' },
            ].map(item => {
              const Icon = item.icon;
              const c = ICON_COLORS[item.color];
              return (
                <div key={item.label} className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Icon size={20} color={c.icon} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>{item.sub}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section style={{ padding: '80px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, color: 'white', marginBottom: 12 }}>Planes para tu negocio</h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.50)' }}>14 días gratis. Sin tarjeta de crédito.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {PLANS.map(plan => (
            <div key={plan.name} className="glass-card" style={{
              padding: 28,
              border: plan.popular ? '1px solid rgba(139,92,246,0.50)' : '1px solid var(--border-default)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {plan.popular && (
                <>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, rgb(139,92,246), rgb(99,102,241))' }} />
                  <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(139,92,246,0.20)', border: '1px solid rgba(139,92,246,0.40)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: 'rgb(167,139,250)' }}>
                    Más popular
                  </div>
                </>
              )}
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'white', fontFamily: 'Outfit, sans-serif', marginBottom: 8 }}>{plan.name}</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 24 }}>
                <span style={{ fontSize: 32, fontWeight: 900, color: 'white', fontFamily: 'Outfit, sans-serif' }}>{plan.price}</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.40)', paddingBottom: 4 }}>{plan.period}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Check size={15} color="rgb(52,211,153)" />
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.70)' }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/register" className={plan.popular ? 'btn-primary' : 'btn-secondary'} style={{ textDecoration: 'none', width: '100%', justifyContent: 'center', display: 'flex' }}>
                Comenzar gratis
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '80px 40px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(26px,4vw,40px)', fontWeight: 800, color: 'white', textAlign: 'center', marginBottom: 48 }}>
            Empresarios que confían en nosotros
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="glass-card" style={{ padding: 28 }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
                  {Array(t.stars).fill(0).map((_, i) => <Star key={i} size={14} fill="rgb(245,158,11)" color="rgb(245,158,11)" />)}
                </div>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, marginBottom: 20, fontStyle: 'italic' }}>"{t.text}"</p>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>{t.empresa}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '100px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 800, height: 400, background: 'radial-gradient(ellipse, rgba(139,92,246,0.20) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(32px,5vw,56px)', fontWeight: 900, color: 'white', marginBottom: 16 }}>
            Empieza hoy. Es gratis.
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', marginBottom: 40, maxWidth: 480, margin: '0 auto 40px' }}>
            Únete a más de 500 empresas que ya administran su negocio con inteligencia artificial.
          </p>
          <Link href="/register" className="btn-primary" style={{ textDecoration: 'none', padding: '16px 40px', fontSize: 18, borderRadius: 16 }}>
            Crear mi cuenta gratis <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '40px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: 'linear-gradient(135deg, rgb(139,92,246), rgb(99,102,241))', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={14} color="white" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'Outfit, sans-serif' }}>Business AI OS</span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)' }}>© 2026 Business AI OS. Todos los derechos reservados.</p>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Privacidad', 'Términos', 'Soporte'].map(l => (
            <a key={l} href="#" style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
      </footer>

    </main>
  );
}
