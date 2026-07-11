import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

loadEnvConfig('./');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: sales, error } = await supabase
    .from('ventas')
    .select('*, items_venta(*, producto:productos(*))')
    .gte('created_at', '2026-07-11T00:00:00.000Z')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
  } else {
    console.log("Sales created today:", JSON.stringify(sales, null, 2));
  }
}

main();
