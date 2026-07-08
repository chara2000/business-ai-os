import type { Usuario } from '@/types';
import { getDefaultPermisos, type PermissionId } from '@/lib/roles';

export type RouteGuard = PermissionId | 'super_admin' | null;

export const ROUTE_PERMISSION_MAP: Record<string, RouteGuard> = {
  '/dashboard': null,
  '/ventas': 'ventas',
  '/devoluciones': 'ventas',
  '/inventario': 'inventario',
  '/compras': 'compras',
  '/clientes': 'clientes',
  '/proveedores': 'proveedores',
  '/creditos': 'creditos',
  '/finanzas': 'finanzas',
  '/reportes': 'reportes',
  '/ai': null,
  '/empresa': 'configuracion',
  '/configuracion': 'configuracion',
  '/auditoria': 'configuracion',
  '/equipo': 'equipo',
  '/superadmin': 'super_admin',
};

export function getEffectivePermisos(usuario: Pick<Usuario, 'rol' | 'permisos'>): string[] {
  if (usuario.permisos && usuario.permisos.length > 0) return usuario.permisos;
  return getDefaultPermisos(usuario.rol);
}

export function canAccessModule(
  usuario: Pick<Usuario, 'rol' | 'permisos'> | null,
  permissionId: PermissionId,
): boolean {
  if (!usuario) return false;
  if (usuario.rol === 'super_admin' || usuario.rol === 'owner') return true;
  return getEffectivePermisos(usuario).includes(permissionId);
}

export function getRequiredGuard(pathname: string): RouteGuard {
  if (pathname in ROUTE_PERMISSION_MAP) return ROUTE_PERMISSION_MAP[pathname];
  const match = Object.keys(ROUTE_PERMISSION_MAP)
    .filter((k) => k !== '/dashboard')
    .sort((a, b) => b.length - a.length)
    .find((k) => pathname.startsWith(k));
  return match ? ROUTE_PERMISSION_MAP[match] : null;
}

export function canAccessRoute(
  usuario: Pick<Usuario, 'rol' | 'permisos'> | null,
  pathname: string,
): boolean {
  if (!usuario) return false;

  const guard = getRequiredGuard(pathname);
  if (guard === 'super_admin') return usuario.rol === 'super_admin';
  if (!guard) return true;
  if (usuario.rol === 'super_admin') return true;

  if (guard === 'equipo') {
    return (
      canAccessModule(usuario, 'equipo') &&
      (usuario.rol === 'owner' || usuario.rol === 'admin')
    );
  }

  return canAccessModule(usuario, guard);
}

export function filterNavByPermissions<T extends { href: string; managerOnly?: boolean }>(
  items: T[],
  usuario: Pick<Usuario, 'rol' | 'permisos'> | null,
): T[] {
  return items.filter((item) => {
    if (item.managerOnly) {
      return (
        !!usuario &&
        (usuario.rol === 'owner' || usuario.rol === 'admin' || usuario.rol === 'super_admin')
      );
    }
    return canAccessRoute(usuario, item.href);
  });
}
