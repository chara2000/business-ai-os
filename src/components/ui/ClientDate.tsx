'use client';

import { useState, useEffect } from 'react';

interface ClientDateProps {
  value: string | Date | undefined | null;
  locale?: string;
  options?: Intl.DateTimeFormatOptions;
  fallback?: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Renderiza una fecha SOLO en el cliente para evitar el error de hidratación
 * React #418 (server locale != browser locale).
 * En SSR muestra un placeholder neutral.
 */
export function ClientDate({
  value,
  locale = 'es-CO',
  options,
  fallback = '—',
  style,
  className,
}: ClientDateProps) {
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (!value) {
        setFormatted(fallback);
      } else {
        setFormatted(new Date(value).toLocaleDateString(locale, options));
      }
    } catch {
      setFormatted(fallback);
    }
  }, [value, locale, options, fallback]);

  return (
    <span style={style} className={className}>
      {formatted ?? fallback}
    </span>
  );
}
