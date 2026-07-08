import type { SupabaseClient } from '@supabase/supabase-js';

export type AppNotification = {
  id: string;
  type: 'stock_bajo' | 'credito' | 'venta' | 'info';
  title: string;
  message: string;
  href?: string;
  created_at: string;
};

export async function fetchAppNotifications(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<AppNotification[]> {
  const notifications: AppNotification[] = [];
  const now = new Date().toISOString();

  const [{ data: stockBajo }, { data: creditos }, { data: ventasHoy }] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, stock_actual, stock_minimo')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .limit(50),
    supabase
      .from('creditos')
      .select('id, saldo_pendiente, clientes(nombre)')
      .eq('empresa_id', empresaId)
      .in('estado', ['pendiente', 'parcial', 'vencido'])
      .gt('saldo_pendiente', 0)
      .limit(10),
    supabase
      .from('ventas')
      .select('id, total, numero')
      .eq('empresa_id', empresaId)
      .gte('created_at', `${now.split('T')[0]}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  (stockBajo ?? [])
    .filter((p) => p.stock_actual <= p.stock_minimo)
    .slice(0, 5)
    .forEach((p) => {
      notifications.push({
        id: `stock-${p.id}`,
        type: 'stock_bajo',
        title: 'Stock bajo',
        message: `${p.nombre}: ${p.stock_actual} uds (mín. ${p.stock_minimo})`,
        href: '/inventario',
        created_at: now,
      });
    });

  (creditos ?? []).forEach((c) => {
    const cliente = (c.clientes as { nombre?: string } | null)?.nombre ?? 'Cliente';
    notifications.push({
      id: `credito-${c.id}`,
      type: 'credito',
      title: 'Crédito pendiente',
      message: `${cliente} debe $${(c.saldo_pendiente ?? 0).toLocaleString('es-CO')}`,
      href: '/creditos',
      created_at: now,
    });
  });

  if ((ventasHoy ?? []).length > 0) {
    const total = ventasHoy!.reduce((s, v) => s + (v.total || 0), 0);
    notifications.push({
      id: 'ventas-hoy',
      type: 'venta',
      title: 'Ventas de hoy',
      message: `${ventasHoy!.length} ventas por $${total.toLocaleString('es-CO')}`,
      href: '/ventas',
      created_at: now,
    });
  }

  return notifications;
}
