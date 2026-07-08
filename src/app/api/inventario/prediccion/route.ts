import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveServerEmpresaId } from '@/lib/server/empresa-context';
import { computeDemandForecast } from '@/lib/forecast/demand';

export async function GET() {
  const ctx = await resolveServerEmpresaId();
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const supabase = await createClient();
  const forecasts = await computeDemandForecast(supabase, ctx.empresaId);

  const resumen = {
    productos_analizados: forecasts.length,
    reorden_urgente: forecasts.filter((f) => f.urgencia === 'alta').length,
    reorden_sugerida: forecasts.filter((f) => f.cantidad_sugerida > 0).length,
    unidades_sugeridas: forecasts.reduce((s, f) => s + f.cantidad_sugerida, 0),
  };

  return NextResponse.json({ success: true, data: forecasts, resumen });
}
