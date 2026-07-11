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
1. search_clients("Carlos")
2. search_products("llanta")
3. crear_venta(cliente_id, productos...)
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
