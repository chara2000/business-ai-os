'use client';

import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, iconRight, className, type, ...props }, ref) => {
    const [showPwd, setShowPwd] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPwd ? 'text' : type;

    return (
      <div className="input-group">
        {label && <label className="input-label">{label}</label>}
        <div className={cn('input-wrap', error && 'input-wrap-error')}>
          {icon && <span className="input-icon-left">{icon}</span>}
          <input
            ref={ref}
            type={inputType}
            className={cn('input-premium', icon && 'has-icon-left', (iconRight || isPassword) && 'has-icon-right', className)}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              className="input-icon-right input-toggle-pwd"
              onClick={() => setShowPwd(!showPwd)}
              tabIndex={-1}
              aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          ) : iconRight ? (
            <span className="input-icon-right">{iconRight}</span>
          ) : null}
          <span className="input-focus-ring" aria-hidden="true" />
        </div>
        {error && <span className="input-error">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
