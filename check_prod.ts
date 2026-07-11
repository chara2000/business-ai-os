import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

loadEnvConfig('./');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: order, error } = await supabase
    .from('ordenes_compra')
    .select('*, items_orden_compra(*, producto:productos(*))')
    .eq('numero', 'OC-562792688')
    .single();

  if (error) {
    console.error(error);
  } else {
    console.log("Order items:", JSON.stringify(order, null, 2));
  }
}

main();
