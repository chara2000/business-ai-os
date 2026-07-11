export interface PlanStep {
  step: number;
  action: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export class Planner {
  private plan: PlanStep[] = [];

  generatePlanningPrompt(): string {
    return `
Antes de usar herramientas o responder, debes estructurar mentalmente un plan de acción.
Piensa paso a paso.
Por ejemplo, si te piden "Vender 2 llantas a Carlos", tu plan mental debe ser:
1. crear_venta(cliente: "Carlos", productos: [{nombre: "llanta", cantidad: 2}])

IMPORTANTE: 
- NO uses la herramienta search_products antes de registrar una venta o compra. Las herramientas crear_venta y crear_compra ya buscan el producto automáticamente usando inteligencia artificial tolerante a errores ortográficos. Llama directamente a crear_venta o crear_compra con lo que el usuario te dicte.
- Si el usuario registra un nuevo producto e indica un PROVEEDOR, usa SIEMPRE 'crear_compra' (y no crear_producto), ya que crear_compra registrará el inventario, el producto y la cuenta por pagar al proveedor automáticamente.
- Si el usuario menciona una categoría o marca, inclúyelas como parámetros 'categoria' y 'marca' en crear_producto o crear_compra para que se autocompleten y no tengas que pedirlas de vuelta.
Usa las herramientas secuencialmente para cumplir tu plan. Si descubres que falta información en un paso, pide los datos al usuario.
`;
  }

  setPlan(steps: Partial<PlanStep>[]) {
    this.plan = steps.map((s, i) => ({
      step: s.step || i + 1,
      action: s.action || 'unknown',
      description: s.description || '',
      status: s.status || 'pending'
    }));
  }

  getPlan() {
    return this.plan;
  }
}
