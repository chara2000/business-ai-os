import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

loadEnvConfig('./');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre, stock_actual, precio_venta, precio_costo')
    .eq('empresa_id', 'bbae9d2f-04e4-4d25-b096-311101532225')
    .ilike('nombre', '%Yamaha%');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Productos Yamaha:', JSON.stringify(data, null, 2));
  }
}

main();
