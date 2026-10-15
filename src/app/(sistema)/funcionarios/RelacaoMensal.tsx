'use client';

import { useEffect, useMemo, useState } from 'react';
import { Printer, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { competenciaAtual, dataHoraBR, mensagemErro, nomeCompetencia, normalizar } from '@/lib/formato';
import type { SituacaoRelacao } from '@/lib/constantes';
import { Aviso, Botao, Selo, SeletorMes, TabelaWrap, inputCls, tdCls, thCls } from '@/components/ui';
import BuscaFuncionario, { type ResultadoBusca } from './BuscaFuncionario';

type Relacao = {
  id: string; competencia: string; situacao: SituacaoRelacao;
  obs: string | null; sede_obs: string | null; enviada_em: string | null;
};
type Item = {
  id: string; funcionario_id: string; funcionario_nome: string; matricula: string | null;
  cargo: string | null; funcao: string | null; vinculo: string | null; obs: string | null;
};

const CAMPOS_ITEM = 'id, funcionario_id, funcionario_nome, matricula, cargo, funcao, vinculo, obs';
const ordenar = (l: Item[]) => [...l].sort((a, b) => a.funcionario_nome.localeCompare(b.funcionario_nome, 'pt-BR'));

export default function RelacaoMensal({ unidadeNome }: { unidadeNome: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [comp, setComp] = useState(competenciaAtual);
  const [versao, setVersao] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [relacao, setRelacao] = useState<Relacao | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: r, error } = await supabase
        .from('relacoes_mensais')
        .select('id, competencia, situacao, obs, sede_obs, enviada_em')
        .eq('competencia', comp)
        .maybeSingle();
      let lista: Item[] = [];
      let falha = error;
      if (r && !error) {
        const res = await supabase.from('relacao_itens').select(CAMPOS_ITEM).eq('relacao_id', r.id);
        lista = (res.data as Item[]) ?? [];
        falha = res.error;
      }
      if (!vivo) return;
      setRelacao(r as Relacao | null);
      setItens(ordenar(lista));
      setErro(falha ? mensagemErro(falha) : null);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, comp, versao]);

  function trocarMes(c: string) {
    setCarregando(true);
    setConfirmandoEnvio(false);
    setFiltro('');
    setComp(c);
  }

  const editavel = relacao?.situacao === 'Em preparação' || relacao?.situacao === 'Devolvida';
  const idsNaLista = useMemo(() => new Set(itens.map((i) => i.funcionario_id)), [itens]);
  const visiveis = useMemo(() => {
    const f = normalizar(filtro);
    return f ? itens.filter((i) => normalizar(`${i.funcionario_nome} ${i.matricula} ${i.cargo ?? ''}`).includes(f)) : itens;
  }, [itens, filtro]);

  async function iniciar() {
    setOcupado(true);
    const { error } = await supabase.rpc('iniciar_relacao', { p_competencia: comp });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setVersao((v) => v + 1);
  }

  async function adicionar(f: ResultadoBusca) {
    if (!relacao) return;
    const { data, error } = await supabase
      .from('relacao_itens')
      .insert({ relacao_id: relacao.id, funcionario_id: f.id })
      .select(CAMPOS_ITEM)
      .single();
    if (error) return setErro(mensagemErro(error));
    setErro(null);
    setItens((l) => ordenar([...l, data as Item]));
  }

  async function remover(item: Item) {
    const { error } = await supabase.from('relacao_itens').delete().eq('id', item.id);
    if (error) return setErro(mensagemErro(error));
    setItens((l) => l.filter((i) => i.id !== item.id));
  }

  async function salvarObsItem(item: Item, obs: string) {
    if ((item.obs ?? '') === obs) return;
    const { error } = await supabase.from('relacao_itens').update({ obs: obs || null }).eq('id', item.id);
    if (error) return setErro(mensagemErro(error));
    setItens((l) => l.map((i) => (i.id === item.id ? { ...i, obs: obs || null } : i)));
  }

  async function salvarObsRelacao(obs: string) {
    if (!relacao || (relacao.obs ?? '') === obs) return;
    const { error } = await supabase.from('relacoes_mensais').update({ obs: obs || null }).eq('id', relacao.id);
    if (error) return setErro(mensagemErro(error));
    setRelacao({ ...relacao, obs: obs || null });
  }

  async function enviar() {
    if (!relacao) return;
    setOcupado(true);
    const { error } = await supabase.rpc('enviar_relacao', { p_relacao: relacao.id });
    setOcupado(false);
    setConfirmandoEnvio(false);
    if (error) return setErro(mensagemErro(error));
    setVersao((v) => v + 1);
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relação de funcionários</h1>
          <p className="mt-1 text-tinta-suave">{unidadeNome}: quem atua na unidade em cada mês.</p>
        </div>
        <div className="flex items-center gap-3">
          {relacao && <Selo texto={relacao.situacao} />}
          <SeletorMes valor={comp} onChange={trocarMes} />
        </div>
      </div>

      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}

      {carregando ? (
        <p className="mt-10 text-sm text-tinta-suave" role="status">Carregando a relação…</p>
      ) : !relacao ? (
        <div className="mt-6 rounded-lg border border-dashed border-linha bg-white p-8">
          <p className="font-semibold">A relação de {nomeCompetencia(comp)} ainda não foi iniciada.</p>
          <p className="mt-1 max-w-xl text-sm text-tinta-suave">
            Ela começa com os funcionários da relação anterior (ou com os lotados na unidade, se for a primeira).
            Depois é só incluir ou retirar quem mudou e enviar à sede.
          </p>
          <Botao className="mt-5" onClick={iniciar} carregando={ocupado}>Iniciar relação de {nomeCompetencia(comp)}</Botao>
        </div>
      ) : (
        <>
          {relacao.situacao === 'Devolvida' && relacao.sede_obs && (
            <div className="mt-4">
              <Aviso>A sede devolveu esta relação: {relacao.sede_obs}. Faça os ajustes e envie de novo.</Aviso>
            </div>
          )}
          {!editavel && (
            <p className="mt-4 text-sm text-tinta-suave">
              {relacao.situacao === 'Conferida' ? 'Relação conferida pela sede.' : 'Relação enviada à sede'}
              {relacao.enviada_em && ` (enviada em ${dataHoraBR(relacao.enviada_em)})`}. Para alterar, peça a devolução à sede.
            </p>
          )}

          <div className={`mt-6 grid gap-6 ${editavel ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
            <section className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">
                  <strong>{itens.length}</strong> {itens.length === 1 ? 'funcionário' : 'funcionários'} na relação
                </p>
                <div className="flex items-center gap-2">
                  {itens.length > 8 && (
                    <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar na lista"
                      aria-label="Filtrar na lista" className={`${inputCls} w-48`} />
                  )}
                  <Botao variante="secundario" onClick={() => window.print()}>
                    <Printer className="size-4" aria-hidden /> Imprimir
                  </Botao>
                </div>
              </div>

              <TabelaWrap>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={thCls}>Nome</th>
                      <th className={thCls}>Matrícula</th>
                      <th className={thCls}>Cargo</th>
                      <th className={thCls}>Vínculo</th>
                      <th className={thCls}>Observação</th>
                      {editavel && <th className={thCls}><span className="sr-only">Ações</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.length === 0 && (
                      <tr>
                        <td colSpan={6} className={`${tdCls} py-6 text-center text-tinta-suave`}>
                          {itens.length === 0 ? 'Nenhum funcionário ainda. Use a busca ao lado para adicionar.' : 'Nenhum resultado para o filtro.'}
                        </td>
                      </tr>
                    )}
                    {visiveis.map((i) => (
                      <tr key={i.id} className="hover:bg-papel/50">
                        <td className={`${tdCls} font-medium`}>{i.funcionario_nome}</td>
                        <td className={tdCls}>{i.matricula}</td>
                        <td className={tdCls}>{i.cargo}</td>
                        <td className={tdCls}>{i.vinculo}</td>
                        <td className={`${tdCls} min-w-48`}>
                          {editavel ? (
                            <input
                              defaultValue={i.obs ?? ''}
                              onBlur={(e) => salvarObsItem(i, e.target.value.trim())}
                              placeholder="Ex.: férias de 10 a 20"
                              aria-label={`Observação de ${i.funcionario_nome}`}
                              className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-linha focus:border-tinta focus:bg-white focus:outline-none"
                            />
                          ) : (
                            i.obs
                          )}
                        </td>
                        {editavel && (
                          <td className={`${tdCls} w-10`}>
                            <button type="button" onClick={() => remover(i)} aria-label={`Retirar ${i.funcionario_nome} da relação`}
                              className="rounded p-1.5 text-tinta-suave hover:bg-erro-claro hover:text-erro">
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabelaWrap>
            </section>

            {editavel && (
              <aside className="space-y-4">
                <BuscaFuncionario jaNaLista={idsNaLista} onAdicionar={adicionar} />

                <div className="rounded-lg border border-linha bg-white p-4">
                  <label htmlFor="obs-relacao" className="text-sm font-semibold">Observação para a sede</label>
                  <textarea id="obs-relacao" rows={3} defaultValue={relacao.obs ?? ''}
                    onBlur={(e) => salvarObsRelacao(e.target.value.trim())}
                    className={`${inputCls} mt-2`} />

                  {confirmandoEnvio ? (
                    <div className="mt-4 rounded-md bg-acento-claro p-3">
                      <p className="text-sm">
                        Enviar a relação de <strong>{nomeCompetencia(comp)}</strong> com {itens.length}{' '}
                        {itens.length === 1 ? 'funcionário' : 'funcionários'}? Depois de enviada, só a sede pode devolver para ajuste.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Botao onClick={enviar} carregando={ocupado}>Confirmar envio</Botao>
                        <Botao variante="discreto" onClick={() => setConfirmandoEnvio(false)}>Cancelar</Botao>
                      </div>
                    </div>
                  ) : (
                    <Botao className="mt-4 w-full" onClick={() => setConfirmandoEnvio(true)} disabled={itens.length === 0}>
                      Enviar relação à sede
                    </Botao>
                  )}
                </div>
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  );
}
