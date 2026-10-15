import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Id do usuário logado (ou null).
 * Tenta primeiro getClaims (confere o login sem ir ao servidor do Supabase);
 * se não der — ambiente sem a chave pública, sem WebCrypto, rede bloqueada —
 * cai no getUser, que pergunta direto ao Supabase. Nunca derruba a página.
 */
export async function idUsuarioLogado(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (!error && data?.claims?.sub) return data.claims.sub;
    if (!error && !data) return null; // sem sessão: não há o que conferir
  } catch (e) {
    console.warn('getClaims falhou; conferindo o login pelo getUser:', e instanceof Error ? e.message : e);
  }
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch (e) {
    console.error('Falha ao verificar a sessão no Supabase:', e);
    return null;
  }
}
