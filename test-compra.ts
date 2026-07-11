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
    .select('id, numero, subtotal, total, created_at, items_venta(*)')
    .order('created_at', { ascending: false })
    .limit(15);
  
  if (error) {
    console.error(error);
  } else {
    console.log("Last 15 sales:", JSON.stringify(sales, null, 2));
  }
}

main();
