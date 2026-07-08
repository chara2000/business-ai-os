import { NextResponse } from 'next/server';
import { resolveServerEmpresaId } from '@/lib/server/empresa-context';
import { getPlanDefinition } from '@/lib/billing/plans';

export async function GET() {
  const ctx = await resolveServerEmpresaId();
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    message: 'Los pagos en Colombia se procesan con Wompi. Renueva tu plan desde Configuración → Facturación.',
    provider: 'wompi',
    support: 'https://wompi.co',
  });
}
