'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'glass';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'btn-3d btn-3d-primary',
  secondary: 'btn-3d btn-3d-secondary',
  ghost: 'btn-3d btn-3d-ghost',
  danger: 'btn-3d btn-3d-danger',
  outline: 'btn-3d btn-3d-outline',
  glass: 'btn-3d btn-3d-glass',
};

const sizes: Record<Size, string> = {
  sm: 'btn-size-sm',
  md: 'btn-size-md',
  lg: 'btn-size-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        variant === 'primary' ? 'btn-action' : 'btn-3d-base',
        variant !== 'primary' && variants[variant],
        variant !== 'primary' && sizes[size],
        variant === 'primary' && size === 'sm' && 'btn-action-sm',
        variant === 'primary' && size === 'lg' && 'btn-action-lg',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children && <span>{children}</span>}
    </button>
  )
);

Button.displayName = 'Button';
