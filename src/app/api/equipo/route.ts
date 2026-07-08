import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { assignableRoles, getDefaultPermisos } from '@/lib/roles';
import { getSessionUsuario, provisionUsuario, resetUsuarioPassword } from '@/lib/server/auth-admin';
import type { UserRole } from '@/types';

export async function GET() {
  const actor = await getSessionUsuario();
  if (!actor || !['owner', 'admin'].includes(actor.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, apellido, email, rol, permisos, activo, created_at')
    .eq('empresa_id', actor.empresa_id)
    .neq('rol', 'super_admin')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const actor = await getSessionUsuario();
  if (!actor || !['owner', 'admin'].includes(actor.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const { nombre, apellido, email, password, rol, permisos } = body as {
    nombre?: string;
    apellido?: string;
    email?: string;
    password?: string;
    rol?: UserRole;
    permisos?: string[];
  };

  if (!nombre?.trim() || !apellido?.trim() || !email?.trim() || !password || password.length < 8) {
    return NextResponse.json({ error: 'Nombre, apellido, email y contraseña (mín. 8) son requeridos' }, { status: 400 });
  }

  const allowed = assignableRoles(actor.rol);
  const targetRol = (rol ?? 'employee') as UserRole;
  if (!allowed.includes(targetRol)) {
    return NextResponse.json({ error: 'No puedes asignar ese rol' }, { status: 403 });
  }

  try {
    const result = await provisionUsuario({
      empresa_id: actor.empresa_id,
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
      message: 'Usuario creado correctamente',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al crear usuario';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await getSessionUsuario();
  if (!actor || !['owner', 'admin'].includes(actor.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const { id, rol, permisos, activo, reset_password } = body as {
    id?: string;
    rol?: UserRole;
    permisos?: string[];
    activo?: boolean;
    reset_password?: string;
  };

  if (!id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
  }

  if (reset_password) {
    const admin = await createAdminClient();
    const { data: target } = await admin
      .from('usuarios')
      .select('id, empresa_id, rol')
      .eq('id', id)
      .single();

    if (!target || target.empresa_id !== actor.empresa_id) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    if (target.rol === 'owner' && actor.rol !== 'owner') {
      return NextResponse.json({ error: 'Solo el dueño puede resetear al propietario' }, { status: 403 });
    }
    try {
      const credentials = await resetUsuarioPassword(id, reset_password);
      return NextResponse.json({ success: true, credentials });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al resetear';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  const admin = await createAdminClient();
  const { data: target } = await admin
    .from('usuarios')
    .select('id, empresa_id, rol')
    .eq('id', id)
    .single();

  if (!target || target.empresa_id !== actor.empresa_id) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  if (target.rol === 'owner' && actor.rol !== 'owner') {
    return NextResponse.json({ error: 'Solo el dueño puede modificar al propietario' }, { status: 403 });
  }

  if (rol) {
    const allowed = assignableRoles(actor.rol);
    if (!allowed.includes(rol) && rol !== target.rol) {
      return NextResponse.json({ error: 'No puedes asignar ese rol' }, { status: 403 });
    }
  }

  const payload: Record<string, unknown> = {};
  if (rol) payload.rol = rol;
  if (permisos) payload.permisos = permisos;
  if (typeof activo === 'boolean') payload.activo = activo;

  const { data, error } = await admin
    .from('usuarios')
    .update(payload)
    .eq('id', id)
    .select('id, nombre, apellido, email, rol, permisos, activo')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
