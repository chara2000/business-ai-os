'use client';

import type { LucideIcon } from 'lucide-react';
import { FormModal, type ModalSize } from './FormModal';

interface ModalProps {
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
  bodyScroll?: 'auto' | 'always' | 'never';
}

/** Modal unificado — misma base visual que FormModal (lime fintech). */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth,
  maxHeight,
  size = 'lg',
  bodyScroll,
}: ModalProps) {
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={icon}
      footer={footer}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      size={size}
      bodyScroll={bodyScroll}
    >
      {children}
    </FormModal>
  );
}
