'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { BarChart3, CreditCard, Package, Plus, ShoppingCart, UserPlus, X } from 'lucide-react';

type FabAction = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
};

function getActions(pathname: string): FabAction[] {
  if (pathname.startsWith('/inventario')) {
    return [
      { href: '/inventario', label: 'Nuevo producto', icon: Package },
      { href: '/compras', label: 'Registrar compra', icon: ShoppingCart },
    ];
  }
  if (pathname.startsWith('/clientes') || pathname.startsWith('/creditos')) {
    return [
      { href: '/clientes', label: 'Nuevo cliente', icon: UserPlus },
      { href: '/creditos', label: 'Nuevo crédito', icon: CreditCard },
    ];
  }
  if (pathname.startsWith('/reportes') || pathname.startsWith('/finanzas')) {
    return [
      { href: '/reportes', label: 'Ver reportes', icon: BarChart3 },
      { href: '/ventas', label: 'Nueva venta', icon: ShoppingCart },
    ];
  }
  return [
    { href: '/ventas', label: 'Nueva venta', icon: ShoppingCart },
    { href: '/inventario', label: 'Nuevo producto', icon: Package },
  ];
}

export function MobileFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const actions = useMemo(() => getActions(pathname), [pathname]);

  return (
    <div className={`mobile-fab ${open ? 'is-open' : ''}`}>
      <div className="mobile-fab__menu" aria-hidden={!open}>
        {actions.map(({ href, label, icon: Icon }) => (
          <Link key={`${href}-${label}`} href={href} className="mobile-fab__action" onClick={() => setOpen(false)}>
            <span>{label}</span>
            <Icon size={15} />
          </Link>
        ))}
      </div>

      <button
        type="button"
        className="mobile-fab__button"
        aria-label={open ? 'Cerrar acciones rápidas' : 'Abrir acciones rápidas'}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={20} /> : <Plus size={20} />}
      </button>
    </div>
  );
}
