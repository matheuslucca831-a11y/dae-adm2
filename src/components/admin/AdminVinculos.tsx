'use client';

import { useEffect, useMemo, useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { mensagemErro } from '@/lib/formato';
import { DESTINOS_RH } from '@/lib/lancamentos';
import { buscarTudo } from '@/lib/buscarTudo';
import { Aviso, Botao, TabelaWrap, campoCls, tdCls, thCls } from '@/components/ui';

/** Usados nas regras de ponto (Ocorrência = FSPSS, Cartão = Estatutário): não renomear nem excluir */
const PROTEGIDOS = ['FSPSS', 'Estatutário'];

type Vinculo = { nome: string; destino: string | null; funcionarios: number };

export default function AdminVinculos() {
  const supabase = useMemo(() => createClient(), []);
  const [lista, setLista] = useState<Vinculo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [novo, setNovo] = useState('');
  const [ed, setEd] = useState<{ antigo: string; nome: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      supabase.from('vinculos').select('nome').order('nome'),
      supabase.from('destinos_rh').select('vinculo, destino'),
      buscarTudo((de, ate) => supabase.from('funcionarios').select('vinculo').eq('situacao', 'Ativo').order('id').range(de, ate)),
    ]).then(([v, d, f]) => {
      if (!vivo) return;
      const destinos = new Map((d.data ?? []).map((x) => [x.vinculo, x.destino]));
      const qtd = new Map<string, number>();
      (f.data ?? []).forEach((x) => x.vinculo && qtd.set(x.vinculo, (qtd.get(x.vinculo) ?? 0) + 1));
      setLista((v.data ?? []).map((x) => ({ nome: x.nome, destino: destinos.get(x.nome) ?? null, funcionarios: qtd.get(x.nome) ?? 0 })));
      setErro(v.error ? mensagemErro(v.error) : null);
    });
    return () => {
      vivo = false;
    };
  }, [supabase, versao]);

  async function executar(q: PromiseLike<{ error: { message?: string; code?: string } | null }>, depois?: () => void) {
    const { error } = await q;
    if (error) {
      return setErro(error.code === '23505' ? 'Já existe um vínculo com esse nome.'
        : error.code === '23503' ? 'Este vínculo está em uso por funcionários. Troque o vínculo deles antes de excluir.' : mensagemErro(error));
    }
    setErro(null);
    depois?.();
    setVersao((v) => v + 1);
  }

  function mudarDestino(v: Vinculo, destino: string) {
    executar(destino
      ? supabase.from('destinos_rh').upsert({ vinculo: v.nome, destino })
      : supabase.from('destinos_rh').delete().eq('vinculo', v.nome));
  }

  return (
    <>
      <p className="text-sm text-tinta-suave">
        O destino define para qual RH vão os pedidos de cada vínculo. A mudança vale para os próximos pedidos; os já registrados mantêm o destino que tinham.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-linha bg-white p-3">
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Nome do novo vínculo" aria-label="Novo vínculo" className={`${campoCls} min-w-64 flex-1`} />
        <Botao onClick={() => {
          if (!novo.trim()) return setErro('Digite o nome do vínculo e clique em Adicionar vínculo.');
          executar(supabase.from('vinculos').insert({ nome: novo.trim() }), () => setNovo(''));
        }}>
          <Plus className="size-4" aria-hidden /> Adicionar vínculo
        </Botao>
      </div>
      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}

      <div className="mt-4">
        <TabelaWrap>
          <table className="w-full text-sm">
            <thead><tr><th className={thCls}>Vínculo</th><th className={thCls}>Funcionários ativos</th><th className={thCls}>Pedidos vão para</th><th className={thCls}><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {!lista && <tr><td colSpan={4} className={`${tdCls} text-tinta-suave`}>Carregando…</td></tr>}
              {lista?.map((v) => {
                const protegido = PROTEGIDOS.includes(v.nome);
                return (
                  <tr key={v.nome} className="hover:bg-papel/50">
                    <td className={`${tdCls} font-medium`}>
                      {ed?.antigo === v.nome ? (
                        <input value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} aria-label="Nome" className={campoCls} />
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {v.nome}
                          {protegido && <Lock className="size-3.5 text-tinta-suave" aria-label="Usado nas regras de ponto" />}
                        </span>
                      )}
                    </td>
                    <td className={tdCls}>{v.funcionarios}</td>
                    <td className={tdCls}>
                      <select value={v.destino ?? ''} onChange={(e) => mudarDestino(v, e.target.value)} aria-label={`Destino de ${v.nome}`} className={campoCls}>
                        <option value="">Sem destino (escolher em cada pedido)</option>
                        {DESTINOS_RH.map((d) => <option key={d}>{d}</option>)}
                      </select>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap text-right`}>
                      {protegido ? <span className="text-xs text-tinta-suave">usado nas regras de ponto</span>
                        : ed?.antigo === v.nome ? (
                          <>
                            <Botao className="px-2.5 py-1.5 text-xs" disabled={!ed.nome.trim()}
                              onClick={() => executar(supabase.from('vinculos').update({ nome: ed.nome.trim() }).eq('nome', v.nome), () => setEd(null))}>Salvar</Botao>
                            <Botao variante="discreto" className="px-2.5 py-1.5 text-xs" onClick={() => setEd(null)}>Cancelar</Botao>
                          </>
                        ) : (
                          <>
                            <Botao variante="discreto" className="px-2.5 py-1.5 text-xs" onClick={() => setEd({ antigo: v.nome, nome: v.nome })}>Renomear</Botao>
                            <Botao variante="discreto" className="px-2.5 py-1.5 text-xs" onClick={() => {
                              if (!window.confirm(`Excluir o vínculo ${v.nome}?`)) return;
                              executar(supabase.from('destinos_rh').delete().eq('vinculo', v.nome)).then(() =>
                                executar(supabase.from('vinculos').delete().eq('nome', v.nome)));
                            }}>Excluir</Botao>
                          </>
                        )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TabelaWrap>
      </div>
    </>
  );
}
