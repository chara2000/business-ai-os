import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getDefaultPermisos } from '@/lib/roles';
import { provisionUsuario, verifySuperAdmin } from '@/lib/server/auth-admin';
import type { UserRole } from '@/types';

export async function GET() {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const supabase = await createAdminClient();
  const { data: empresas, error } = await supabase
    .from('empresas')
    .select(`
      *,
      usuarios(count),
      ventas(count),
      productos(count),
      clientes(count)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: empresas });
}

export async function POST(req: NextRequest) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const {
    nombre, tipo_negocio, email, telefono, direccion, ciudad, pais, moneda, plan,
    admin_nombre, admin_apellido, admin_email, admin_password, admin_rol,
  } = body;

  if (!nombre || !tipo_negocio) {
    return NextResponse.json({ error: 'Nombre y tipo de negocio son requeridos' }, { status: 400 });
  }

  const createAdmin = Boolean(admin_email?.trim() && admin_password && admin_password.length >= 8);
  if (createAdmin && (!admin_nombre?.trim() || !admin_apellido?.trim())) {
    return NextResponse.json({ error: 'Nombre y apellido del administrador son requeridos' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data: empresa, error } = await supabase
    .from('empresas')
    .insert([{
      nombre,
      tipo_negocio,
      email: email || admin_email || null,
      telefono: telefono || null,
      direccion: direccion || null,
      ciudad: ciudad || null,
      pais: pais || 'Colombia',
      moneda: moneda || 'COP',
      plan: plan || 'starter',
      zona_horaria: 'America/Bogota',
      activa: true,
    }])
    .select()
    .single();

  if (error || !empresa) {
    return NextResponse.json({ error: error?.message ?? 'Error al crear establecimiento' }, { status: 500 });
  }

  let credentials: { email: string; password: string } | null = null;
  let usuario = null;

  if (createAdmin) {
    try {
      const rol = (admin_rol === 'admin' ? 'admin' : 'owner') as UserRole;
      const result = await provisionUsuario({
        empresa_id: empresa.id,
        nombre: admin_nombre.trim(),
        apellido: admin_apellido.trim(),
        email: admin_email.trim(),
        password: admin_password,
        rol,
        permisos: getDefaultPermisos(rol),
      });
      usuario = result.usuario;
      credentials = result.credentials;
    } catch (err) {
      await supabase.from('empresas').delete().eq('id', empresa.id);
      const msg = err instanceof Error ? err.message : 'Error al crear credenciales';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    data: empresa,
    usuario,
    credentials,
    message: credentials
      ? 'Establecimiento y credenciales de acceso creados'
      : 'Establecimiento creado (sin credenciales)',
  });
}
