'use client';

import { useSearchParams } from 'next/navigation';
import { usePerfil } from '@/lib/contextoPerfil';
import TelaLancamentos from '@/components/lancamentos/TelaLancamentos';
import type { Categoria } from '@/lib/lancamentos';

const CATEGORIAS_PEDIDOS: Categoria[] = ['ferias_lp', 'folgas_abonos', 'he_bh'];

export default function PedidosPage() {
  const { perfil } = usePerfil();
  const searchParams = useSearchParams();
  const categoria = searchParams.get('categoria');
  const inicial = CATEGORIAS_PEDIDOS.includes(categoria as Categoria) ? (categoria as Categoria) : 'todas';

  return (
    <TelaLancamentos
      key={inicial}
      categorias={CATEGORIAS_PEDIDOS}
      inicial={inicial}
      titulo="Pedidos"
      descricao="Férias / LP, Folgas / Abonos e HE / BH: registro, assinatura da Diretoria, envio ao RH e arquivamento."
      perfil={perfil}
    />
  );
}
