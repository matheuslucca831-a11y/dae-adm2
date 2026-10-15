'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarX, Inbox, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import RelFuncionarios from './RelFuncionarios';
import RelAusencias from './RelAusencias';
import RelPedidos from './RelPedidos';
import RelResumo from './RelResumo';

const RELATORIOS = [
  { id: 'resumo', titulo: 'Resumo administrativo', descricao: 'Números do período por categoria, etapa e unidade', icone: BarChart3 },
  { id: 'ausencias', titulo: 'Ausências no período', descricao: 'Quem está de férias, folga, abono ou atestado', icone: CalendarX },
  { id: 'pedidos', titulo: 'Pedidos por período', descricao: 'Lista completa com assinatura e andamento', icone: Inbox },
  { id: 'funcionarios', titulo: 'Funcionários por unidade', descricao: 'Lotações, carga horária e escalas', icone: Users },
] as const;
type Id = (typeof RELATORIOS)[number]['id'];

export default function Relatorios() {
  const supabase = useMemo(() => createClient(), []);
  const [rel, setRel] = useState<Id>('resumo');
  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    supabase.from('unidades').select('id, nome').eq('ativa', true).order('nome')
      .then(({ data }) => setUnidades(data ?? []));
  }, [supabase]);

  return (
    <div className="w-full">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="mt-1 text-tinta-suave">Escolha o relatório, ajuste os filtros e imprima ou salve em PDF.</p>

        <div role="tablist" aria-label="Relatórios" className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {RELATORIOS.map(({ id, titulo, descricao, icone: Icone }) => (
            <button key={id} role="tab" type="button" aria-selected={rel === id} onClick={() => setRel(id)}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                rel === id ? 'border-acento bg-acento-claro' : 'border-linha bg-white hover:border-acento/40'}`}>
              <Icone className={`mt-0.5 size-5 shrink-0 ${rel === id ? 'text-acento-escuro' : 'text-tinta-suave'}`} aria-hidden />
              <span>
                <span className="block text-sm font-semibold">{titulo}</span>
                <span className="block text-xs text-tinta-suave">{descricao}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 print:mt-0">
        {rel === 'resumo' && <RelResumo />}
        {rel === 'ausencias' && <RelAusencias unidades={unidades} />}
        {rel === 'pedidos' && <RelPedidos unidades={unidades} />}
        {rel === 'funcionarios' && <RelFuncionarios unidades={unidades} />}
      </div>
    </div>
  );
}
