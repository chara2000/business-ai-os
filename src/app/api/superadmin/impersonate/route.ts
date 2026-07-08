import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function verifySuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, rol')
    .eq('auth_user_id', user.id)
    .single();

  if (!usuario || usuario.rol !== 'super_admin') return null;
  return usuario;
}

export async function POST(req: Request) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { empresa_id } = await req.json();
  if (!empresa_id) {
    return NextResponse.json({ error: 'empresa_id requerido' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data: empresa, error } = await supabase
    .from('empresas')
    .select('*')
    .eq('id', empresa_id)
    .single();

  if (error || !empresa) {
    return NextResponse.json({ error: 'Establecimiento no encontrado' }, { status: 404 });
  }

  const response = NextResponse.json({ success: true, data: empresa });
  response.cookies.set('impersonate_empresa_id', empresa_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  });

  return response;
}

export async function DELETE() {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('impersonate_empresa_id');
  return response;
}

export async function GET() {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const cookieStore = await cookies();
  const id = cookieStore.get('impersonate_empresa_id')?.value;

  if (!id) {
    return NextResponse.json({ success: true, data: null });
  }

  const supabase = await createAdminClient();
  const { data: empresa } = await supabase
    .from('empresas')
    .select('*')
    .eq('id', id)
    .single();

  return NextResponse.json({ success: true, data: empresa });
}
