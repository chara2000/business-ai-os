'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight, Sparkles, Building2, User, CheckCircle2, Lock, Mail, Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/Input';

const BUSINESS_TYPES = [
  { value: 'ferreteria', label: 'Ferretería & Construcción' },
  { value: 'restaurante', label: 'Restaurante & Alimentos' },
  { value: 'tienda', label: 'Tienda & Retail' },
  { value: 'taller', label: 'Taller & Automotriz' },
  { value: 'farmacia', label: 'Farmacia & Salud' },
  { value: 'distribuidora', label: 'Distribuidora & Logística' },
  { value: 'comercio', label: 'Comercio General' },
  { value: 'servicios', label: 'Empresa de Servicios' },
  { value: 'otro', label: 'Otro / No especificado' },
];

const STEPS = [
  { num: 1, label: 'Empresa', icon: Building2 },
  { num: 2, label: 'Cuenta', icon: User },
];

export function RegisterFormCard() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    empresa_nombre: '',
    tipo_negocio: '',
    email: '',
    password: '',
  });

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const passwordStrength = form.password.length < 8
    ? 'weak'
    : form.password.length < 12
      ? 'medium'
      : 'strong';

  const handleNext = () => {
    if (!form.empresa_nombre || !form.tipo_negocio || !form.nombre || !form.apellido) {
      toast.error('Completa los datos de la empresa');
      return;
    }
    setStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          apellido: form.apellido,
          empresa_nombre: form.empresa_nombre,
          tipo_negocio: form.tipo_negocio,
          email: form.email,
          password: form.password,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al registrarse');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (signInError) throw signInError;

      toast.success('¡Registro exitoso! Preparando tu entorno...');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrarse';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form-card auth-panel-content">
      <div className="login-form-head register-form-head">
        <h2>Crear cuenta</h2>
        <p>Configura tu empresa en 2 pasos</p>
      </div>

      <div className="register-steps">
        {STEPS.map((s, i) => {
          const active = step === s.num;
          const done = step > s.num;
          return (
            <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className={`register-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
                <div className="register-step-dot">
                  {done ? <CheckCircle2 size={14} /> : <s.icon size={13} />}
                </div>
                <span className="register-step-label">{s.label}</span>
              </div>
              {i === 0 && <div className={`register-step-line ${done ? 'done' : ''}`} />}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleRegister} className="login-form">
        {step === 1 && (
          <motion.div
            key="step1"
            className="register-form-body"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="register-form-section">
              <p className="register-form-section-title">Datos de la empresa</p>
              <div className="register-form-fields">
                <Input
                  label="Nombre comercial / organización"
                  placeholder="Ej: TechCorp S.A."
                  value={form.empresa_nombre}
                  onChange={(e) => update('empresa_nombre', e.target.value)}
                  icon={<Building2 size={16} />}
                  required
                />

                <div className="input-group">
                  <label className="input-label" htmlFor="tipo_negocio">Sector industrial</label>
                  <select
                    id="tipo_negocio"
                    className="select register-select"
                    value={form.tipo_negocio}
                    onChange={(e) => update('tipo_negocio', e.target.value)}
                    required
                  >
                    <option value="" disabled>Selecciona la industria...</option>
                    {BUSINESS_TYPES.map((bt) => (
                      <option key={bt.value} value={bt.value}>{bt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="register-form-section">
              <p className="register-form-section-title">Tu perfil</p>
              <div className="register-form-grid-2">
                <Input
                  label="Nombre"
                  placeholder="Juan"
                  value={form.nombre}
                  onChange={(e) => update('nombre', e.target.value)}
                  required
                />
                <Input
                  label="Apellido"
                  placeholder="Pérez"
                  value={form.apellido}
                  onChange={(e) => update('apellido', e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="button" className="login-submit-btn" onClick={handleNext}>
              <span className="login-submit-logo">
                <Sparkles size={16} color="#1A1A1A" />
              </span>
              <span className="login-submit-text">Siguiente paso</span>
              <ArrowRight size={18} />
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            className="register-form-body"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="register-form-section">
              <p className="register-form-section-title">Acceso a la cuenta</p>
              <div className="register-form-fields">
                <Input
                  label="Correo electrónico"
                  type="email"
                  placeholder="nombre@empresa.com"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  icon={<Mail size={16} />}
                  required
                  autoComplete="email"
                />

                <div className="register-password-block">
                  <Input
                    label="Contraseña"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    icon={<Lock size={16} />}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  {form.password.length > 0 && (
                    <div className="register-password-meter">
                      <div
                        className="register-password-meter-fill"
                        style={{
                          width: `${Math.min(100, (form.password.length / 12) * 100)}%`,
                          background: passwordStrength === 'weak' ? 'var(--danger)' : passwordStrength === 'medium' ? 'var(--warning)' : 'var(--success)',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="register-form-actions">
              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <span className="login-submit-logo">
                      <Sparkles size={16} color="#1A1A1A" />
                    </span>
                    <span className="login-submit-text">Crear cuenta</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
              <button
                type="button"
                className="register-back-link"
                onClick={() => setStep(1)}
              >
                Volver al paso anterior
              </button>
            </div>

            <p className="register-legal">
              Al registrarte aceptas nuestros Términos y Política de Privacidad.
            </p>
          </motion.div>
        )}
      </form>

      <p className="login-form-footer">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login">Inicia sesión</Link>
      </p>
    </div>
  );
}
