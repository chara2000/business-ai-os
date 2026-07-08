'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MetricTone = 'brand' | 'cyan' | 'success' | 'warning' | 'danger' | 'violet';

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  tone?: MetricTone;
  trend?: { value: string; positive?: boolean };
  className?: string;
  delay?: number;
}

const toneMap: Record<MetricTone, string> = {
  brand: 'metric-card-brand',
  cyan: 'metric-card-cyan',
  success: 'metric-card-success',
  warning: 'metric-card-warning',
  danger: 'metric-card-danger',
  violet: 'metric-card-violet',
};

export function MetricCard({ label, value, sub, icon: Icon, tone = 'brand', trend, className, delay = 0 }: MetricCardProps) {
  return (
    <div
      className={cn('metric-card glass-3d', toneMap[tone], className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="metric-card-glow" aria-hidden />
      <div className="metric-card-top">
        <span className="metric-card-label">{label}</span>
        <span className="metric-card-icon-wrap">
          <Icon size={18} strokeWidth={2.25} />
        </span>
      </div>
      <div className="metric-card-value">{value}</div>
      {(sub || trend) && (
        <div className="metric-card-foot">
          {sub && <span className="metric-card-sub">{sub}</span>}
          {trend && (
            <span className={cn('metric-card-trend', trend.positive ? 'is-up' : 'is-down')}>
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
