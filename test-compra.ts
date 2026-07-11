import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

loadEnvConfig('./');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const empresaId = 'bbae9d2f-04e4-4d25-b096-311101532225';

  // 1. Reset FAROLAS NKD back to stock 10
  await supabase
    .from('productos')
    .update({ stock_actual: 10, precio_costo: 20000 })
    .eq('id', '89156c14-56a1-4ca8-a996-6d8245c48a15');

  // 2. Find or create category "Farolas"
  let catId = null;
  const { data: existingCat } = await supabase
    .from('categorias')
    .select('id')
    .eq('empresa_id', empresaId)
    .ilike('nombre', 'Farolas')
    .maybeSingle();

  if (existingCat) {
    catId = existingCat.id;
  } else {
    const { data: newCat } = await supabase
      .from('categorias')
      .insert([{ empresa_id: empresaId, nombre: 'Farolas' }])
      .select('id')
      .single();
    catId = newCat?.id;
  }

  // 3. Create "Farolas DSB 110" product
  const { data: newProd, error } = await supabase
    .from('productos')
    .insert([{
      empresa_id: empresaId,
      codigo: 'PRD-2549',
      nombre: 'Farolas DSB 110',
      precio_costo: 15000,
      precio_venta: 25000,
      margen: 40,
      stock_actual: 10,
      stock_minimo: 5,
      unidad: 'unidad',
      categoria_id: catId,
      activo: true
    }])
    .select();

  console.log("Creation result:", error ? error : newProd);
}

main();
