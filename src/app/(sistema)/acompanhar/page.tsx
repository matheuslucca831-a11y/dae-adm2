'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePerfil } from '@/lib/contextoPerfil';
import AcompanharPedidos from '@/components/acompanhar/AcompanharPedidos';

/** Tela da unidade para acompanhar os pedidos (a Sede usa Pedidos) */
export default function AcompanharPage() {
  const { perfil } = usePerfil();
  const router = useRouter();

  useEffect(() => {
    if (perfil.perfil === 'central') {
      router.replace('/pedidos');
    }
  }, [perfil, router]);

  if (perfil.perfil === 'central') return null;

  return <AcompanharPedidos unidadeNome={perfil.unidade?.nome ?? 'sua unidade'} />;
}
