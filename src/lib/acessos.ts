import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Registra no log que o usuário abriu os dados do funcionário.
 * Não trava a tela se o registro falhar (ex.: 018 ainda não rodado).
 */
export async function registrarAcesso(supabase: SupabaseClient, funcionarioId: string, tela: string) {
  const { error } = await supabase.rpc('registrar_acesso', { p_funcionario: funcionarioId, p_tela: tela });
  if (error) console.warn('Log de acesso não registrado:', error.message);
}
