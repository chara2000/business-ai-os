import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConfirmationCard, EnrichedField, ActionEntity } from './types';

export class ConfirmationManager {
  constructor(private supabase: SupabaseClient, private empresaId: string) {}

  async buildConfirmation(
    toolName: string,
    args: any,
    sessionId: string
  ): Promise<{ card: ConfirmationCard; pendingKeys: string[] }> {
    if ((toolName === 'crear_producto' || toolName === 'crear_compra') && !args.codigo) {
      const randomId = Math.floor(1000 + Math.random() * 9000);
      args.codigo = `PRD-${randomId}`;
    }

    // Para crear_compra: inyectar codigo y precio_venta dentro de productos[0] tambien
    // para que el executor pueda leerlos sin importar desde donde los pasa el LLM
    if (toolName === 'crear_compra' && Array.isArray(args.productos) && args.productos.length > 0) {
      const p0 = args.productos[0];
      if (!p0.codigo) p0.codigo = args.codigo;
      // Si precio_venta viene a nivel raiz, injectarlo en el producto tambien
      if (!p0.precio_venta && args.precio_venta) p0.precio_venta = args.precio_venta;
      // Lo mismo con categoria y marca
      if (!p0.categoria && args.categoria) p0.categoria = args.categoria;
      if (!p0.marca && args.marca) p0.marca = args.marca;
    }

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
        let displayValueStr = String(value);
        if (Array.isArray(value)) {
          displayValueStr = value.map(v => typeof v === 'object' && v !== null ? (v.nombre || v.producto || JSON.stringify(v)) + (v.cantidad ? ` (x${v.cantidad})` : '') : String(v)).join(', ');
        } else if (typeof value === 'object' && value !== null) {
          displayValueStr = JSON.stringify(value);
        }

        campos.push({
          key,
          label: this.formatLabel(key),
          value,
          displayValue: displayValueStr,
          source: 'usuario',
          required: true
        });
      }
    }

    // Agregar campos opcionales provistos por el usuario
    for (const [key, value] of Object.entries(args)) {
      if (!camposRequeridos.includes(key)) {
        let displayValueStr = String(value);
        if (Array.isArray(value)) {
          displayValueStr = value.map(v => typeof v === 'object' && v !== null ? (v.nombre || v.producto || JSON.stringify(v)) + (v.cantidad ? ` (x${v.cantidad})` : '') : String(v)).join(', ');
        } else if (typeof value === 'object' && value !== null) {
          displayValueStr = JSON.stringify(value);
        }

        campos.push({
          key,
          label: this.formatLabel(key),
          value,
          displayValue: displayValueStr,
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
        // El usuario pidió inferirla y no exigir que la dicten
        return { entidad: 'producto', camposRequeridos: ['nombre', 'precio_venta', 'precio_costo', 'cantidad'] };
      case 'crear_venta':
        return { entidad: 'venta', camposRequeridos: ['productos'] };
      case 'crear_compra':
        return { entidad: 'compra', camposRequeridos: ['proveedor', 'productos'] };
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
