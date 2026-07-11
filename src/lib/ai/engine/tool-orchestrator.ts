import type { SupabaseClient } from '@supabase/supabase-js';
import { executeAIAction } from '../executor';
import { PermissionManager } from './permission-manager';
import { AuditManager } from './audit-manager';
import { ToolCache } from './tool-cache';

export class ToolOrchestrator {
  private permissionManager: PermissionManager;
  private auditManager: AuditManager;
  private cache: ToolCache;

  constructor(
    private supabase: SupabaseClient,
    private empresaId: string,
    private usuarioId: string,
    userRole: string,
    userPermissions: string[]
  ) {
    this.permissionManager = new PermissionManager(userRole, userPermissions);
    this.auditManager = new AuditManager(supabase);
    this.cache = new ToolCache();
  }

  async executeTool(toolName: string, args: any, originalPrompt?: string): Promise<any> {
    const startTime = Date.now();
    let success = false;
    let resultData: any = null;
    let errorMessage: string | undefined;

    try {
      // 1. Permission Check (simplificado, mapeo básico por nombre de herramienta)
      const requiredPerm = this.mapToolToPermission(toolName);
      if (!this.permissionManager.canExecuteTool(requiredPerm)) {
        throw new Error(`No tienes permisos suficientes (${requiredPerm}) para ejecutar ${toolName}`);
      }

      // 2. Cache Check (sólo para consultas seguras)
      if (toolName.startsWith('consultar_') || toolName.startsWith('search_')) {
        const cacheKey = this.cache.generateKey(toolName, args);
        const cached = this.cache.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // 3. Execution
      // Map to legacy executor for now, but in future, call specific agents
      const result = await executeAIAction(this.supabase, this.empresaId, this.usuarioId, {
        accion: toolName,
        datos: args
      });

      success = result.success;
      resultData = result;

      if (!success) {
        errorMessage = result.message;
      } else if (toolName.startsWith('consultar_') || toolName.startsWith('search_')) {
        const cacheKey = this.cache.generateKey(toolName, args);
        this.cache.set(cacheKey, resultData);
      }

      return resultData;

    } catch (error: any) {
      success = false;
      errorMessage = error.message;
      throw error;
    } finally {
      const durationMs = Date.now() - startTime;
      
      // 4. Audit Log
      await this.auditManager.logAction({
        empresaId: this.empresaId,
        usuarioId: this.usuarioId,
        prompt: originalPrompt,
        toolUsed: toolName,
        arguments: args,
        success,
        error: errorMessage,
        durationMs
      });
    }
  }

  private mapToolToPermission(toolName: string): string {
    if (toolName.includes('venta')) return 'ventas';
    if (toolName.includes('compra') || toolName.includes('proveedor')) return 'compras';
    if (toolName.includes('producto') || toolName.includes('inventario') || toolName.includes('stock')) return 'inventario';
    if (toolName.includes('gasto') || toolName.includes('ingreso') || toolName.includes('credito') || toolName.includes('pago')) return 'finanzas';
    if (toolName.includes('cliente')) return 'clientes';
    return 'none';
  }
}
