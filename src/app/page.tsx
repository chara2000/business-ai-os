import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Zap, Bot, Package, TrendingUp, Users,
  MessageCircle, Smartphone, Globe, Shield, ArrowRight,
  Check, Star, Sparkles, BarChart3, CreditCard,
} from 'lucide-react';
import './landing.css';

export const metadata: Metadata = {
  title: 'Business AI OS — El Sistema Empresarial con Inteligencia Artificial',
  description: 'CRM + ERP con IA para pequeñas y medianas empresas. Administra inventario, ventas, clientes y finanzas desde web, móvil o Telegram/WhatsApp.',
};

const FEATURES = [
  { icon: Bot, title: 'Asistente IA integrado', desc: 'Controla tu negocio hablando con inteligencia artificial. Sin aprender software complicado.' },
  { icon: Package, title: 'Inventario inteligente', desc: 'Control de stock, kardex, alertas automáticas y predicción de demanda con IA.' },
  { icon: TrendingUp, title: 'Ventas en tiempo real', desc: 'Punto de venta, facturas, historial y reportes de rentabilidad al instante.' },
  { icon: Users, title: 'CRM completo', desc: 'Gestión de clientes, créditos, fiados y cartera con alertas de morosidad.' },
  { icon: MessageCircle, title: 'Bots Telegram & WhatsApp', desc: 'Tu negocio disponible en tus apps de mensajería favoritas. Respuestas en segundos.' },
  { icon: BarChart3, title: 'Reportes inteligentes', desc: 'Dashboards visuales con análisis de rentabilidad, tendencias y predicciones.' },
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

export default function HomePage() {
  return (
    <div className="landing-page">
      <div className="landing-bg" aria-hidden>
        <div className="landing-bg__orb landing-bg__orb--lime" />
        <div className="landing-bg__orb landing-bg__orb--violet" />
        <div className="landing-bg__grid" />
      </div>

      <header className="landing-nav">
        <Link href="/" className="landing-brand">
          <span className="landing-brand__mark">
            <Zap size={18} strokeWidth={2.5} />
          </span>
          <span className="landing-brand__name">Business AI OS</span>
        </Link>
        <div className="landing-nav__actions">
          <Link href="/login" className="landing-nav__link">Iniciar sesión</Link>
          <Link href="/register" className="landing-btn landing-btn--primary">
            Empezar gratis <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero__inner">
          <div className="landing-eyebrow">
            <Sparkles size={13} />
            Nuevo: Asistente de voz con Whisper AI
          </div>

          <h1>
            <span className="accent">Tu gerente digital</span>
            <br />
            con inteligencia artificial
          </h1>

          <p>
            Administra toda tu empresa — inventario, ventas, clientes y finanzas — hablando con IA desde web, móvil o WhatsApp. Sin aprender software complicado.
          </p>

          <div className="landing-hero__cta">
            <Link href="/register" className="landing-btn landing-btn--primary">
              Empezar gratis — 14 días <ArrowRight size={18} />
            </Link>
            <Link href="/dashboard" className="landing-btn landing-btn--ghost">
              Ver demo en vivo
            </Link>
          </div>

          <div className="landing-hero__stats">
            {[
              { value: '500+', label: 'Empresas activas' },
              { value: '99.9%', label: 'Uptime' },
              { value: '< 1s', label: 'Respuesta IA' },
            ].map((s) => (
              <div key={s.label} className="landing-stat">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-features landing-section">
        <div className="landing-section-head">
          <h2>Todo lo que tu negocio necesita</h2>
          <p>Un sistema completo que se adapta a cualquier tipo de comercio</p>
        </div>
        <div className="landing-feature-grid">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <article key={f.title} className="landing-feature-card">
                <div className="landing-feature-card__icon">
                  <Icon size={22} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-platform">
        <div className="landing-section landing-platform__grid">
          <div>
            <div className="landing-section-head" style={{ textAlign: 'left', marginBottom: 0 }}>
              <h2>Disponible en todos tus dispositivos</h2>
              <p style={{ margin: '0' }}>Web, app móvil PWA, Telegram y WhatsApp. Tu negocio siempre en tu bolsillo.</p>
            </div>
            <div className="landing-platform__list">
              {[
                { icon: Globe, label: 'Panel web completo', desc: 'Todos los módulos desde cualquier navegador' },
                { icon: Smartphone, label: 'PWA instalable', desc: 'App nativa en Android, iOS y escritorio' },
                { icon: MessageCircle, label: 'Bot Telegram & WhatsApp', desc: 'Consultas y comandos desde tus chats' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="landing-platform__item">
                    <span className="landing-platform__item-icon"><Icon size={18} /></span>
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="landing-mini-grid">
            {[
              { icon: Shield, label: 'Multi-empresa', sub: 'Datos 100% aislados' },
              { icon: Bot, label: 'IA empresarial', sub: 'GPT-4o integrado' },
              { icon: BarChart3, label: 'Reportes IA', sub: 'Análisis automático' },
              { icon: CreditCard, label: 'Tiempo real', sub: 'Sin recargar página' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="landing-mini-card">
                  <div className="landing-feature-card__icon" style={{ margin: '0 auto' }}>
                    <Icon size={20} />
                  </div>
                  <strong>{item.label}</strong>
                  <span>{item.sub}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="landing-plans landing-section">
        <div className="landing-section-head">
          <h2>Planes para tu negocio</h2>
          <p>14 días gratis. Sin tarjeta de crédito.</p>
        </div>
        <div className="landing-plan-grid">
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              className={`landing-plan-card${plan.popular ? ' landing-plan-card--popular' : ''}`}
            >
              {plan.popular && <span className="landing-plan-card__badge">Más popular</span>}
              <h3>{plan.name}</h3>
              <div className="landing-plan-card__price">
                <strong>{plan.price}</strong>
                <span>{plan.period}</span>
              </div>
              <ul>
                {plan.features.map((f) => (
                  <li key={f}>
                    <Check size={15} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className={`landing-btn ${plan.popular ? 'landing-btn--primary' : 'landing-btn--ghost'}`}
                style={{ width: '100%' }}
              >
                Comenzar gratis
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-testimonials">
        <div className="landing-section">
          <div className="landing-section-head">
            <h2>Empresarios que confían en nosotros</h2>
          </div>
          <div className="landing-testimonial-grid">
            {TESTIMONIALS.map((t) => (
              <article key={t.name} className="landing-testimonial-card">
                <div className="landing-testimonial-card__stars">
                  {Array(t.stars).fill(0).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <blockquote>&ldquo;{t.text}&rdquo;</blockquote>
                <cite>
                  {t.name}
                  <span>{t.empresa}</span>
                </cite>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta">
        <h2>Empieza hoy. Es gratis.</h2>
        <p>Únete a más de 500 empresas que ya administran su negocio con inteligencia artificial.</p>
        <Link href="/register" className="landing-btn landing-btn--primary" style={{ fontSize: 16, padding: '14px 32px' }}>
          Crear mi cuenta gratis <ArrowRight size={20} />
        </Link>
      </section>

      <footer className="landing-footer">
        <Link href="/" className="landing-brand">
          <span className="landing-brand__mark" style={{ width: 30, height: 30, borderRadius: 8 }}>
            <Zap size={14} strokeWidth={2.5} />
          </span>
          <span className="landing-brand__name" style={{ fontSize: 14 }}>Business AI OS</span>
        </Link>
        <p className="landing-footer__copy">© 2026 Business AI OS. Todos los derechos reservados.</p>
        <nav className="landing-footer__links" aria-label="Legal">
          <a href="#">Privacidad</a>
          <a href="#">Términos</a>
          <a href="#">Soporte</a>
        </nav>
      </footer>
    </div>
  );
}
