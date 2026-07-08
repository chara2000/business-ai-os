import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assignableRoles, getDefaultPermisos } from '@/lib/roles';
import { provisionUsuario, verifySuperAdmin, resetUsuarioPassword } from '@/lib/server/auth-admin';
import type { UserRole } from '@/types';

export async function GET(req: NextRequest) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const empresaId = req.nextUrl.searchParams.get('empresa_id');
  if (!empresaId) {
    return NextResponse.json({ error: 'empresa_id requerido' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, apellido, email, rol, permisos, activo, created_at')
    .eq('empresa_id', empresaId)
    .neq('rol', 'super_admin')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const { empresa_id, nombre, apellido, email, password, rol, permisos } = body as {
    empresa_id?: string;
    nombre?: string;
    apellido?: string;
    email?: string;
    password?: string;
    rol?: UserRole;
    permisos?: string[];
  };

  if (!empresa_id || !nombre?.trim() || !apellido?.trim() || !email?.trim() || !password || password.length < 8) {
    return NextResponse.json({
      error: 'empresa_id, nombre, apellido, email y contraseña (mín. 8) son requeridos',
    }, { status: 400 });
  }

  const targetRol = (rol ?? 'owner') as UserRole;
  const allowed = assignableRoles('super_admin');
  if (!allowed.includes(targetRol)) {
    return NextResponse.json({ error: 'Rol no válido' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data: empresa } = await supabase.from('empresas').select('id').eq('id', empresa_id).single();
  if (!empresa) {
    return NextResponse.json({ error: 'Establecimiento no encontrado' }, { status: 404 });
  }

  try {
    const result = await provisionUsuario({
      empresa_id,
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: email.trim(),
      password,
      rol: targetRol,
      permisos: permisos?.length ? permisos : getDefaultPermisos(targetRol),
    });

    return NextResponse.json({
      success: true,
      data: result.usuario,
      credentials: result.credentials,
      message: 'Credenciales creadas correctamente',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al crear credenciales';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const { id, reset_password } = body as { id?: string; reset_password?: string };

  if (!id || !reset_password) {
    return NextResponse.json({ error: 'ID y nueva contraseña requeridos' }, { status: 400 });
  }

  try {
    const credentials = await resetUsuarioPassword(id, reset_password);
    return NextResponse.json({ success: true, credentials });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al resetear';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
