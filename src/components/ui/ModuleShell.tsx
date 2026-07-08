'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModuleStat {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
}

interface ModuleShellProps {
  stats?: ModuleStat[];
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  boundedTable?: boolean;
}

const toneClass: Record<NonNullable<ModuleStat['tone']>, string> = {
  brand: 'fintech-stat-brand',
  success: 'fintech-stat-success',
  warning: 'fintech-stat-warning',
  danger: 'fintech-stat-danger',
  neutral: 'fintech-stat-neutral',
};

export function ModuleShell({ stats, toolbar, children, className, boundedTable }: ModuleShellProps) {
  return (
    <div className={cn('module-fintech animate-fade-in-up', className)}>
      {stats && stats.length > 0 && (
        <div className="module-fintech-stats">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={cn('fintech-stat', toneClass[s.tone ?? 'neutral'])}>
                <div className="fintech-stat-body">
                  <span className="fintech-stat-label">{s.label}</span>
                  <span className="fintech-stat-value">{s.value}</span>
                </div>
                {Icon && (
                  <span className="fintech-stat-icon">
                    <Icon size={18} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {toolbar && <div className="fintech-toolbar">{toolbar}</div>}
      <div className={cn('fintech-card module-fintech-body', boundedTable && 'module-fintech-body--table')}>
        {children}
      </div>
    </div>
  );
}
