'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePerfil } from '@/lib/contextoPerfil';
import SugerirCadastro from '@/components/sugestoes/SugerirCadastro';

/** Unidade sugere cadastros; a Sede analisa em Funcionários > Sugestões das unidades */
export default function SugestoesPage() {
  const { perfil } = usePerfil();
  const router = useRouter();

  useEffect(() => {
    if (perfil.perfil === 'central') {
      router.replace('/funcionarios?aba=sugestoes');
    }
  }, [perfil, router]);

  if (perfil.perfil === 'central') return null;

  return <SugerirCadastro unidadeNome={perfil.unidade?.nome ?? 'sua unidade'} />;
}
