'use client';

import { usePerfil } from '@/lib/contextoPerfil';
import TelaLancamentos from '@/components/lancamentos/TelaLancamentos';
import { CATEGORIAS } from '@/lib/lancamentos';

export default function AvaliacoesPage() {
  const { perfil } = usePerfil();
  const cfg = CATEGORIAS.avaliacoes;
  return <TelaLancamentos categorias={['avaliacoes']} titulo={cfg.titulo} descricao={cfg.descricao} perfil={perfil} />;
}
