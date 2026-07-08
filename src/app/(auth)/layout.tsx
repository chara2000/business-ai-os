import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { AuthPagesClient } from '@/components/auth/AuthPagesClient';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-layout-root">
      <AmbientBackground />
      <AuthPagesClient />
      <div className="auth-layout-sr-only" aria-hidden="true">{children}</div>
    </div>
  );
}
