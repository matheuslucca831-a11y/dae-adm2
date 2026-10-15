'use client';

import { ProvedorPerfil, usePerfil } from '@/lib/contextoPerfil';
import Shell from '@/components/Shell';

function SistemaShell({ children }: { children: React.ReactNode }) {
  const { perfil } = usePerfil();
  return <Shell perfil={perfil}>{children}</Shell>;
}

export default function SistemaLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProvedorPerfil>
      <SistemaShell>{children}</SistemaShell>
    </ProvedorPerfil>
  );
}
