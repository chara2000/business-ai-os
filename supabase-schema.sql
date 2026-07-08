-- ====================================================================
-- BUSINESS AI OS — ESTRUCTURA MULTI-EMPRESA E IA CENTRALIZADA
-- ====================================================================

-- 1. EXTENSIONES
create extension if not exists "uuid-ossp";

-- 2. ENUMS PRINCIPALES
create type user_role as enum ('super_admin', 'owner', 'admin', 'employee');
create type business_type as enum ('ferreteria', 'restaurante', 'tienda', 'taller', 'farmacia', 'distribuidora', 'comercio', 'servicios', 'otro');
create type subscription_plan as enum ('free', 'starter', 'pro', 'enterprise');
create type credit_status as enum ('pendiente', 'parcial', 'pagado', 'vencido');
create type sale_status as enum ('completada', 'pendiente', 'cancelada', 'devuelta');
create type purchase_status as enum ('solicitud', 'cotizacion', 'orden', 'recibida', 'cancelada');
create type movement_type as enum ('entrada', 'salida', 'ajuste', 'transferencia');
create type return_status as enum ('devuelto_inventario', 'garantia', 'proveedor', 'perdida');

-- 3. TABLA EMPRESAS
create table empresas (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  tipo_negocio business_type not null default 'otro',
  logo_url text,
  telefono text,
  email text,
  direccion text,
  ciudad text,
  pais text default 'Colombia',
  moneda text default 'COP',
  zona_horaria text default 'America/Bogota',
  plan subscription_plan not null default 'free',
  plan_expira_en timestamp with time zone,
  configuracion jsonb default '{}'::jsonb,
  activa boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. TABLA USUARIOS (EXTENSION DE AUTH.USERS)
create table usuarios (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  auth_user_id uuid not null unique,
  nombre text not null,
  apellido text not null,
  email text not null,
  avatar_url text,
  rol user_role not null default 'employee',
  permisos text[] default '{}'::text[],
  activo boolean not null default true,
  telegram_chat_id text,
  whatsapp_number text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. TABLA CATEGORIAS
create table categorias (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  descripcion text,
  icono text,
  color text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. TABLA MARCAS
create table marcas (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  logo_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. TABLA PRODUCTOS
create table productos (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  codigo text not null,
  codigo_barras text,
  nombre text not null,
  descripcion text,
  categoria_id uuid references categorias(id) on delete set null,
  marca_id uuid references marcas(id) on delete set null,
  imagen_url text,
  precio_costo numeric(12,2) not null default 0.00,
  precio_venta numeric(12,2) not null default 0.00,
  precio_mayoreo numeric(12,2),
  margen numeric(5,2) not null default 0.00,
  stock_actual numeric(12,2) not null default 0.00,
  stock_minimo numeric(12,2) not null default 0.00,
  stock_maximo numeric(12,2),
  unidad text not null default 'unidad',
  activo boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(empresa_id, codigo)
);

-- 8. TABLA MOVIMIENTOS INVENTARIO (KARDEX)
create table movimientos_inventario (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete cascade,
  tipo movement_type not null,
  cantidad numeric(12,2) not null,
  stock_anterior numeric(12,2) not null,
  stock_nuevo numeric(12,2) not null,
  costo_unitario numeric(12,2),
  motivo text,
  referencia_id uuid,
  referencia_tipo text,
  usuario_id uuid not null references usuarios(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. TABLA PROVEEDORES
create table proveedores (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  contacto text,
  telefono text,
  email text,
  direccion text,
  ciudad text,
  nit text,
  calificacion numeric(3,2) default 5.00,
  tiempo_entrega_dias integer default 1,
  condiciones_pago text,
  notas text,
  activo boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. TABLA COMPRAS (ORDENES DE COMPRA)
create table ordenes_compra (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  numero text not null,
  estado purchase_status not null default 'solicitud',
  subtotal numeric(12,2) not null default 0.00,
  descuento numeric(12,2) not null default 0.00,
  impuestos numeric(12,2) not null default 0.00,
  total numeric(12,2) not null default 0.00,
  fecha_entrega_esperada timestamp with time zone,
  fecha_recepcion timestamp with time zone,
  notas text,
  usuario_id uuid not null references usuarios(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(empresa_id, numero)
);

create table items_orden_compra (
  id uuid primary key default uuid_generate_v4(),
  orden_compra_id uuid not null references ordenes_compra(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete cascade,
  cantidad numeric(12,2) not null,
  precio_unitario numeric(12,2) not null,
  subtotal numeric(12,2) not null,
  cantidad_recibida numeric(12,2) default 0.00
);

-- 11. TABLA CLIENTES
create table clientes (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  apellido text,
  telefono text,
  email text,
  direccion text,
  nit text,
  limite_credito numeric(12,2) not null default 0.00,
  saldo_pendiente numeric(12,2) not null default 0.00,
  notas text,
  activo boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 12. TABLA VENTAS
create table ventas (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  numero text not null,
  cliente_id uuid references clientes(id) on delete set null,
  estado sale_status not null default 'completada',
  subtotal numeric(12,2) not null default 0.00,
  descuento numeric(12,2) not null default 0.00,
  impuestos numeric(12,2) not null default 0.00,
  total numeric(12,2) not null default 0.00,
  metodo_pago text not null default 'efectivo',
  es_credito boolean not null default false,
  notas text,
  usuario_id uuid not null references usuarios(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(empresa_id, numero)
);

create table items_venta (
  id uuid primary key default uuid_generate_v4(),
  venta_id uuid not null references ventas(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete cascade,
  cantidad numeric(12,2) not null,
  precio_unitario numeric(12,2) not null,
  descuento numeric(12,2) not null default 0.00,
  subtotal numeric(12,2) not null
);

-- 13. TABLA CREDITOS (CARTERA FIADOS)
create table creditos (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  venta_id uuid references ventas(id) on delete set null,
  monto_total numeric(12,2) not null default 0.00,
  monto_pagado numeric(12,2) not null default 0.00,
  saldo_pendiente numeric(12,2) not null default 0.00,
  estado credit_status not null default 'pendiente',
  fecha_vencimiento timestamp with time zone not null,
  notas text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table abonos (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  credito_id uuid not null references creditos(id) on delete cascade,
  monto numeric(12,2) not null,
  metodo_pago text not null default 'efectivo',
  notas text,
  usuario_id uuid not null references usuarios(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 14. TABLA GASTOS
create table gastos (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  concepto text not null,
  categoria text not null,
  monto numeric(12,2) not null default 0.00,
  fecha timestamp with time zone not null default now(),
  metodo_pago text not null default 'efectivo',
  proveedor_id uuid references proveedores(id) on delete set null,
  comprobante_url text,
  notas text,
  usuario_id uuid not null references usuarios(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 15. TABLA DEVOLUCIONES
create table devoluciones (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  venta_id uuid references ventas(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  producto_id uuid not null references productos(id) on delete cascade,
  cantidad numeric(12,2) not null,
  motivo text not null,
  estado return_status not null default 'devuelto_inventario',
  monto_devuelto numeric(12,2) default 0.00,
  usuario_id uuid not null references usuarios(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 16. TABLA AUDITORIA LOGS
create table auditoria_logs (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete set null,
  accion text not null,
  entidad text not null,
  entidad_id uuid,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  ip_address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 17. ESTRUCTURA DE SEGURIDAD RLS (ROW LEVEL SECURITY)
alter table empresas enable row level security;
alter table usuarios enable row level security;
alter table categorias enable row level security;
alter table marcas enable row level security;
alter table productos enable row level security;
alter table movimientos_inventario enable row level security;
alter table proveedores enable row level security;
alter table ordenes_compra enable row level security;
alter table items_orden_compra enable row level security;
alter table clientes enable row level security;
alter table ventas enable row level security;
alter table items_venta enable row level security;
alter table creditos enable row level security;
alter table abonos enable row level security;
alter table gastos enable row level security;
alter table devoluciones enable row level security;
alter table auditoria_logs enable row level security;

-- 18. RLS POLICIES (AISLAMIENTO TOTAL MULTI-TENANT)
create policy empresa_tenant_isolation on empresas
  for all using (id = (select empresa_id from usuarios where auth_user_id = auth.uid()));

create policy usuarios_tenant_isolation on usuarios
  for all using (empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid()) or auth_user_id = auth.uid());

create policy categorias_tenant_isolation on categorias
  for all using (empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid()));

create policy marcas_tenant_isolation on marcas
  for all using (empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid()));

create policy productos_tenant_isolation on productos
  for all using (empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid()));

create policy movimientos_tenant_isolation on movimientos_inventario
  for all using (empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid()));

create policy proveedores_tenant_isolation on proveedores
  for all using (empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid()));

create policy ordenes_tenant_isolation on ordenes_compra
  for all using (empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid()));

create policy clientes_tenant_isolation on clientes
  for all using (empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid()));

create policy ventas_tenant_isolation on ventas
  for all using (empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid()));

create policy creditos_tenant_isolation on creditos
  for all using (empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid()));

create policy abonos_tenant_isolation on abonos
  for all using (empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid()));

create policy gastos_tenant_isolation on gastos
  for all using (empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid()));

create policy devoluciones_tenant_isolation on devoluciones
  for all using (empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid()));

create policy auditoria_tenant_isolation on auditoria_logs
  for all using (empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid()));
