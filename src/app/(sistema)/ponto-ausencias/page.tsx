'use client';

import { usePerfil } from '@/lib/contextoPerfil';
import TelaLancamentos from '@/components/lancamentos/TelaLancamentos';
import { CATEGORIAS } from '@/lib/lancamentos';

export default function PontoAusenciasPage() {
  const { perfil } = usePerfil();
  const cfg = CATEGORIAS.ponto_ausencias;
  return <TelaLancamentos categorias={['ponto_ausencias']} titulo={cfg.titulo} descricao={cfg.descricao} perfil={perfil} />;
}
