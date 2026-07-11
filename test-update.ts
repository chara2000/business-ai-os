import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

loadEnvConfig('./');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const prodId = '26ea5798-2c88-4dd6-a3b3-d8069c472533'; // Neumático
  console.log("Attempting to update product id:", prodId);

  const { data, error } = await supabase
    .from('productos')
    .update({
      stock_actual: 10,
      precio_costo: 10000,
      precio_venta: 28000,
      margen: 64
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
