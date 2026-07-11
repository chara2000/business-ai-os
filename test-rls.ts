import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

loadEnvConfig('./');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const sql = `
    SELECT proname, prosrc 
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public';
  `;

  console.log("Querying database functions...");
  const { data, error } = await supabase.rpc('execute_ai_sql', { 
    sql_query: sql,
    p_user_id: 'fa2a9f28-92c8-4ec7-b01c-6833db5cd44e'
  });

  if (error) {
    console.error("RPC Error:", error);
  } else {
    console.log("Functions found:", JSON.stringify(data, null, 2));
  }
}

main();
