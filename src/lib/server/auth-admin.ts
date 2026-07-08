import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getDefaultPermisos } from '@/lib/roles';
import type { UserRole } from '@/types';

export type SessionUsuario = {
  id: string;
  empresa_id: string;
  rol: UserRole;
  email: string;
  nombre: string;
  apellido: string;
};

export async function getSessionUsuario(): Promise<SessionUsuario | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, empresa_id, rol, email, nombre, apellido')
    .eq('auth_user_id', user.id)
    .single();

  return usuario as SessionUsuario | null;
}

export async function verifySuperAdmin() {
  const usuario = await getSessionUsuario();
  if (!usuario || usuario.rol !== 'super_admin') return null;
  return usuario;
}

export async function verifyTeamManager() {
  const usuario = await getSessionUsuario();
  if (!usuario) return null;
  if (!['owner', 'admin', 'super_admin'].includes(usuario.rol)) return null;
  return usuario;
}

export interface ProvisionInput {
  empresa_id: string;
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
  permisos?: string[];
}

export async function provisionUsuario(input: ProvisionInput) {
  const admin = await createAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    email_confirm: true,
    user_metadata: {
      nombre: input.nombre,
      apellido: input.apellido,
      empresa_id: input.empresa_id,
    },
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message ?? 'No se pudo crear el usuario de acceso');
  }

  const permisos = input.permisos?.length ? input.permisos : getDefaultPermisos(input.rol);

  const { data: usuario, error: dbError } = await admin
    .from('usuarios')
    .insert([{
      empresa_id: input.empresa_id,
      auth_user_id: authData.user.id,
      nombre: input.nombre.trim(),
      apellido: input.apellido.trim(),
      email: input.email.trim().toLowerCase(),
      rol: input.rol,
      permisos,
      activo: true,
    }])
    .select('id, empresa_id, nombre, apellido, email, rol, permisos, activo, created_at')
    .single();

  if (dbError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    throw new Error(dbError.message);
  }

  return {
    usuario,
    credentials: {
      email: input.email.trim().toLowerCase(),
      password: input.password,
    },
  };
}

export async function resetUsuarioPassword(usuarioId: string, newPassword: string) {
  if (newPassword.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres');
  }

  const admin = await createAdminClient();
  const { data: usuario, error: fetchError } = await admin
    .from('usuarios')
    .select('id, auth_user_id, email, nombre, apellido, empresa_id, rol')
    .eq('id', usuarioId)
    .single();

  if (fetchError || !usuario) {
    throw new Error('Usuario no encontrado');
  }

  const { error } = await admin.auth.admin.updateUserById(usuario.auth_user_id, {
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    email: usuario.email,
    nombre: `${usuario.nombre} ${usuario.apellido}`.trim(),
    password: newPassword,
  };
}
