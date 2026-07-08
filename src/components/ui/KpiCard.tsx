'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  color?: 'blue' | 'teal' | 'pink' | 'amber' | 'purple';
  delay?: number;
}

const colorMap = {
  blue: 'kpi-icon-blue',
  teal: 'kpi-icon-teal',
  pink: 'kpi-icon-pink',
  amber: 'kpi-icon-amber',
  purple: 'kpi-icon-purple',
};

export function KpiCard({ label, value, icon, trend, color = 'blue', delay = 0 }: KpiCardProps) {
  return (
    <motion.div
      className="kpi-premium"
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <div className="kpi-premium-glow" />
      <div className={cn('kpi-premium-icon', colorMap[color])}>{icon}</div>
      <div className="kpi-premium-body">
        <span className="kpi-premium-label">{label}</span>
        <span className="kpi-premium-value">{value}</span>
        {trend && (
          <span className={cn('kpi-premium-trend', trend.positive ? 'trend-up' : 'trend-down')}>
            {trend.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}
          </span>
        )}
      </div>
    </motion.div>
  );
}
