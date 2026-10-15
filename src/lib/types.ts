export type TipoAcesso = 'central' | 'unidade';

export type Perfil = {
  id: string;
  nome: string;
  email: string | null;
  perfil: TipoAcesso;
  unidade_id: string | null;
  is_diretora: boolean;
  ativo: boolean;
  unidade: { nome: string; sigla: string | null } | null;
};
