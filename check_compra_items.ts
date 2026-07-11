import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

loadEnvConfig('./');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('items_orden_compra')
    .select('*, productos(nombre)')
    .eq('orden_compra_id', '94ec26fb-c396-42db-97a1-69c69ae73ce7');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Items of compra:', JSON.stringify(data, null, 2));
  }
}

main();
