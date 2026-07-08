import { cookies } from 'next/headers';
import { getSessionUsuario, type SessionUsuario } from '@/lib/server/auth-admin';

export async function resolveServerEmpresaId(): Promise<{
  usuario: SessionUsuario;
  empresaId: string;
} | null> {
  const usuario = await getSessionUsuario();
  if (!usuario) return null;

  if (usuario.rol === 'super_admin') {
    const cookieStore = await cookies();
    const impersonateId = cookieStore.get('impersonate_empresa_id')?.value;
    if (!impersonateId) return null;
    return { usuario, empresaId: impersonateId };
  }

  return { usuario, empresaId: usuario.empresa_id };
}
