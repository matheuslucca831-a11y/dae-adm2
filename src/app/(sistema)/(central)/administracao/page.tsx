'use client';

import { usePerfil } from '@/lib/contextoPerfil';
import Administracao from '@/components/admin/Administracao';

export default function AdministracaoPage() {
  const { perfil } = usePerfil();
  return <Administracao meuId={perfil.id} />;
}
