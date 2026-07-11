import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

loadEnvConfig('./');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const prodId = '26ea5798-2c88-4dd6-a3b3-d8069c472533'; // Neumático

  const { data: movements, error: movErr } = await supabase
    .from('movimientos_inventario')
    .select('*')
    .eq('producto_id', prodId);
  
  console.log('--- MOVEMENTS ---');
  console.log(JSON.stringify(movements, null, 2));

  const { data: orderItems, error: itemErr } = await supabase
    .from('items_orden_compra')
    .select('*')
    .eq('producto_id', prodId);

  console.log('--- ORDER ITEMS ---');
  console.log(JSON.stringify(orderItems, null, 2));
}

main();
