import type { UserRole } from '@/types';

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  owner: 'Dueño / Propietario',
  admin: 'Administrador',
  employee: 'Empleado',
};

/** Roles que un dueño puede asignar a su equipo */
export const TEAM_ROLES_OWNER: UserRole[] = ['admin', 'employee'];

/** Roles que un admin puede asignar */
export const TEAM_ROLES_ADMIN: UserRole[] = ['employee'];

export const ALL_PERMISSIONS = [
  { id: 'ventas', label: 'Ventas' },
  { id: 'inventario', label: 'Inventario' },
  { id: 'compras', label: 'Compras' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'creditos', label: 'Créditos' },
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'configuracion', label: 'Configuración' },
  { id: 'equipo', label: 'Gestión de equipo' },
] as const;

export type PermissionId = (typeof ALL_PERMISSIONS)[number]['id'];

const OWNER_PERMS = ALL_PERMISSIONS.map((p) => p.id);
const ADMIN_PERMS = ALL_PERMISSIONS.filter((p) => p.id !== 'equipo').map((p) => p.id);
const EMPLOYEE_DEFAULT = ['ventas', 'inventario', 'clientes'] as PermissionId[];

export function getDefaultPermisos(rol: UserRole): string[] {
  switch (rol) {
    case 'owner':
    case 'super_admin':
      return [...OWNER_PERMS];
    case 'admin':
      return [...ADMIN_PERMS, 'equipo'];
    case 'employee':
      return [...EMPLOYEE_DEFAULT];
    default:
      return [];
  }
}

export function canManageTeam(rol?: UserRole | null) {
  return rol === 'owner' || rol === 'admin' || rol === 'super_admin';
}

export function assignableRoles(actorRol?: UserRole | null): UserRole[] {
  if (actorRol === 'super_admin') return ['owner', 'admin', 'employee'];
  if (actorRol === 'owner') return TEAM_ROLES_OWNER;
  if (actorRol === 'admin') return TEAM_ROLES_ADMIN;
  return [];
}
