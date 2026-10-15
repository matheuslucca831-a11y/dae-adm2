'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PerfilFuncionario from './PerfilFuncionario';

/**
 * Como o site é exportado como páginas estáticas (HostGator), não existe uma
 * página pronta para cada funcionário. O cadastro abre em /funcionarios/perfil?id=...
 */
function Conteudo() {
  const id = useSearchParams().get('id');
  if (!id) {
    return (
      <div className="dock-card p-6 text-sm text-slate-gray">
        Nenhum funcionário foi selecionado.{' '}
        <Link href="/funcionarios" className="font-semibold text-electric-cobalt underline">Voltar para a lista</Link>
      </div>
    );
  }
  return <PerfilFuncionario key={id} id={id} />;
}

export default function PerfilFuncionarioPage() {
  return (
    <Suspense fallback={null}>
      <Conteudo />
    </Suspense>
  );
}
