import { canAccessModule } from '../../permissions';
import type { PermissionId } from '../../roles';

export class PermissionManager {
  constructor(private userRole: string, private userPermissions: string[]) {}

  /**
   * Verifica si el usuario actual tiene el permiso necesario para usar una herramienta.
   */
  canExecuteTool(requiredPermission: string): boolean {
    if (!requiredPermission || requiredPermission === 'none') return true;
    
    // Convert to mock user to reuse existing logic
    const mockUser = { rol: this.userRole as any, permisos: this.userPermissions };
    return canAccessModule(mockUser, requiredPermission as PermissionId);
  }
}
