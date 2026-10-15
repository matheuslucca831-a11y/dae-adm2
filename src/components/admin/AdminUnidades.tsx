'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { mensagemErro } from '@/lib/formato';
import { Aviso, Botao, Selo, TabelaWrap, campoCls, tdCls, thCls } from '@/components/ui';

type Unidade = { id: string; nome: string; sigla: string | null; cnes: string | null; ativa: boolean; lotacoes: { count: number }[] };

export default function AdminUnidades() {
  const supabase = useMemo(() => createClient(), []);
  const [lista, setLista] = useState<Unidade[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [nova, setNova] = useState({ nome: '', sigla: '', cnes: '' });
  const [ed, setEd] = useState<Unidade | null>(null);

  useEffect(() => {
    let vivo = true;
    supabase.from('unidades').select('*, lotacoes(count)').eq('lotacoes.situacao', 'Ativa').order('nome')
      .then(({ data, error }) => {
        if (!vivo) return;
        setLista((data as unknown as Unidade[]) ?? []);
        setErro(error ? mensagemErro(error) : null);
      });
    return () => {
      vivo = false;
    };
  }, [supabase, versao]);

  async function executar(q: PromiseLike<{ error: { message?: string; code?: string } | null }>, depois?: () => void) {
    const { error } = await q;
    if (error) return setErro(error.code === '23505' ? 'Já existe uma unidade com esse nome.' : mensagemErro(error));
    setErro(null);
    depois?.();
    setVersao((v) => v + 1);
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-linha bg-white p-3">
        <input value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} placeholder="Digite o nome da unidade" aria-label="Nome" className={`${campoCls} min-w-64 flex-1`} />
        <input value={nova.sigla} onChange={(e) => setNova({ ...nova, sigla: e.target.value })} placeholder="Sigla" aria-label="Sigla" className={`${campoCls} w-28`} />
        <input value={nova.cnes} inputMode="numeric" onChange={(e) => setNova({ ...nova, cnes: e.target.value.replace(/\D/g, '').slice(0, 7) })} placeholder="CNES" aria-label="CNES" className={`${campoCls} w-32`} />
        <Botao onClick={() => {
          if (!nova.nome.trim()) return setErro('Digite o nome da unidade no campo ao lado e clique em Adicionar unidade.');
          executar(supabase.from('unidades').insert({ nome: nova.nome.trim(), sigla: nova.sigla.trim() || null, cnes: nova.cnes || null }), () => setNova({ nome: '', sigla: '', cnes: '' }));
        }}>
          <Plus className="size-4" aria-hidden /> Adicionar unidade
        </Botao>
      </div>
      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}

      <div className="mt-4">
        <TabelaWrap>
          <table className="w-full text-sm">
            <thead><tr><th className={thCls}>Unidade</th><th className={thCls}>Sigla</th><th className={thCls}>CNES</th><th className={thCls}>Lotados</th><th className={thCls}>Situação</th><th className={thCls}><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {!lista && <tr><td colSpan={6} className={`${tdCls} text-tinta-suave`}>Carregando…</td></tr>}
              {lista?.map((u) => (
                <tr key={u.id} className="hover:bg-papel/50">
                  <td className={`${tdCls} font-medium`}>
                    {ed?.id === u.id ? <input value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} aria-label="Nome" className={`${campoCls} w-full`} /> : u.nome}
                  </td>
                  <td className={tdCls}>
                    {ed?.id === u.id ? <input value={ed.sigla ?? ''} onChange={(e) => setEd({ ...ed, sigla: e.target.value })} aria-label="Sigla" className={`${campoCls} w-28`} /> : u.sigla}
                  </td>
                  <td className={tdCls}>
                    {ed?.id === u.id
                      ? <input value={ed.cnes ?? ''} inputMode="numeric" onChange={(e) => setEd({ ...ed, cnes: e.target.value.replace(/\D/g, '').slice(0, 7) })} aria-label="CNES" className={`${campoCls} w-32`} />
                      : u.cnes || <span className="text-xs text-tinta-suave">não informado</span>}
                  </td>
                  <td className={tdCls}>{u.lotacoes[0]?.count ?? 0}</td>
                  <td className={tdCls}><Selo texto={u.ativa ? 'Ativo' : 'Inativo'} /></td>
                  <td className={`${tdCls} whitespace-nowrap text-right`}>
                    {ed?.id === u.id ? (
                      <>
                        <Botao className="px-2.5 py-1.5 text-xs" onClick={() => executar(
                          supabase.from('unidades').update({ nome: ed.nome.trim(), sigla: ed.sigla?.trim() || null, cnes: ed.cnes?.trim() || null }).eq('id', u.id), () => setEd(null))}>Salvar</Botao>
                        <Botao variante="discreto" className="px-2.5 py-1.5 text-xs" onClick={() => setEd(null)}>Cancelar</Botao>
                      </>
                    ) : (
                      <>
                        <Botao variante="discreto" className="px-2.5 py-1.5 text-xs" onClick={() => setEd(u)}>Editar</Botao>
                        <Botao variante="discreto" className="px-2.5 py-1.5 text-xs" onClick={() => {
                          if (u.ativa && !window.confirm(`Desativar ${u.nome}? Ela some das listas de escolha, mas o histórico fica guardado.`)) return;
                          executar(supabase.from('unidades').update({ ativa: !u.ativa }).eq('id', u.id));
                        }}>{u.ativa ? 'Desativar' : 'Reativar'}</Botao>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaWrap>
      </div>
    </>
  );
}
