import { type AITool } from '../provider';

export const AI_TOOLS: AITool[] = [
  {
    type: 'function',
    function: {
      name: 'crear_venta',
      description: 'Registra una venta en el sistema descontando del inventario. Si la venta es a crédito, el sistema asume que no está pagada.',
      parameters: {
        type: 'object',
        properties: {
          cliente: { type: 'string', description: 'Nombre del cliente (ej. Juan Pérez)' },
          productos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nombre: { type: 'string', description: 'Nombre del producto o servicio' },
                cantidad: { type: 'number', description: 'Cantidad vendida' },
                precio: { type: 'number', description: 'Precio unitario cobrado al cliente. Opcional, si no se envía se usa el precio del catálogo.' }
              },
              required: ['nombre', 'cantidad']
            }
          },
          es_credito: { type: 'boolean', description: 'True si es fiado, a crédito, o pendiente de pago' },
          metodo_pago: { type: 'string', description: 'Método de pago: efectivo, transferencia, nequi, daviplata, tarjeta' },
          descuento: { type: 'number', description: 'Monto de descuento aplicado a la venta total' }
        },
        required: ['productos']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'crear_compra',
      description: 'Registra una compra de mercancía, aumentando el inventario y creando una cuenta por pagar si es a crédito.',
      parameters: {
        type: 'object',
        properties: {
          proveedor: { type: 'string', description: 'Nombre del proveedor' },
          productos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nombre: { type: 'string', description: 'Nombre del producto' },
                cantidad: { type: 'number', description: 'Cantidad comprada' },
                costo_unitario: { type: 'number', description: 'Costo unitario de compra' },
                precio_venta: { type: 'number', description: 'Nuevo precio de venta al público (opcional)' },
                categoria: { type: 'string', description: 'Categoría del producto (infiere si el usuario la menciona)' },
                marca: { type: 'string', description: 'Marca del producto (infiere si el usuario la menciona)' }
              },
              required: ['nombre', 'cantidad', 'costo_unitario']
            }
          },
          es_credito: { type: 'boolean', description: 'True si se le debe al proveedor (compra a crédito)' },
          metodo_pago: { type: 'string', description: 'Método de pago usado' }
        },
        required: ['productos']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'crear_producto',
      description: 'Crea un nuevo producto en el catálogo sin registrar una compra formal.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del producto' },
          precio_venta: { type: 'number', description: 'Precio de venta al público' },
          precio_costo: { type: 'number', description: 'Precio de costo del producto' },
          cantidad: { type: 'number', description: 'Stock inicial' },
          categoria: { type: 'string', description: 'Categoría del producto' },
          marca: { type: 'string', description: 'Marca del producto' }
        },
        required: ['nombre', 'precio_venta']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'actualizar_producto',
      description: 'Actualiza el precio o el stock de un producto existente.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del producto a actualizar' },
          precio_venta: { type: 'number', description: 'Nuevo precio de venta' },
          precio_costo: { type: 'number', description: 'Nuevo precio de costo' },
          cantidad: { type: 'number', description: 'Cantidad a agregar al stock actual (usa negativo para restar)' }
        },
        required: ['nombre']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'registrar_pago_credito',
      description: 'Abona o paga totalmente la deuda de un cliente (cartera).',
      parameters: {
        type: 'object',
        properties: {
          cliente: { type: 'string', description: 'Nombre del cliente que está pagando' },
          monto: { type: 'number', description: 'Monto del abono' },
          metodo_pago: { type: 'string', description: 'Método de pago (ej. transferencia, efectivo)' }
        },
        required: ['cliente', 'monto']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'registrar_gasto',
      description: 'Registra un gasto operativo del negocio (ej. servicios, arriendo, nómina).',
      parameters: {
        type: 'object',
        properties: {
          descripcion: { type: 'string', description: 'Descripción o concepto del gasto' },
          monto: { type: 'number', description: 'Valor del gasto' },
          categoria: { type: 'string', description: 'Categoría del gasto (ej. servicios, nómina, insumos)' }
        },
        required: ['descripcion', 'monto']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Busca productos en la base de datos por nombre o categoría y devuelve su stock y precio.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término de búsqueda (ej. "llanta", "casco")' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'financial_dashboard',
      description: 'Obtiene un resumen de ventas, gastos y utilidades de un rango de tiempo específico.',
      parameters: {
        type: 'object',
        properties: {
          periodo: { type: 'string', description: 'Periodo a consultar (ej. "hoy", "este_mes", "semana_pasada")' }
        },
        required: ['periodo']
      }
    }
  }
];
