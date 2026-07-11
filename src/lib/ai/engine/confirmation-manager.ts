import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConfirmationCard, EnrichedField, ActionEntity } from './types';

export class ConfirmationManager {
  constructor(private supabase: SupabaseClient, private empresaId: string) {}

  async buildConfirmation(
    toolName: string,
    args: any,
    sessionId: string
  ): Promise<{ card: ConfirmationCard; pendingKeys: string[] }> {
    const { entidad, camposRequeridos } = this.getSchemaRules(toolName);
    const pendingKeys: string[] = [];
    const campos: EnrichedField[] = [];

    for (const key of camposRequeridos) {
      const value = args[key];
      const isMissing = value === undefined || value === null || value === '';

      if (isMissing) {
        pendingKeys.push(key);
        campos.push({
          key,
          label: this.formatLabel(key),
          value: null,
          source: 'pendiente',
          required: true
        });
      } else {
        campos.push({
          key,
          label: this.formatLabel(key),
          value,
          displayValue: String(value),
          source: 'usuario',
          required: true
        });
      }
    }

    // Agregar campos opcionales provistos por el usuario
    for (const [key, value] of Object.entries(args)) {
      if (!camposRequeridos.includes(key)) {
        campos.push({
          key,
          label: this.formatLabel(key),
          value,
          displayValue: String(value),
          source: 'usuario',
          required: false
        });
      }
    }

    const listo_para_confirmar = pendingKeys.length === 0;

    const card: ConfirmationCard = {
      titulo: this.getCardTitle(toolName),
      entidad,
      accion: toolName,
      campos,
      campos_inferidos: [],
      campos_pendientes: pendingKeys,
      acciones_disponibles: ['confirm', 'edit', 'cancel'],
      session_id: sessionId,
      listo_para_confirmar,
    };

    return { card, pendingKeys };
  }

  private getSchemaRules(toolName: string): { entidad: ActionEntity; camposRequeridos: string[] } {
    switch (toolName) {
      case 'crear_producto':
        // El usuario especificamente pidio exigir categoria para mantener la DB limpia
        return { entidad: 'producto', camposRequeridos: ['nombre', 'precio_venta', 'precio_costo', 'cantidad', 'categoria'] };
      case 'crear_venta':
        return { entidad: 'venta', camposRequeridos: ['productos'] };
      case 'crear_compra':
        return { entidad: 'compra', camposRequeridos: ['proveedor', 'productos', 'metodo_pago'] };
      case 'registrar_gasto':
        return { entidad: 'gasto', camposRequeridos: ['monto', 'motivo'] };
      case 'crear_cliente':
        return { entidad: 'cliente', camposRequeridos: ['nombre', 'telefono'] };
      case 'crear_proveedor':
        return { entidad: 'proveedor', camposRequeridos: ['nombre'] };
      default:
        return { entidad: 'consulta', camposRequeridos: [] };
    }
  }

  private formatLabel(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private getCardTitle(toolName: string): string {
    const titles: Record<string, string> = {
      'crear_producto': 'Crear Producto',
      'crear_venta': 'Registrar Venta',
      'crear_compra': 'Registrar Compra',
      'registrar_gasto': 'Registrar Gasto',
      'crear_cliente': 'Nuevo Cliente',
      'crear_proveedor': 'Nuevo Proveedor'
    };
    return titles[toolName] || 'Confirmar Acción';
  }
}
