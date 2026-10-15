'use client';

import { useSearchParams } from 'next/navigation';
import AvisosRH from '@/components/rh/AvisosRH';

const ORIGENS: Record<string, string> = {
  '/pedidos': 'Pedidos',
  '/ponto-ausencias': 'Ponto / Ausências',
  '/avaliacoes': 'Avaliações',
  '/envios-rh': 'Envios RH',
};

export default function AvisosRHPage() {
  const searchParams = useSearchParams();
  const aviso = searchParams.get('aviso') ?? undefined;
  const voltar = searchParams.get('voltar');
  const origem = voltar && ORIGENS[voltar] ? voltar : '/pedidos';

  return <AvisosRH key={aviso ?? 'lista'} avisoInicial={aviso} voltar={{ href: origem, titulo: ORIGENS[origem] }} />;
}
