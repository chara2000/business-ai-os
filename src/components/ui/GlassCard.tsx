'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  padding?: boolean;
  hover?: boolean;
  delay?: number;
}

export function GlassCard({
  children,
  className,
  title,
  subtitle,
  action,
  padding = true,
  hover = true,
  delay = 0,
}: GlassCardProps) {
  return (
    <motion.div
      className={cn('glass-card', padding && 'glass-card-padded', hover && 'glass-card-hover', className)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {(title || action) && (
        <div className="glass-card-header">
          <div>
            {title && <h3 className="glass-card-title">{title}</h3>}
            {subtitle && <p className="glass-card-subtitle">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </motion.div>
  );
}
