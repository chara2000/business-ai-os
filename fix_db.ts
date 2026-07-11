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
    .update({ telegram_chat_id: null })
    .eq('email', 'superadmin@demo.com');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Cleared superadmin');
  }
}

main();
