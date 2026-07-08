interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
  padding?: string;
}

export function Card({ children, className = '', title, action, padding = '24px' }: CardProps) {
  return (
    <div className={`card ${className}`} style={{ padding }}>
      {(title || action) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg?: string;
  change?: { value: string; positive: boolean };
}

export function StatCard({ label, value, icon, iconBg = 'var(--accent-blue-soft)', change }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="stat-card-content">
        <span className="stat-card-label">{label}</span>
        <span className="stat-card-value">{value}</span>
        {change && (
          <span className={change.positive ? 'stat-change-up' : 'stat-change-down'}>
            {change.value}
          </span>
        )}
      </div>
    </div>
  );
}
