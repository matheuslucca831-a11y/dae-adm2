'use client';

import { usePerfil } from '@/lib/contextoPerfil';
import Relatorios from '@/components/relatorios/Relatorios';

/** Por enquanto, apenas a Sede (ADM Central) acessa */
export default function RelatoriosPage() {
  usePerfil();
  return <Relatorios />;
}
