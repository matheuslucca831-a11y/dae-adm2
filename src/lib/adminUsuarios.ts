import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

/** Chamadas à Edge Function "admin-usuarios" (a chave secreta fica no Supabase) */
export type NovoUsuario = {
  nome: string; email: string; senha: string; perfil: 'central' | 'unidade'; unidade_id: string | null;
};

/** Explica, em português, por que a chamada à função falhou */
async function explicar(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const status = (error.context as Response).status;
    let corpo = '';
    try { corpo = await (error.context as Response).text(); } catch { /* sem corpo */ }
    if (status === 404) return 'A função admin-usuarios não foi encontrada. Publique no Supabase (Edge Functions) com esse nome exato.';
    if (status === 401) return 'O Supabase recusou a chamada (401). Em Edge Functions → admin-usuarios → Details, desligue "Verify JWT" e salve.';
    return `A função respondeu com erro ${status}. ${corpo.slice(0, 200)} Veja os Logs da função no Supabase.`;
  }
  if (error instanceof FunctionsRelayError) return 'O Supabase não conseguiu repassar a chamada para a função. Tente de novo em instantes.';
  if (error instanceof FunctionsFetchError) {
    return 'O navegador não conseguiu chegar até a função. Normalmente é a função ainda não publicada, ou "Verify JWT" ligado ' +
      '(Edge Functions → admin-usuarios → Details → desligar "Verify JWT").';
  }
  return 'Erro inesperado ao chamar a função admin-usuarios.';
}

async function chamar(corpo: Record<string, unknown>): Promise<{ erro?: string }> {
  const { data, error } = await createClient().functions.invoke('admin-usuarios', { body: corpo });
  if (error) return { erro: await explicar(error) };
  return data?.erro ? { erro: String(data.erro) } : {};
}

export const criarUsuario = (d: NovoUsuario) => chamar({ acao: 'criar', ...d });
export const redefinirSenha = (usuarioId: string, senha: string) => chamar({ acao: 'senha', usuario_id: usuarioId, senha });
