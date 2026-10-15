'use client';

import { useState } from 'react';
import AdminUsuarios from './AdminUsuarios';
import AdminUnidades from './AdminUnidades';
import AdminVinculos from './AdminVinculos';
import AdminDiretores from './AdminDiretores';
import AdminCargos from './AdminCargos';
import AdminAtalhos from './AdminAtalhos';

const ABAS = [
  ['usuarios', 'Usuários'],
  ['unidades', 'Unidades'],
  ['vinculos', 'Vínculos e RH'],
  ['cargos', 'Cargos'],
  ['horarios', 'Atalhos de horário'],
  ['diretores', 'Diretores'],
] as const;
type Aba = (typeof ABAS)[number][0];

export default function Administracao({ meuId }: { meuId: string }) {
  const [aba, setAba] = useState<Aba>('usuarios');
  return (
    <div className="w-full space-y-6">
      {/* Abas Superiores no estilo de Pílulas do SIGER APS */}
      <div role="tablist" aria-label="Seções de Administração" className="flex flex-wrap gap-2">
        {ABAS.map(([v, r]) => {
          const ativo = aba === v;
          return (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={ativo}
              onClick={() => setAba(v)}
              className={`rounded-full px-5 py-2 text-xs font-semibold transition-all ${
                ativo
                  ? 'bg-electric-cobalt text-white shadow-xs'
                  : 'bg-white text-mid-graphite border border-slate-200/80 hover:bg-slate-50 hover:text-ink-charcoal'
              }`}
            >
              {r}
            </button>
          );
        })}
      </div>

      <div>
        {aba === 'usuarios' && <AdminUsuarios meuId={meuId} />}
        {aba === 'unidades' && <AdminUnidades />}
        {aba === 'vinculos' && <AdminVinculos />}
        {aba === 'cargos' && <AdminCargos />}
        {aba === 'horarios' && <AdminAtalhos />}
        {aba === 'diretores' && <AdminDiretores />}
      </div>
    </div>
  );
}
