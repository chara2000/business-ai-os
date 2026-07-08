'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_WIDTH: Record<ModalSize, number> = {
  sm: 460,
  md: 580,
  lg: 700,
  xl: 860,
};

const SIZE_MAX_HEIGHT: Record<ModalSize, string> = {
  sm: 'min(72dvh, 520px)',
  md: 'min(82dvh, 680px)',
  lg: 'min(86dvh, 780px)',
  xl: 'min(90dvh, 860px)',
};

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  maxHeight?: string;
  size?: ModalSize;
  className?: string;
  /** auto = scroll solo si el contenido no cabe */
  bodyScroll?: 'auto' | 'always' | 'never';
}

export function FormModal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  maxWidth,
  maxHeight,
  size = 'md',
  className,
  bodyScroll = 'auto',
}: FormModalProps) {
  const width = maxWidth ?? SIZE_WIDTH[size];
  const height = maxHeight ?? SIZE_MAX_HEIGHT[size];
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop modal-backdrop-exclusive"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className={cn(
              'modal modal-exclusive',
              bodyScroll === 'always' && 'modal-exclusive--scroll',
              bodyScroll === 'never' && 'modal-exclusive--no-scroll',
              className,
            )}
            style={{ maxWidth: width, maxHeight: height }}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-accent-bar" aria-hidden />

            <div className="modal-header">
              <div className="modal-header-text">
                {Icon && (
                  <span className="modal-header-icon">
                    <Icon size={20} strokeWidth={2.2} />
                  </span>
                )}
                <div className="modal-header-copy">
                  <h2 id="modal-title" className="modal-title">{title}</h2>
                  {subtitle && <p className="modal-subtitle">{subtitle}</p>}
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={onClose}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div
              className={cn(
                'modal-body modal-body-scroll',
                bodyScroll === 'always' && 'modal-body-scroll--always',
              )}
            >
              {children}
            </div>

            {footer && (
              <div className="modal-footer">
                <div className="modal-footer-actions">{footer}</div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
