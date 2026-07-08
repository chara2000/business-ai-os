'use client';

import { usePathname } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';

export function AuthPagesClient() {
  const pathname = usePathname();
  const isRegister = pathname === '/register';

  return <AuthShell isRegister={isRegister} />;
}
