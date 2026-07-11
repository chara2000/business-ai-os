import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

loadEnvConfig('./');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: cats, error: catErr } = await supabase
    .from('categorias')
    .select('*')
    .eq('empresa_id', 'bbae9d2f-04e4-4d25-b096-311101532225');
  
  if (catErr) {
    console.error("Error fetching categories:", catErr);
  } else {
    console.log("Registered Categories:", JSON.stringify(cats, null, 2));
  }

  const { data: marcas, error: marcaErr } = await supabase
    .from('marcas')
    .select('*')
    .eq('empresa_id', 'bbae9d2f-04e4-4d25-b096-311101532225');

  if (marcaErr) {
    console.error("Error fetching brands:", marcaErr);
  } else {
    console.log("Registered Brands:", JSON.stringify(marcas, null, 2));
  }
}

main();
