'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Inicio() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/funcionarios');
  }, [router]);

  return null;
}
