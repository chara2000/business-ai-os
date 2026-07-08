import { Sparkles, Shield, Bot, TrendingUp, Users, Zap, Building2, BarChart3, Globe } from 'lucide-react';

const FEATURES = [
  { icon: Bot, text: 'Asistente IA integrado' },
  { icon: TrendingUp, text: 'Reportes en tiempo real' },
  { icon: Users, text: 'Multi-empresa y roles' },
  { icon: Shield, text: 'Seguridad enterprise' },
];

const STATS = [
  { icon: Building2, label: 'Empresas', value: '2.4K+' },
  { icon: BarChart3, label: 'Transacciones', value: '180K' },
  { icon: Globe, label: 'Países', value: '12' },
];

export function LoginInfoPanel() {
  return (
    <div className="login-panel-left-inner auth-panel-content">
      <div className="login-brand-row">
        <div className="sidebar-rail-logo">
          <Sparkles size={20} color="#1A1A1A" />
        </div>
        <span className="sidebar-brand-name">Business<span>OS</span></span>
      </div>

      <div className="badge badge-brand" style={{ marginBottom: 14, padding: '5px 12px', fontSize: 11 }}>
        <Zap size={12} /> Plataforma Enterprise
      </div>

      <h1 className="login-brand-title">
        Gestiona tu negocio con{' '}
        <span className="login-brand-gradient">Inteligencia Artificial</span>
      </h1>

      <p className="login-brand-desc">
        CRM & ERP universal con flujos optimizados y automatización inteligente.
      </p>

      <div className="login-stats-row">
        {STATS.map((s) => (
          <div key={s.label} className="login-stat-pill">
            <s.icon size={13} color="var(--brand-deep)" />
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </div>
        ))}
      </div>

      <div className="login-features">
        {FEATURES.map((f) => (
          <div key={f.text} className="login-feature-item">
            <span className="login-feature-icon">
              <f.icon size={16} color="var(--brand-deep)" />
            </span>
            <span>{f.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
