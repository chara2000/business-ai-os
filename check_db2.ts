import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

loadEnvConfig('./');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, empresa_id, empresas(nombre)')
    .eq('telegram_chat_id', '760723850');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('User data:', JSON.stringify(data, null, 2));
  }
}

main();
