-- ====================================================================
-- BUSINESS AI OS — DATOS DE PRUEBA (SEED)
-- Ejecuta este script en el SQL Editor de tu dashboard Supabase
-- DESPUÉS de haber ejecutado supabase-schema.sql
-- ====================================================================

-- ============================================================
-- PASO 1: CREAR LA EMPRESA DE PRUEBA
-- ============================================================
INSERT INTO empresas (
  id, nombre, tipo_negocio, telefono, email, direccion, ciudad, moneda, plan, activa
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Ferretería Demo S.A.S.',
  'ferreteria',
  '3015550100',
  'demo@ferreteriademo.com',
  'Calle 45 #12-30',
  'Bogotá',
  'COP',
  'pro',
  true
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PASO 2: CREAR USUARIOS EN SUPABASE AUTH (MANUAL)
-- Ve a tu dashboard → Authentication → Users → "Add user"
-- Crea estos 4 usuarios con "Auto Confirm User" activado:
--
--   superadmin@demo.com   Contraseña: Demo2026!
--   owner@demo.com        Contraseña: Demo2026!
--   admin@demo.com        Contraseña: Demo2026!
--   employee@demo.com     Contraseña: Demo2026!
--
-- Luego copia sus UUIDs y reemplaza los de abajo.
-- ============================================================

-- ============================================================
-- PASO 3: REGISTRAR USUARIOS EN LA TABLA PÚBLICA
-- (Reemplaza auth_user_id con los UUIDs reales de Supabase Auth)
-- ============================================================

-- SUPER ADMIN — Control total del sistema
INSERT INTO usuarios (
  id, empresa_id, auth_user_id, nombre, apellido, email, rol, activo
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Super', 'Administrador', 'superadmin@demo.com',
  'super_admin', true
) ON CONFLICT (auth_user_id) DO NOTHING;

-- OWNER — Dueño de la empresa
INSERT INTO usuarios (
  id, empresa_id, auth_user_id, nombre, apellido, email, rol, activo
) VALUES (
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Juan', 'Propietario', 'owner@demo.com',
  'owner', true
) ON CONFLICT (auth_user_id) DO NOTHING;

-- ADMIN — Administrador operativo
INSERT INTO usuarios (
  id, empresa_id, auth_user_id, nombre, apellido, email, rol, activo
) VALUES (
  '10000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'Carlos', 'Administrador', 'admin@demo.com',
  'admin', true
) ON CONFLICT (auth_user_id) DO NOTHING;

-- EMPLOYEE — Vendedor / Cajero
INSERT INTO usuarios (
  id, empresa_id, auth_user_id, nombre, apellido, email, rol, activo
) VALUES (
  '10000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'María', 'Empleada', 'employee@demo.com',
  'employee', true
) ON CONFLICT (auth_user_id) DO NOTHING;

-- ============================================================
-- PASO 4: CLIENTES DE PRUEBA
-- ============================================================
INSERT INTO clientes (empresa_id, nombre, telefono, email, direccion, activo, limite_credito, saldo_pendiente) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Carlos Torres',   '3001112233', 'carlos@email.com', 'Calle 100, Bogotá',       true, 1000000, 780000),
  ('00000000-0000-0000-0000-000000000001', 'Ana Martínez',    '3002223344', 'ana@email.com',    'Carrera 45, Medellín',     true, 500000,  150000),
  ('00000000-0000-0000-0000-000000000001', 'María López',     '3003334455', 'maria@email.com',  'Avenida 15, Cali',         true, 800000,  0),
  ('00000000-0000-0000-0000-000000000001', 'Luis Herrera',    '3004445566', 'luis@email.com',   'Calle 72, Barranquilla', true, 600000,  250000),
  ('00000000-0000-0000-0000-000000000001', 'Sofía Rodríguez', '3005556677', 'sofia@email.com',  'Carrera 15, Bogotá',       true, 400000,  0),
  ('00000000-0000-0000-0000-000000000001', 'Pedro Gómez',     '3006667788', 'pedro@email.com',  'Calle 5, Bucaramanga',  true, 700000,  0)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PASO 5: PROVEEDORES DE PRUEBA
-- ============================================================
INSERT INTO proveedores (empresa_id, nombre, contacto, telefono, email, ciudad, nit, calificacion, tiempo_entrega_dias, condiciones_pago, activo) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Energía Colombia SAS',    'Ricardo Mora',   '6015550201', 'ventas@energiacolombia.com',  'Bogotá',        '900123456-1', 4.8, 2, '30 días', true),
  ('00000000-0000-0000-0000-000000000001', 'Tornillos del Norte Ltda','Patricia Reyes', '6045550202', 'contacto@tornillosnorte.com', 'Medellín',      '900654321-2', 4.5, 3, 'Contado', true),
  ('00000000-0000-0000-0000-000000000001', 'Pinturas del Llano',      'Carlos Vargas',  '6085550203', null,                          'Villavicencio', '800234567-3', 3.9, 5, '15 días', true),
  ('00000000-0000-0000-0000-000000000001', 'Ferrepro Distribuciones', 'Elena Torres',   '6055550204', 'elena@ferrepro.com',           'Cali',          '900789012-4', 4.2, 4, '45 días', false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PASO 5.5: CATEGORÍAS DE PRUEBA
-- ============================================================
INSERT INTO categorias (id, empresa_id, nombre, descripcion) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Eléctrico', 'Materiales eléctricos'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Ferretería', 'Artículos de ferretería general'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Pinturas', 'Pinturas y acabados'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Herramientas', 'Herramientas manuales y eléctricas'),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Plomería', 'Tubos y accesorios de plomería')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PASO 6: PRODUCTOS EN INVENTARIO
-- ============================================================
INSERT INTO productos (empresa_id, nombre, descripcion, codigo, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, unidad, activo) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Batería Bosch AA x4',     'Pack 4 pilas alcalinas',     'BAT-AA-04',  '20000000-0000-0000-0000-000000000001',   5200,  14000, 48,  10,  'pack',   true),
  ('00000000-0000-0000-0000-000000000001', 'Cable Eléctrico 12AWG',   'Cable por metro calibre 12', 'CAB-12-MT',  '20000000-0000-0000-0000-000000000001',   8500,  35000, 120, 20,  'metro',  true),
  ('00000000-0000-0000-0000-000000000001', 'Tornillo Galvanizado M8', 'Tornillo acero galvanizado', 'TOR-M8-GV',  '20000000-0000-0000-0000-000000000002',   150,   750,   500, 100, 'unidad', true),
  ('00000000-0000-0000-0000-000000000001', 'Pintura Vinílica 4L',     'Pintura interior blanca',    'PIN-VIN-4L', '20000000-0000-0000-0000-000000000003',   28000, 52000, 35,  5,   'galón',  true),
  ('00000000-0000-0000-0000-000000000001', 'Martillo Stanley 16oz',   'Martillo de carpintero',     'MAR-STA-16', '20000000-0000-0000-0000-000000000004',   18000, 45000, 22,  5,   'unidad', true),
  ('00000000-0000-0000-0000-000000000001', 'Tubo PVC 1/2" x 6m',     'Tubería presión agua',       'TUB-PVC-12', '20000000-0000-0000-0000-000000000005',   9500,  22000, 60,  15,  'unidad', true),
  ('00000000-0000-0000-0000-000000000001', 'Llave Ajustable 10"',     'Llave inglesa cromada',      'LLA-ADJ-10', '20000000-0000-0000-0000-000000000004',   15000, 38000, 18,  5,   'unidad', true),
  ('00000000-0000-0000-0000-000000000001', 'Cinta Métrica 5m',        'Flexómetro magnético',       'CIN-MET-5M', '20000000-0000-0000-0000-000000000004',   6000,  18000, 3,   5,   'unidad', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PASO 7: VENTAS DE PRUEBA
-- ============================================================
INSERT INTO ventas (empresa_id, numero, total, subtotal, impuestos, metodo_pago, estado, usuario_id) VALUES
  ('00000000-0000-0000-0000-000000000001', 'V-0001', 185000,  155462, 29538,  'efectivo',      'completada', '10000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000001', 'V-0002', 490000,  411765, 78235,  'transferencia', 'completada', '10000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000001', 'V-0003', 780000,  655462, 124538, 'credito',       'pendiente',  '10000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000001', 'V-0004', 210000,  176471, 33529,  'tarjeta',       'completada', '10000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000001', 'V-0005', 32000,   26891,  5109,   'efectivo',      'completada', '10000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PASO 8: GASTOS DE PRUEBA
-- ============================================================
INSERT INTO gastos (empresa_id, concepto, monto, categoria, metodo_pago, usuario_id) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Pago arriendo bodega',     1800000, 'Arriendo',   'transferencia', '10000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000001', 'Servicios públicos julio',  320000, 'Servicios',  'transferencia', '10000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000001', 'Nómina empleados',         2500000, 'Nómina',     'transferencia', '10000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000001', 'Transporte mercancía',       85000, 'Transporte', 'efectivo',      '10000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000001', 'Papelería y útiles',         45000, 'Operativo',  'efectivo',      '10000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PASO 9: CRÉDITOS DE PRUEBA
-- ============================================================
-- Primero obtén los IDs de los clientes insertados arriba con:
-- SELECT id, nombre FROM clientes WHERE empresa_id = '00000000-0000-0000-0000-000000000001';
-- Luego ajusta los cliente_id en los inserts de abajo.
-- Por facilidad, aquí van con subconsultas:

INSERT INTO creditos (empresa_id, cliente_id, monto_total, monto_pagado, saldo_pendiente, estado, fecha_vencimiento)
SELECT
  '00000000-0000-0000-0000-000000000001',
  id,
  780000, 0, 780000, 'pendiente',
  now() + interval '30 days'
FROM clientes
WHERE empresa_id = '00000000-0000-0000-0000-000000000001' AND nombre = 'Carlos Torres'
ON CONFLICT DO NOTHING;

INSERT INTO creditos (empresa_id, cliente_id, monto_total, monto_pagado, saldo_pendiente, estado, fecha_vencimiento)
SELECT
  '00000000-0000-0000-0000-000000000001',
  id,
  300000, 150000, 150000, 'parcial',
  now() + interval '15 days'
FROM clientes
WHERE empresa_id = '00000000-0000-0000-0000-000000000001' AND nombre = 'Ana Martínez'
ON CONFLICT DO NOTHING;

INSERT INTO creditos (empresa_id, cliente_id, monto_total, monto_pagado, saldo_pendiente, estado, fecha_vencimiento)
SELECT
  '00000000-0000-0000-0000-000000000001',
  id,
  250000, 0, 250000, 'vencido',
  now() - interval '10 days'
FROM clientes
WHERE empresa_id = '00000000-0000-0000-0000-000000000001' AND nombre = 'Luis Herrera'
ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================
SELECT 'Empresas'    as tabla, count(*) as registros FROM empresas    WHERE id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Usuarios',   count(*) FROM usuarios   WHERE empresa_id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Clientes',   count(*) FROM clientes   WHERE empresa_id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Productos',  count(*) FROM productos  WHERE empresa_id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Ventas',     count(*) FROM ventas     WHERE empresa_id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Gastos',     count(*) FROM gastos     WHERE empresa_id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Proveedores',count(*) FROM proveedores WHERE empresa_id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Créditos',   count(*) FROM creditos   WHERE empresa_id = '00000000-0000-0000-0000-000000000001';
