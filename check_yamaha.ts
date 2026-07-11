import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

loadEnvConfig('./');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const tables = ['productos', 'gastos', 'ordenes_compra', 'items_orden_compra', 'auditoria_logs', 'movimientos_inventario'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(50);
    if (!error && data) {
      const match = data.filter(r => JSON.stringify(r).toLowerCase().includes('yamaha'));
      if (match.length > 0) {
        console.log(`Found in ${table}:`, match);
      }
    }
  }
  console.log('Search complete');
}

main();
