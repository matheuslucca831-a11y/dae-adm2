import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { opcoesCookie } from './cookies';
import { idUsuarioLogado } from './usuario';

/** Renova a sessão a cada requisição e manda para /login quem não está logado */
export async function atualizarSessao(request: NextRequest) {
  // Sem as variáveis, avisa em vez de derrubar o site
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return new NextResponse(
      'Configuração incompleta: cadastre NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'nas variáveis de ambiente (Vercel > Settings > Environment Variables) e faça um novo deploy.',
      { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  }
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: opcoesCookie,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(lista) {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          resposta = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
        },
      },
    }
  );

  // confere o login (getClaims, com reserva no getUser); nunca derruba a página
  const userId = await idUsuarioLogado(supabase);

  const naLogin = request.nextUrl.pathname.startsWith('/login');
  if (!userId && !naLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return resposta;
}
