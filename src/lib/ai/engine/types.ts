import type { AIAction } from '@/lib/ai/types';

export type ActionEntity =
  | 'producto' | 'venta' | 'compra' | 'cliente' | 'proveedor'
  | 'credito' | 'gasto' | 'ingreso' | 'devolucion' | 'cotizacion'
  | 'transferencia' | 'movimiento' | 'consulta';

export type FieldSource = 'usuario' | 'inferido' | 'historial' | 'defecto' | 'pendiente';

export type EnrichedField = {
  key: string;
  label: string;
  value: unknown;
  displayValue?: string;
  source: FieldSource;
  required?: boolean;
  editable?: boolean;
};

export type ParsedIntent = {
  accion: string;
  entidad: ActionEntity;
  datos: Record<string, unknown>;
  es_consulta: boolean;
  es_confirmacion: boolean;
  es_cancelacion: boolean;
  es_correccion: boolean;
  correccion_campo?: string;
  correccion_valor?: unknown;
  mensaje_usuario?: string;
  confianza?: number;
};

export type AISessionState = {
  id: string;
  usuario_id: string;
  empresa_id: string;
  accion: string;
  entidad: ActionEntity;
  datos: Record<string, unknown>;
  campos: EnrichedField[];
  campos_pendientes: string[];
  campos_inferidos: string[];
  action: AIAction;
  expires_at: string;
  created_at: string;
};

export type ConfirmationCard = {
  titulo: string;
  subtitulo?: string;
  entidad: ActionEntity;
  accion: string;
  campos: EnrichedField[];
  campos_inferidos: string[];
  campos_pendientes: string[];
  acciones_disponibles: string[];
  session_id: string;
  listo_para_confirmar: boolean;
  /** Claves snake_case de campos pendientes (Telegram) */
  pendientes_keys?: string[];
};

export type EngineResponse = {
  tipo: 'consulta' | 'confirmacion' | 'ejecutado' | 'cancelado' | 'error' | 'mensaje';
  texto: string;
  confirmacion?: ConfirmationCard;
  resultado?: { success: boolean; message: string; data?: unknown };
  session_id?: string;
};

export const ACTION_LABELS: Record<string, string> = {
  crear_producto: 'Registrar producto',
  actualizar_producto: 'Actualizar producto',
  crear_venta: 'Registrar venta',
  crear_cliente: 'Registrar cliente',
  crear_proveedor: 'Registrar proveedor',
  registrar_abono: 'Registrar abono',
  registrar_abono_proveedor: 'Registrar pago a proveedor',
  crear_compra: 'Registrar compra',
  registrar_gasto: 'Registrar gasto',
  registrar_ingreso: 'Registrar ingreso',
  crear_devolucion: 'Registrar devolución',
  consultar_ventas_hoy: 'Consultar ventas',
  consultar_stock_bajo: 'Consultar stock bajo',
  consultar_deudores: 'Consultar deudores',
  consultar_clientes: 'Consultar clientes',
  consultar_stock: 'Consultar stock',
  consultar_resumen: 'Resumen ejecutivo',
};

export const FIELD_LABELS: Record<string, string> = {
  nombre: 'Nombre',
  cantidad: 'Cantidad',
  categoria: 'Categoría',
  categoria_id: 'Categoría',
  marca: 'Marca',
  marca_id: 'Marca',
  proveedor: 'Proveedor',
  proveedor_id: 'Proveedor',
  unidad: 'Unidad',
  iva: 'IVA',
  tasa_iva: 'IVA',
  stock_minimo: 'Stock mínimo',
  stock_actual: 'Stock',
  precio_compra: 'Precio compra',
  precio_costo: 'Precio compra',
  precio_venta: 'Precio venta',
  codigo_barras: 'Código barras',
  codigo: 'Código',
  descripcion: 'Descripción',
  bodega: 'Bodega',
  sucursal: 'Sucursal',
  cliente: 'Cliente',
  producto: 'Producto',
  monto: 'Monto',
  metodo_pago: 'Método de pago',
  notas: 'Notas',
  es_credito: 'Crédito',
  motivo: 'Motivo',
  estado: 'Estado',
  telefono: 'Teléfono',
  email: 'Email',
};
