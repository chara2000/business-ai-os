import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

loadEnvConfig('./');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const prodId = 'f2857db0-f4de-4b76-9ef5-1a095d4173f6'; // direccionales de NKD 125
  console.log("Attempting to update product id:", prodId);

  const { data, error } = await supabase
    .from('productos')
    .update({
      stock_actual: 10,
      precio_costo: 15000,
      precio_venta: 25000,
      margen: 40
    })
    .eq('id', prodId)
    .select();

  if (error) {
    console.error("Update error:", error);
  } else {
    console.log("Update success data:", data);
  }
}

main();
