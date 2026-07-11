import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

loadEnvConfig('./');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const empresaId = 'bbae9d2f-04e4-4d25-b096-311101532225'; // El Trebol
  const { data: prod, error } = await supabase.from('productos').insert([{
    empresa_id: empresaId,
    codigo: 'PRD-' + Math.floor(1000 + Math.random() * 9000),
    nombre: 'Farolas Yamaha R1',
    precio_costo: 20000,
    precio_venta: 50000,
    stock_actual: 40,
    stock_minimo: 5,
    margen: 60,
    unidad: 'unidad',
    activo: true
  }]).select('*').single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Inserted product manually:', prod);
  }
}

main();
