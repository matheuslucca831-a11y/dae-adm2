import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { opcoesCookie } from './cookies';

/** Cliente para Server Components, Server Actions e Route Handlers */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: opcoesCookie,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(lista) {
          try {
            lista.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Chamado de um Server Component: pode ignorar, o proxy renova a sessão
          }
        },
      },
    }
  );
}
