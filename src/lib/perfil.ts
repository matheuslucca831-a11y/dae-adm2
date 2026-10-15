import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { idUsuarioLogado } from '@/lib/supabase/usuario';
import type { Perfil } from '@/lib/types';

/** Perfil do usuário logado (uma consulta por requisição) */
export const getPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await createClient();
  const userId = await idUsuarioLogado(supabase);
  if (!userId) return null;

  const { data } = await supabase
    .from('perfis')
    .select('id, nome, email, perfil, unidade_id, is_diretora, ativo, unidade:unidades(nome, sigla)')
    .eq('id', userId)
    .maybeSingle();

  const perfil = data as unknown as Perfil | null;
  return perfil?.ativo ? perfil : null;
});

/** Use no topo de páginas/layouts: garante login e, se pedido, acesso da sede */
export async function exigirPerfil(opcoes: { somenteCentral?: boolean } = {}) {
  const perfil = await getPerfil();
  if (!perfil) redirect('/login');
  if (opcoes.somenteCentral && perfil.perfil !== 'central') redirect('/funcionarios');
  return perfil;
}
