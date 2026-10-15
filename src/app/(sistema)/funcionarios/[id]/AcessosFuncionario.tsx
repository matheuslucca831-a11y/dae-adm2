'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { dataHoraBR, mensagemErro } from '@/lib/formato';
import { Aviso, TabelaWrap, tdCls, thCls } from '@/components/ui';
import { Paginacao, usePaginacao } from '@/components/Paginacao';

type Acesso = { id: number; usuario_nome: string | null; unidade_nome: string | null; tela: string; visto_em: string };
const SEM_ITENS: never[] = [];

/** Quem abriu os dados deste funcionário (log; só a Sede vê) */
export default function AcessosFuncionario({ funcionarioId }: { funcionarioId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [lista, setLista] = useState<Acesso[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    supabase.from('acessos_funcionario').select('id, usuario_nome, unidade_nome, tela, visto_em')
      .eq('funcionario_id', funcionarioId).order('visto_em', { ascending: false }).limit(1000)
      .then(({ data, error }) => {
        if (!vivo) return;
        setLista((data as Acesso[]) ?? []);
        setErro(error ? mensagemErro(error) : null);
      });
    return () => {
      vivo = false;
    };
  }, [supabase, funcionarioId]);

  const pag = usePaginacao(lista ?? SEM_ITENS, 25);
  if (!lista && !erro) return <p className="text-sm text-tinta-suave" role="status">Carregando…</p>;

  return (
    <div>
      <p className="mb-3 text-sm text-tinta-suave">
        Cada vez que alguém abre os dados deste funcionário fica registrado aqui (a mesma pessoa conta uma vez a cada 10 minutos). O registro não pode ser alterado.
      </p>
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      <TabelaWrap>
        <table className="w-full text-sm">
          <thead><tr><th className={thCls}>Quando</th><th className={thCls}>Quem</th><th className={thCls}>De onde</th><th className={thCls}>Tela</th></tr></thead>
          <tbody>
            {lista?.length === 0 && <tr><td colSpan={4} className={`${tdCls} text-tinta-suave`}>Nenhum acesso registrado.</td></tr>}
            {pag.visiveis.map((a) => (
              <tr key={a.id}>
                <td className={`${tdCls} whitespace-nowrap`}>{dataHoraBR(a.visto_em)}</td>
                <td className={tdCls}>{a.usuario_nome ?? '—'}</td>
                <td className={tdCls}>{a.unidade_nome ?? 'Sede (DAE)'}</td>
                <td className={tdCls}>{a.tela}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaWrap>
      <Paginacao p={pag} rotulo="acessos" />
    </div>
  );
}
