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
    .select('id, email, telegram_chat_id');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Usuarios:', data);
  }
}

main();
