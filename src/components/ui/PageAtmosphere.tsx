'use client';

/** Blobs decorativos estilo ChefFlow — acento azul del CRM */
export function PageAtmosphere({ variant = 'brand' }: { variant?: 'brand' | 'cyan' | 'indigo' }) {
  const color =
    variant === 'cyan' ? 'var(--accent-cyan)' :
    variant === 'indigo' ? 'var(--accent-indigo)' :
    'var(--brand)';

  return (
    <div className="page-atmosphere" aria-hidden="true">
      <div className="page-blob page-blob-tl" style={{ background: color }} />
      <div className="page-blob page-blob-br" style={{ background: 'var(--accent-cyan)' }} />
    </div>
  );
}
