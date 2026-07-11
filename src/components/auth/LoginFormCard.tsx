'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/Input';

export function LoginFormCard() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('¡Bienvenido de vuelta!');
      router.refresh();
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';
      toast.error(msg === 'Invalid login credentials' ? 'Credenciales incorrectas' : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form-card login-form-card--minimal auth-panel-content">
      <div className="login-form-head">
        <div className="sidebar-rail-logo login-form-logo" style={{ margin: '0 auto' }}>
          <Sparkles size={20} color="#1A1A1A" />
        </div>
        <h2>Iniciar sesión</h2>
        <p className="login-form-subtitle">Accede a tu panel empresarial</p>
      </div>

      <form onSubmit={handleLogin} className="login-form">
        <Input
          label="Correo electrónico"
          type="email"
          placeholder="tu@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<Mail size={16} />}
          required
        />
        <Input
          label="Contraseña"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock size={16} />}
          required
        />

        <div className="login-form-options">
          <label>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ accentColor: 'var(--brand)' }}
            />
            Recordarme
          </label>
          <Link href="/forgot-password">¿Olvidaste tu contraseña?</Link>
        </div>

        <button type="submit" className="login-submit-btn" disabled={loading}>
          {loading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              <span className="login-submit-logo">
                <Sparkles size={16} color="#1A1A1A" />
              </span>
              <span className="login-submit-text">Ingresar</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <p className="login-form-footer">
        ¿No tienes cuenta?{' '}
        <Link href="/register">Crear cuenta gratis</Link>
      </p>
    </div>
  );
}
