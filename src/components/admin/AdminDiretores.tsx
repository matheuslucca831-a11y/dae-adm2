'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { mensagemErro } from '@/lib/formato';
import { Aviso, Botao, Selo, TabelaWrap, campoCls, tdCls, thCls } from '@/components/ui';

type Diretor = { id: string; nome: string; cargo: string | null; ativo: boolean };

/** Quem pode aparecer como "assinado por" nos pedidos */
export default function AdminDiretores() {
  const supabase = useMemo(() => createClient(), []);
  const [lista, setLista] = useState<Diretor[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [novo, setNovo] = useState({ nome: '', cargo: '' });
  const [ed, setEd] = useState<Diretor | null>(null);

  useEffect(() => {
    let vivo = true;
    supabase.from('diretores').select('id, nome, cargo, ativo').order('ativo', { ascending: false }).order('nome')
      .then(({ data, error }) => {
        if (!vivo) return;
        setLista((data as Diretor[]) ?? []);
        setErro(error ? mensagemErro(error) : null);
      });
    return () => {
      vivo = false;
    };
  }, [supabase, versao]);

  async function executar(q: PromiseLike<{ error: { message?: string; code?: string } | null }>, depois?: () => void) {
    const { error } = await q;
    if (error) return setErro(error.code === '23505' ? 'Já existe um diretor com esse nome.' : mensagemErro(error));
    setErro(null);
    depois?.();
    setVersao((v) => v + 1);
  }

  return (
    <>
      <p className="text-sm text-tinta-suave">Quem aparece na lista &ldquo;Quem assinou&rdquo; ao registrar a decisão de um pedido. Desative em vez de excluir, para não perder o histórico.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-linha bg-white p-3">
        <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Nome" aria-label="Nome" className={`${campoCls} min-w-56 flex-1`} />
        <input value={novo.cargo} onChange={(e) => setNovo({ ...novo, cargo: e.target.value })} placeholder="Cargo (ex.: Diretora DAE)" aria-label="Cargo" className={`${campoCls} min-w-56 flex-1`} />
        <Botao onClick={() => {
          if (!novo.nome.trim()) return setErro('Digite o nome do diretor(a) e clique em Adicionar.');
          executar(supabase.from('diretores').insert({ nome: novo.nome.trim(), cargo: novo.cargo.trim() || null }), () => setNovo({ nome: '', cargo: '' }));
        }}>
          <Plus className="size-4" aria-hidden /> Adicionar
        </Botao>
      </div>
      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}

      <div className="mt-4">
        <TabelaWrap>
          <table className="w-full text-sm">
            <thead><tr><th className={thCls}>Nome</th><th className={thCls}>Cargo</th><th className={thCls}>Situação</th><th className={thCls}><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {!lista && <tr><td colSpan={4} className={`${tdCls} text-tinta-suave`}>Carregando…</td></tr>}
              {lista?.length === 0 && <tr><td colSpan={4} className={`${tdCls} text-tinta-suave`}>Nenhum diretor cadastrado. Sem isso não dá para registrar assinaturas.</td></tr>}
              {lista?.map((d) => (
                <tr key={d.id} className="hover:bg-papel/50">
                  <td className={`${tdCls} font-medium`}>
                    {ed?.id === d.id ? <input value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} aria-label="Nome" className={`${campoCls} w-full`} /> : d.nome}
                  </td>
                  <td className={tdCls}>
                    {ed?.id === d.id ? <input value={ed.cargo ?? ''} onChange={(e) => setEd({ ...ed, cargo: e.target.value })} aria-label="Cargo" className={`${campoCls} w-full`} /> : d.cargo}
                  </td>
                  <td className={tdCls}><Selo texto={d.ativo ? 'Ativo' : 'Inativo'} /></td>
                  <td className={`${tdCls} whitespace-nowrap text-right`}>
                    {ed?.id === d.id ? (
                      <>
                        <Botao className="px-2.5 py-1.5 text-xs" onClick={() => executar(
                          supabase.from('diretores').update({ nome: ed.nome.trim(), cargo: ed.cargo?.trim() || null }).eq('id', d.id), () => setEd(null))}>Salvar</Botao>
                        <Botao variante="discreto" className="px-2.5 py-1.5 text-xs" onClick={() => setEd(null)}>Cancelar</Botao>
                      </>
                    ) : (
                      <>
                        <Botao variante="discreto" className="px-2.5 py-1.5 text-xs" onClick={() => setEd(d)}>Editar</Botao>
                        <Botao variante="discreto" className="px-2.5 py-1.5 text-xs"
                          onClick={() => executar(supabase.from('diretores').update({ ativo: !d.ativo }).eq('id', d.id))}>
                          {d.ativo ? 'Desativar' : 'Reativar'}
                        </Botao>
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
