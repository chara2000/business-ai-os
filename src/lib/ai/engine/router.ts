export type AgentType = 'sales' | 'inventory' | 'financial' | 'general';

export class Router {
  static routeMessage(message: string): AgentType {
    const text = message.toLowerCase();
    
    if (text.includes('venta') || text.includes('vender') || text.includes('factura') || text.includes('cliente')) {
      return 'sales';
    }
    if (text.includes('compra') || text.includes('proveedor') || text.includes('stock') || text.includes('inventario') || text.includes('producto')) {
      return 'inventory';
    }
    if (text.includes('gasto') || text.includes('caja') || text.includes('dinero') || text.includes('finanza') || text.includes('reporte')) {
      return 'financial';
    }
    
    return 'general';
  }
}
