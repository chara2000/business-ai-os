// ============================================
// BUSINESS AI OS — TypeScript Types
// ============================================

export type UserRole = 'super_admin' | 'owner' | 'admin' | 'employee';

export type BusinessType =
  | 'ferreteria'
  | 'restaurante'
  | 'tienda'
  | 'taller'
  | 'farmacia'
  | 'distribuidora'
  | 'comercio'
  | 'servicios'
  | 'otro';

export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'enterprise';

export type CreditStatus = 'pendiente' | 'parcial' | 'pagado' | 'vencido';

export type SaleStatus = 'completada' | 'pendiente' | 'cancelada' | 'devuelta';

export type PurchaseStatus = 'solicitud' | 'cotizacion' | 'orden' | 'recibida' | 'cancelada';

export type MovementType = 'entrada' | 'salida' | 'ajuste' | 'transferencia';

export type ReturnStatus = 'devuelto_inventario' | 'garantia' | 'proveedor' | 'perdida';

export type SupplierPayableStatus = CreditStatus;

// ============================================
// DATABASE ENTITIES
// ============================================

export interface Empresa {
  id: string;
  nombre: string;
  tipo_negocio: BusinessType;
  logo_url?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  ciudad?: string;
  pais?: string;
  moneda: string;
  zona_horaria: string;
  plan: SubscriptionPlan;
  plan_expira_en?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  billing_status?: string;
  configuracion?: Record<string, unknown>;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface Usuario {
  id: string;
  empresa_id: string;
  auth_user_id: string;
  nombre: string;
  apellido: string;
  email: string;
  avatar_url?: string;
  rol: UserRole;
  permisos?: string[];
  activo: boolean;
  telegram_chat_id?: string;
  whatsapp_number?: string;
  created_at: string;
  updated_at: string;
}

export interface Categoria {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion?: string;
  icono?: string;
  color?: string;
  created_at: string;
}

export interface Marca {
  id: string;
  empresa_id: string;
  nombre: string;
  logo_url?: string;
  created_at: string;
}

export interface Producto {
  id: string;
  empresa_id: string;
  codigo: string;
  codigo_barras?: string;
  nombre: string;
  descripcion?: string;
  categoria_id?: string;
  marca_id?: string;
  imagen_url?: string;
  precio_costo: number;
  precio_venta: number;
  precio_mayoreo?: number;
  margen: number;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo?: number;
  unidad: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  // Relations
  categoria?: Categoria;
  marca?: Marca;
}

export interface MovimientoInventario {
  id: string;
  empresa_id: string;
  producto_id: string;
  tipo: MovementType;
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  costo_unitario?: number;
  motivo?: string;
  referencia_id?: string;
  referencia_tipo?: string;
  usuario_id: string;
  created_at: string;
  // Relations
  producto?: Producto;
  usuario?: Usuario;
}

export interface Proveedor {
  id: string;
  empresa_id: string;
  nombre: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  ciudad?: string;
  nit?: string;
  calificacion?: number;
  tiempo_entrega_dias?: number;
  condiciones_pago?: string;
  notas?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrdenCompra {
  id: string;
  empresa_id: string;
  proveedor_id: string;
  numero: string;
  estado: PurchaseStatus;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total: number;
  fecha_entrega_esperada?: string;
  fecha_recepcion?: string;
  notas?: string;
  usuario_id: string;
  created_at: string;
  updated_at: string;
  // Relations
  proveedor?: Proveedor;
  items?: ItemOrdenCompra[];
}

export interface ItemOrdenCompra {
  id: string;
  orden_compra_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  cantidad_recibida?: number;
  // Relations
  producto?: Producto;
}

export interface Cliente {
  id: string;
  empresa_id: string;
  nombre: string;
  apellido?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  nit?: string;
  limite_credito?: number;
  saldo_pendiente?: number;
  notas?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Venta {
  id: string;
  empresa_id: string;
  numero: string;
  cliente_id?: string;
  estado: SaleStatus;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total: number;
  metodo_pago: string;
  es_credito: boolean;
  notas?: string;
  usuario_id: string;
  created_at: string;
  updated_at: string;
  // Relations
  cliente?: Cliente;
  items?: ItemVenta[];
  items_venta?: ItemVenta[];
}

export interface ItemVenta {
  id: string;
  venta_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
  // Relations
  producto?: Producto;
}

export interface Credito {
  id: string;
  empresa_id: string;
  cliente_id: string;
  venta_id?: string;
  monto_total: number;
  monto_pagado: number;
  saldo_pendiente: number;
  estado: CreditStatus;
  fecha_vencimiento: string;
  notas?: string;
  created_at: string;
  updated_at: string;
  // Relations
  cliente?: Cliente;
  venta?: Venta;
  abonos?: Abono[];
}

export interface Abono {
  id: string;
  empresa_id: string;
  credito_id: string;
  monto: number;
  metodo_pago: string;
  notas?: string;
  usuario_id: string;
  created_at: string;
}

export interface AbonoProveedor {
  id: string;
  empresa_id: string;
  cuenta_por_pagar_id: string;
  monto: number;
  metodo_pago: string;
  notas?: string;
  usuario_id?: string;
  created_at: string;
}

export interface Gasto {
  id: string;
  empresa_id: string;
  concepto: string;
  categoria: string;
  monto: number;
  fecha: string;
  metodo_pago: string;
  proveedor_id?: string;
  comprobante_url?: string;
  notas?: string;
  usuario_id: string;
  created_at: string;
}

export interface CuentaPorPagarProveedor {
  id: string;
  empresa_id: string;
  proveedor_id: string;
  orden_compra_id?: string;
  monto_total: number;
  monto_pagado: number;
  saldo_pendiente: number;
  estado: SupplierPayableStatus;
  fecha_vencimiento: string;
  notas?: string;
  created_at: string;
  updated_at: string;
  proveedor?: Proveedor;
}

export interface Devolucion {
  id: string;
  empresa_id: string;
  venta_id?: string;
  cliente_id?: string;
  producto_id: string;
  cantidad: number;
  motivo: string;
  estado: ReturnStatus;
  monto_devuelto?: number;
  usuario_id: string;
  created_at: string;
  // Relations
  producto?: Producto;
  cliente?: Cliente;
}

export interface AuditoriaLog {
  id: string;
  empresa_id: string;
  usuario_id: string;
  accion: string;
  entidad: string;
  entidad_id?: string;
  datos_anteriores?: Record<string, unknown>;
  datos_nuevos?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

// ============================================
// AI TYPES
// ============================================

export interface AIAction {
  accion: string;
  entidad?: string;
  datos?: Record<string, unknown>;
  filtros?: Record<string, unknown>;
  confirmacion_requerida?: boolean;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  accion?: AIAction;
  confirmacion?: import('@/lib/ai/engine/types').ConfirmationCard;
  session_id?: string;
  timestamp: Date;
}

export interface AIContext {
  empresa: Partial<Empresa>;
  usuario: Partial<Usuario>;
  stats?: DashboardStats;
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardStats {
  ventas_hoy: number;
  ventas_mes: number;
  clientes_total: number;
  productos_total: number;
  productos_bajo_stock: number;
  creditos_pendientes: number;
  cartera_total: number;
  gastos_mes: number;
  ganancia_mes: number;
  ordenes_pendientes: number;
}

export interface ChartData {
  name: string;
  valor: number;
  meta?: number;
  anterior?: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ============================================
// FORM TYPES
// ============================================

export interface ProductoForm {
  codigo: string;
  codigo_barras?: string;
  nombre: string;
  descripcion?: string;
  categoria_id?: string;
  marca_id?: string;
  precio_costo: number;
  precio_venta: number;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo?: number;
  unidad: string;
}

export interface VentaForm {
  cliente_id?: string;
  items: { producto_id: string; cantidad: number; precio_unitario: number; descuento: number }[];
  descuento: number;
  metodo_pago: string;
  es_credito: boolean;
  fecha_vencimiento_credito?: string;
  notas?: string;
}

// ============================================
// BOT TYPES
// ============================================

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string; first_name?: string; username?: string };
    from?: { id: number; first_name: string; username?: string };
    text?: string;
    voice?: { file_id: string; duration: number; mime_type: string };
    date: number;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string };
    message?: { chat: { id: number } };
    data?: string;
  };
}

export interface WhatsAppMessage {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        statuses?: Array<{ id: string; status: string }>;
        messages?: Array<{
          id: string;
          from: string;
          type: string;
          timestamp: string;
          text?: { body: string };
          audio?: { id: string; mime_type: string };
        }>;
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
      };
      field: string;
    }>;
  }>;
}
