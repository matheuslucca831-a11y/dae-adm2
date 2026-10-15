'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePerfil } from '@/lib/contextoPerfil';
import MeusFuncionarios from '@/components/equipe/MeusFuncionarios';

/** Unidade: dados e horários dos funcionários lotados nela (a Sede usa Funcionários) */
export default function EquipePage() {
  const { perfil } = usePerfil();
  const router = useRouter();

  useEffect(() => {
    if (perfil.perfil === 'central') {
      router.replace('/funcionarios');
    }
  }, [perfil, router]);

  if (perfil.perfil === 'central') return null;

  return <MeusFuncionarios unidadeNome={perfil.unidade?.nome ?? 'sua unidade'} />;
}
