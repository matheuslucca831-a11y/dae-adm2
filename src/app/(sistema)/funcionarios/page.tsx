'use client';

import { useSearchParams } from 'next/navigation';
import { usePerfil } from '@/lib/contextoPerfil';
import RelacaoMensal from './RelacaoMensal';
import FuncionariosCentral from './FuncionariosCentral';

export default function FuncionariosPage() {
  const { perfil } = usePerfil();
  const searchParams = useSearchParams();
  const aba = searchParams.get('aba');

  if (perfil.perfil === 'unidade') {
    return <RelacaoMensal unidadeNome={perfil.unidade?.nome ?? 'Unidade'} />;
  }
  return <FuncionariosCentral abaInicial={aba === 'sugestoes' || aba === 'relacoes' ? aba : 'cadastro'} />;
}
