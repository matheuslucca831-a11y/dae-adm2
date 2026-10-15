'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePerfil } from '@/lib/contextoPerfil';

/** Tudo dentro de (central) é exclusivo do ADM Central */
export default function CentralLayout({ children }: { children: React.ReactNode }) {
  const { perfil } = usePerfil();
  const router = useRouter();

  useEffect(() => {
    if (perfil && perfil.perfil !== 'central') {
      router.replace('/funcionarios');
    }
  }, [perfil, router]);

  if (!perfil || perfil.perfil !== 'central') return null;

  return <>{children}</>;
}
