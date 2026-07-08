import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { provisionUsuario } from '@/lib/server/auth-admin';
import type { BusinessType } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      nombre,
      apellido,
      empresa_nombre,
      tipo_negocio,
      email,
      password,
    } = body as {
      nombre?: string;
      apellido?: string;
      empresa_nombre?: string;
      tipo_negocio?: BusinessType;
      email?: string;
      password?: string;
    };

    if (!nombre?.trim() || !apellido?.trim() || !empresa_nombre?.trim() || !tipo_negocio) {
      return NextResponse.json({ error: 'Completa los datos de empresa y perfil' }, { status: 400 });
    }
    if (!email?.trim() || !password || password.length < 8) {
      return NextResponse.json({ error: 'Email y contraseña (mín. 8) son requeridos' }, { status: 400 });
    }

    const admin = await createAdminClient();

    const { data: existing } = await admin
      .from('usuarios')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 409 });
    }

    const { data: empresa, error: empresaError } = await admin
      .from('empresas')
      .insert([{
        nombre: empresa_nombre.trim(),
        tipo_negocio,
        email: email.trim().toLowerCase(),
        moneda: 'COP',
        zona_horaria: 'America/Bogota',
        plan: 'free',
        activa: true,
      }])
      .select()
      .single();

    if (empresaError || !empresa) {
      return NextResponse.json({ error: empresaError?.message ?? 'Error al crear empresa' }, { status: 500 });
    }

    try {
      const { usuario } = await provisionUsuario({
        empresa_id: empresa.id,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim(),
        password,
        rol: 'owner',
      });

      return NextResponse.json({
        success: true,
        empresa,
        usuario,
        message: 'Cuenta y empresa creadas correctamente',
      });
    } catch (err) {
      await admin.from('empresas').delete().eq('id', empresa.id);
      const msg = err instanceof Error ? err.message : 'Error al crear usuario';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error en registro';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
