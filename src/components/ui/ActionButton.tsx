'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  loading?: boolean;
  size?: 'sm' | 'md';
}

/** Botón principal morado del sistema — "Nuevo X", guardar, etc. */
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ icon, children, loading, size = 'md', className, disabled, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn('btn-action', size === 'sm' && 'btn-action-sm', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
      {children != null && children !== false && (
        typeof children === 'string' || typeof children === 'number'
          ? <span>{children}</span>
          : children
      )}
    </button>
  )
);

ActionButton.displayName = 'ActionButton';
