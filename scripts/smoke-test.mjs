#!/usr/bin/env node
/**
 * Business AI OS — Smoke test automatizado
 *
 * Uso:
 *   npm run test:smoke
 *   npm run test:smoke -- --url http://localhost:3000
 *   node scripts/smoke-test.mjs --url https://business-ai-os.vercel.app
 *
 * Variables (desde .env.local o entorno):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   TEST_EMAIL (default: superadmin@demo.com)
 *   TEST_PASSWORD (default: Demo2026!)
 *   TELEGRAM_BOT_TOKEN (opcional, prueba bot Telegram)
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Colores consola ──────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let url = process.env.SMOKE_TEST_URL || 'https://business-ai-os.vercel.app';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      url = args[++i].replace(/\/$/, '');
    }
  }
  return { baseUrl: url };
}

loadEnvFile(resolve(ROOT, '.env.local'));
loadEnvFile(resolve(ROOT, '.env'));

const { baseUrl } = parseArgs();
const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@demo.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Demo2026!';

const results = { pass: 0, fail: 0, skip: 0, items: [] };

async function test(name, category, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - start;
    results.pass++;
    results.items.push({ name, category, status: 'pass', detail, ms });
    console.log(`${c.green}✓${c.reset} ${name} ${c.dim}(${ms}ms)${c.reset}`);
    if (detail) console.log(`  ${c.dim}${detail}${c.reset}`);
    return true;
  } catch (err) {
    const ms = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    results.fail++;
    results.items.push({ name, category, status: 'fail', detail: msg, ms });
    console.log(`${c.red}✗${c.reset} ${name} ${c.dim}(${ms}ms)${c.reset}`);
    console.log(`  ${c.red}${msg}${c.reset}`);
    return false;
  }
}

function skip(name, category, reason) {
  results.skip++;
  results.items.push({ name, category, status: 'skip', detail: reason, ms: 0 });
  console.log(`${c.yellow}○${c.reset} ${name} ${c.dim}(omitido: ${reason})${c.reset}`);
}

async function httpGet(path, { expectStatus = 200, json = false, retries = 2 } = {}) {
  const url = `${baseUrl}${path}`;
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
      if (res.status !== expectStatus) {
        throw new Error(`GET ${path} → HTTP ${res.status} (esperado ${expectStatus})`);
      }
      if (json) return res.json();
      return res.text();
    } catch (err) {
      lastErr = err;
      if (i < retries) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}

async function httpPost(path, body, { expectStatus = 200, headers = {} } = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (res.status !== expectStatus) {
    throw new Error(`POST ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return data;
}

// ══════════════════════════════════════════════════════════════════
// 1. INFRAESTRUCTURA WEB
// ══════════════════════════════════════════════════════════════════
async function runWebTests() {
  console.log(`\n${c.bold}${c.cyan}── Infraestructura web ──${c.reset}`);

  await test('Página principal carga', 'web', async () => {
    const html = await httpGet('/');
    if (!html.includes('Business') && !html.includes('business') && html.length < 500) {
      throw new Error('Respuesta HTML inesperada o vacía');
    }
    return `HTML ${(html.length / 1024).toFixed(1)} KB`;
  });

  await test('Login page', 'web', async () => {
    await httpGet('/login');
    return 'OK';
  });

  await test('Dashboard page (redirect/login)', 'web', async () => {
    const res = await fetch(`${baseUrl}/dashboard`, { redirect: 'manual' });
    if (res.status !== 200 && res.status !== 307 && res.status !== 302) {
      throw new Error(`HTTP ${res.status}`);
    }
    return `HTTP ${res.status}`;
  });

  await test('PWA manifest.json', 'web', async () => {
    const m = await httpGet('/manifest.json', { json: true });
    if (!m.name && !m.short_name) throw new Error('manifest sin nombre');
    return m.name || m.short_name;
  });

  await test('Service worker sw.js', 'web', async () => {
    const sw = await httpGet('/sw.js');
    if (!sw.includes('self') && !sw.includes('cache')) {
      throw new Error('sw.js no parece válido');
    }
    return `${(sw.length / 1024).toFixed(1)} KB`;
  });
}

// ══════════════════════════════════════════════════════════════════
// 2. APIs PÚBLICAS
// ══════════════════════════════════════════════════════════════════
async function runApiTests() {
  console.log(`\n${c.bold}${c.cyan}── APIs públicas ──${c.reset}`);

  await test('IA provider configurado', 'api', async () => {
    const data = await httpGet('/api/ai/provider', { json: true });
    if (!data.configured) throw new Error(`IA no configurada (provider: ${data.provider})`);
    return `${data.label}`;
  });

  await test('Webhook Telegram activo', 'api', async () => {
    const data = await httpGet('/api/webhooks/telegram', { json: true });
    if (!data.status) throw new Error('Sin status en respuesta');
    return data.bot || data.status;
  });

  await test('Telegram setup / webhook URL', 'api', async () => {
    const data = await httpGet('/api/telegram/setup', { json: true });
    const url = data.webhook?.url || data.webhook;
    if (!url) throw new Error('Webhook no configurado en Telegram');
    if (!url.includes('/api/webhooks/telegram')) {
      throw new Error(`URL webhook inesperada: ${url}`);
    }
    return url;
  });

  await test('API chat requiere auth (401)', 'api', async () => {
    await httpPost('/api/ai/chat', { message: 'test' }, { expectStatus: 401 });
    return 'Protección auth OK';
  });

  await test('API execute requiere auth (401)', 'api', async () => {
    await httpPost('/api/ai/execute', { action: { accion: 'consultar_ventas_hoy' } }, { expectStatus: 401 });
    return 'Protección auth OK';
  });
}

// ══════════════════════════════════════════════════════════════════
// 3. SUPABASE / BASE DE DATOS
// ══════════════════════════════════════════════════════════════════
async function runSupabaseTests() {
  console.log(`\n${c.bold}${c.cyan}── Supabase y datos ──${c.reset}`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    skip('Todas las pruebas Supabase', 'db', 'faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY en .env.local');
    return null;
  }

  const supabase = createClient(supabaseUrl, anonKey);
  let session = null;

  await test('Login usuario demo', 'db', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('Sin sesión');
    session = data.session;
    return `${TEST_EMAIL} → user ${data.user?.id?.slice(0, 8)}…`;
  });

  await test('Perfil usuario en tabla usuarios', 'db', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sin usuario autenticado');
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, rol, empresa_id')
      .eq('auth_user_id', user.id)
      .single();
    if (error) throw new Error(error.message);
    if (!data?.empresa_id) throw new Error('Usuario sin empresa_id');
    return `${data.nombre} · rol: ${data.rol}`;
  });

  await test('Empresa activa', 'db', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('auth_user_id', user.id)
      .single();
    const { data, error } = await supabase
      .from('empresas')
      .select('nombre, plan, activa')
      .eq('id', usuario.empresa_id)
      .single();
    if (error) throw new Error(error.message);
    if (!data?.activa) throw new Error('Empresa inactiva');
    return `${data.nombre} · plan ${data.plan}`;
  });

  await test('Productos en inventario', 'db', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('auth_user_id', user.id)
      .single();
    const { count, error } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', usuario.empresa_id)
      .eq('activo', true);
    if (error) throw new Error(error.message);
    return `${count ?? 0} productos activos`;
  });

  await test('Ventas registradas', 'db', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('auth_user_id', user.id)
      .single();
    const today = new Date().toISOString().split('T')[0];
    const { count: total, error: e1 } = await supabase
      .from('ventas')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', usuario.empresa_id);
    if (e1) throw new Error(e1.message);
    const { count: hoy, error: e2 } = await supabase
      .from('ventas')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', usuario.empresa_id)
      .gte('created_at', `${today}T00:00:00`);
    if (e2) throw new Error(e2.message);
    return `${total ?? 0} total · ${hoy ?? 0} hoy`;
  });

  await test('Clientes', 'db', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('auth_user_id', user.id)
      .single();
    const { count, error } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', usuario.empresa_id);
    if (error) throw new Error(error.message);
    return `${count ?? 0} clientes`;
  });

  await test('Créditos / cartera', 'db', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('auth_user_id', user.id)
      .single();
    const { count, error } = await supabase
      .from('creditos')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', usuario.empresa_id)
      .in('estado', ['pendiente', 'parcial', 'vencido']);
    if (error) throw new Error(error.message);
    return `${count ?? 0} créditos pendientes`;
  });

  await test('Columna telegram_session (migración)', 'db', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('usuarios')
      .select('telegram_session')
      .eq('auth_user_id', user.id)
      .single();
    if (error?.message?.includes('telegram_session')) {
      throw new Error('Migración telegram_session no aplicada');
    }
    if (error) throw new Error(error.message);
    return 'Columna existe';
  });

  await supabase.auth.signOut();
  return session;
}

// ══════════════════════════════════════════════════════════════════
// 4. TELEGRAM BOT
// ══════════════════════════════════════════════════════════════════
async function runTelegramTests() {
  console.log(`\n${c.bold}${c.cyan}── Telegram bot ──${c.reset}`);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token.includes('your_')) {
    skip('Bot Telegram getMe', 'telegram', 'TELEGRAM_BOT_TOKEN no configurado');
    return;
  }

  await test('Bot Telegram responde (getMe)', 'telegram', async () => {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.description || 'getMe falló');
    return `@${data.result.username} — ${data.result.first_name}`;
  });

  await test('Webhook Telegram registrado', 'telegram', async () => {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.description);
    const url = data.result?.url;
    if (!url) throw new Error('Sin webhook URL en Telegram');
    return url;
  });
}

// ══════════════════════════════════════════════════════════════════
// 5. IA (chat real con Gemini)
// ══════════════════════════════════════════════════════════════════
async function runAITests() {
  console.log(`\n${c.bold}${c.cyan}── IA Gemini (chat real) ──${c.reset}`);

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey.length < 10) {
    skip('Gemini responde', 'ai', 'GEMINI_API_KEY no configurada');
    return;
  }

  await test('Gemini API responde', 'ai', async () => {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const genAI = new GoogleGenerativeAI(geminiKey);
    const m = genAI.getGenerativeModel({ model });
    const result = await m.generateContent('Responde solo con la palabra OK');
    const text = result.response.text()?.trim();
    if (!text) throw new Error('Sin respuesta de Gemini');
    return `Modelo ${model} → "${text.slice(0, 40)}"`;
  });
}

// ══════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n${c.bold}Business AI OS — Smoke Test${c.reset}`);
  console.log(`${c.dim}URL: ${baseUrl}${c.reset}`);
  console.log(`${c.dim}Usuario: ${TEST_EMAIL}${c.reset}`);
  console.log(`${c.dim}${'─'.repeat(50)}${c.reset}`);

  const t0 = Date.now();

  await runWebTests();
  await runApiTests();
  await runSupabaseTests();
  await runTelegramTests();
  await runAITests();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const total = results.pass + results.fail + results.skip;

  console.log(`\n${c.bold}${'─'.repeat(50)}${c.reset}`);
  console.log(`${c.bold}Resumen${c.reset} (${elapsed}s)`);
  console.log(`  ${c.green}✓ ${results.pass} pasaron${c.reset}`);
  if (results.fail) console.log(`  ${c.red}✗ ${results.fail} fallaron${c.reset}`);
  if (results.skip) console.log(`  ${c.yellow}○ ${results.skip} omitidos${c.reset}`);
  console.log(`  Total: ${total} pruebas\n`);

  if (results.fail > 0) {
    console.log(`${c.red}${c.bold}Algunas pruebas fallaron.${c.reset} Revisa los mensajes arriba.\n`);
    process.exit(1);
  }

  console.log(`${c.green}${c.bold}¡Todo OK!${c.reset} El sistema responde correctamente.\n`);
  console.log(`${c.dim}Pruebas manuales recomendadas:${c.reset}`);
  console.log(`  • Crear venta en ${baseUrl}/ventas`);
  console.log(`  • Chat IA en ${baseUrl}/ai`);
  console.log(`  • Telegram @Saas_ia_bot → /ventas`);
  console.log(`  • PWA: instalar desde el navegador móvil\n`);
}

main().catch((err) => {
  console.error(`${c.red}Error fatal:${c.reset}`, err);
  process.exit(1);
});
