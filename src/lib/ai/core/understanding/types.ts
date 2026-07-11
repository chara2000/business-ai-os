export type EntityType = 'producto' | 'cliente' | 'proveedor' | 'empleado' | 'marca' | 'categoria' | 'sucursal' | 'vehiculo' | 'direccion' | 'correo' | 'telefono';

export interface ResolvedEntity {
  id: string | null;
  name: string;
  type: EntityType;
  confidence: number;
  originalText: string;
  normalizedText: string;
  metadata?: Record<string, any>;
  sources: ('exact' | 'alias' | 'fuzzy' | 'embedding' | 'llm' | 'unknown')[];
}

export interface AliasRecord {
  id: string;
  company_id: string;
  entity_type: EntityType;
  entity_id: string;
  alias: string;
  confidence: number;
  created_at: string;
}

export interface EntityCatalog {
  productos: { id: string, name: string, metadata?: any }[];
  clientes: { id: string, name: string, metadata?: any }[];
  proveedores: { id: string, name: string, metadata?: any }[];
}
