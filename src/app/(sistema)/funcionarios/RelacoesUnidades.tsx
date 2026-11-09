'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LogOut, MapPinPlus, Printer, UserMinus, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { competenciaAtual, dataBR, dataHoraBR, hojeISO, mensagemErro, nomeCompetencia } from '@/lib/formato';
import { MOTIVOS_ENCERRAMENTO, type SituacaoRelacao } from '@/lib/constantes';
import { Paginacao, foraDaPagina, usePaginacao } from '@/components/Paginacao';
import { Aviso, Botao, Campo, Selo, SeletorMes, TabelaWrap, inputCls, tdCls, thCls } from '@/components/ui';

type Unidade = { id: string; nome: string; sigla: string | null };
type RelacaoResumo = {
  id: string; unidade_id: string; situacao: SituacaoRelacao; enviada_em: string | null;
  obs: string | null; sede_obs: string | null; relacao_itens: { count: number }[];
};

export default function RelacoesUnidades() {
  const supabase = useMemo(() => createClient(), []);
  const [comp, setComp] = useState(competenciaAtual);
  const [versao, setVersao] = useState(0);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [relacoes, setRelacoes] = useState<RelacaoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<{ unidade: Unidade; relacao: RelacaoResumo } | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [u, r] = await Promise.all([
        supabase.from('unidades').select('id, nome, sigla').eq('ativa', true).order('nome'),
        supabase.from('relacoes_mensais')
          .select('id, unidade_id, situacao, enviada_em, obs, sede_obs, relacao_itens(count)')
          .eq('competencia', comp),
      ]);
      if (!vivo) return;
      setUnidades((u.data as Unidade[]) ?? []);
      setRelacoes((r.data as unknown as RelacaoResumo[]) ?? []);
      setErro(u.error || r.error ? mensagemErro(u.error || r.error) : null);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, comp, versao]);

  const porUnidade = useMemo(() => new Map(relacoes.map((r) => [r.unidade_id, r])), [relacoes]);
  const enviadas = relacoes.filter((r) => r.situacao === 'Enviada').length;
  const conferidas = relacoes.filter((r) => r.situacao === 'Conferida').length;

  if (aberta) {
    return (
      <DetalheRelacao
        unidade={aberta.unidade}
        relacao={aberta.relacao}
        competencia={comp}
        onVoltar={(mudou) => {
          setAberta(null);
          if (mudou) setVersao((v) => v + 1);
        }}
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta-suave" aria-live="polite">
          {carregando ? 'Carregando…' : `${enviadas} aguardando conferência, ${conferidas} conferidas, ${unidades.length} unidades ativas`}
        </p>
        <SeletorMes valor={comp} onChange={(c) => { setCarregando(true); setComp(c); }} />
      </div>

      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}

      <div className="mt-4">
        <TabelaWrap>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={thCls}>Unidade</th>
                <th className={thCls}>Situação</th>
                <th className={thCls}>Funcionários</th>
                <th className={thCls}>Enviada em</th>
                <th className={thCls}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {unidades.map((u) => {
                const r = porUnidade.get(u.id);
                return (
                  <tr key={u.id} className="hover:bg-papel/50">
                    <td className={`${tdCls} font-medium`}>{u.nome}</td>
                    <td className={tdCls}><Selo texto={r?.situacao ?? 'Não iniciada'} /></td>
                    <td className={tdCls}>{r ? r.relacao_itens[0]?.count ?? 0 : ''}</td>
                    <td className={`${tdCls} whitespace-nowrap`}>{dataHoraBR(r?.enviada_em)}</td>
                    <td className={`${tdCls} text-right`}>
                      {r && (
                        <Botao variante={r.situacao === 'Enviada' ? 'primario' : 'secundario'} onClick={() => setAberta({ unidade: u, relacao: r })}>
                          {r.situacao === 'Enviada' ? 'Conferir' : 'Abrir'}
                        </Botao>
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

type Item = { id: string; funcionario_id: string; funcionario_nome: string; matricula: string | null; cargo: string | null; funcao: string | null; vinculo: string | null; obs: string | null };
type Lotado = { id: string; funcionario_id: string; data_inicio: string; funcionario: { nome: string; matricula: string | null } | null };
/** Ajuste rápido aberto no painel lateral */
type Ajuste =
  | { tipo: 'encerrar'; lotado: Lotado; data: string; motivo: string; justificativa: string }
  | { tipo: 'lotar'; item: Item; data: string; ch: string };

function DetalheRelacao({
  unidade, relacao, competencia, onVoltar,
}: {
  unidade: Unidade; relacao: RelacaoResumo; competencia: string; onVoltar: (mudou: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [itens, setItens] = useState<Item[]>([]);
  const [lotados, setLotados] = useState<Lotado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [devolvendo, setDevolvendo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [versao, setVersao] = useState(0);
  const [mudou, setMudou] = useState(false);
  const [ajuste, setAjuste] = useState<Ajuste | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [i, l] = await Promise.all([
        supabase.from('relacao_itens').select('id, funcionario_id, funcionario_nome, matricula, cargo, funcao, vinculo, obs')
          .eq('relacao_id', relacao.id).order('funcionario_nome'),
        supabase.from('lotacoes').select('id, funcionario_id, data_inicio, funcionario:funcionarios(nome, matricula)')
          .eq('unidade_id', unidade.id).eq('situacao', 'Ativa'),
      ]);
      if (!vivo) return;
      setItens((i.data as Item[]) ?? []);
      setLotados((l.data as unknown as Lotado[]) ?? []);
      setErro(i.error || l.error ? mensagemErro(i.error || l.error) : null);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, relacao.id, unidade.id, versao]);

  const idsLotados = useMemo(() => new Set(lotados.map((l) => l.funcionario_id)), [lotados]);
  const idsRelacao = useMemo(() => new Set(itens.map((i) => i.funcionario_id)), [itens]);
  const foraDaRelacao = lotados.filter((l) => !idsRelacao.has(l.funcionario_id));
  const itensSemLotacao = itens.filter((i) => !idsLotados.has(i.funcionario_id));
  const semLotacao = itensSemLotacao.length;
  const pag = usePaginacao(itens, 50, relacao.id);

  // ---------- ajustes rápidos (sem sair da tela) ----------
  const mesRelacao = nomeCompetencia(competencia);
  /** depois de qualquer ajuste: recarrega a tela e avisa a lista de unidades ao voltar */
  function feito(msg: string) {
    setOk(msg);
    setErro(null);
    setAjuste(null);
    setMudou(true);
    setVersao((v) => v + 1);
  }

  async function incluirNaRelacao(l: Lotado) {
    setOcupado(true);
    const { error } = await supabase.from('relacao_itens').insert({ relacao_id: relacao.id, funcionario_id: l.funcionario_id });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    feito(`${l.funcionario?.nome} incluído na relação de ${mesRelacao}.`);
  }

  async function tirarDaRelacao(i: Item) {
    if (!window.confirm(`Tirar ${i.funcionario_nome} da relação de ${mesRelacao}?`)) return;
    setOcupado(true);
    const { error } = await supabase.from('relacao_itens').delete().eq('id', i.id);
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    feito(`${i.funcionario_nome} retirado da relação.`);
  }

  async function confirmarAjuste() {
    if (!ajuste) return;
    if (ajuste.tipo === 'encerrar') {
      const { lotado, data, motivo, justificativa } = ajuste;
      if (!data || !justificativa.trim()) return setErro('Informe a data e a justificativa da saída da unidade.');
      if (data < lotado.data_inicio) return setErro(`A saída não pode ser antes do início da lotação (${dataBR(lotado.data_inicio)}).`);
      setOcupado(true);
      const { error } = await supabase.from('lotacoes').update({
        situacao: 'Encerrada', data_encerramento: data, encerramento_motivo: motivo, encerramento_justificativa: justificativa.trim(),
      }).eq('id', lotado.id);
      setOcupado(false);
      if (error) return setErro(mensagemErro(error));
      feito(`${lotado.funcionario?.nome} saiu de ${unidade.nome} em ${dataBR(data)}. O cadastro e o histórico continuam guardados.`);
    } else {
      const { item, data, ch } = ajuste;
      if (!data) return setErro('Informe a data de início na unidade.');
      setOcupado(true);
      const { error } = await supabase.from('lotacoes').insert({
        funcionario_id: item.funcionario_id, unidade_id: unidade.id, data_inicio: data, carga_horaria: ch ? Number(ch) : null,
      });
      setOcupado(false);
      if (error) return setErro(error.code === '23505' ? 'Este funcionário já está lotado nesta unidade.' : mensagemErro(error));
      feito(`${item.funcionario_nome} lotado em ${unidade.nome} a partir de ${dataBR(data)}. Falta só cadastrar os horários no perfil dele.`);
    }
  }

  /** início sugerido: 1º dia do mês da relação (ou hoje, se o mês ainda não começou) */
  const inicioSugerido = competencia <= hojeISO() ? competencia : hojeISO();

  async function conferir() {
    setOcupado(true);
    const { error } = await supabase.rpc('conferir_relacao', { p_relacao: relacao.id });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    onVoltar(true);
  }

  async function devolver() {
    if (!motivo.trim()) return setErro('Escreva o motivo da devolução para a unidade.');
    setOcupado(true);
    const { error } = await supabase.rpc('devolver_relacao', { p_relacao: relacao.id, p_obs: motivo.trim() });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    onVoltar(true);
  }

  const podeDecidir = relacao.situacao === 'Enviada' || relacao.situacao === 'Conferida';

  return (
    <div>
      <button type="button" onClick={() => onVoltar(mudou)} className="inline-flex items-center gap-1.5 text-sm font-medium text-tinta-suave hover:text-tinta">
        <ArrowLeft className="size-4" aria-hidden /> Todas as unidades
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{unidade.nome}</h2>
          <p className="text-sm text-tinta-suave">
            Relação de {nomeCompetencia(competencia)}
            {relacao.enviada_em && `, enviada em ${dataHoraBR(relacao.enviada_em)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Selo texto={relacao.situacao} />
          <Botao variante="secundario" onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Imprimir</Botao>
        </div>
      </div>

      {relacao.obs && <div className="mt-4"><Aviso tom="info">Observação da unidade: {relacao.obs}</Aviso></div>}
      {relacao.situacao === 'Devolvida' && relacao.sede_obs && <div className="mt-4"><Aviso>Devolvida: {relacao.sede_obs}</Aviso></div>}
      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}
      {ok && <div className="mt-4"><Aviso tom="info">{ok}</Aviso></div>}

      {carregando ? (
        <p className="mt-6 text-sm text-tinta-suave" role="status">Carregando…</p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0">
            <p className="mb-2 text-sm">
              <strong>{itens.length}</strong> na relação
              {semLotacao > 0 && <>, <strong className="text-ocre-escuro">{semLotacao}</strong> sem lotação nesta unidade</>}
            </p>
            <TabelaWrap>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={thCls}>Nome</th>
                    <th className={thCls}>Matrícula</th>
                    <th className={thCls}>Cargo</th>
                    <th className={thCls}>Vínculo</th>
                    <th className={thCls}>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i, n) => (
                    <tr key={i.id} className={foraDaPagina(pag, n)}>
                      <td className={`${tdCls} font-medium`}>
                        {i.funcionario_nome}
                        {!idsLotados.has(i.funcionario_id) && (
                          <span className="ml-2 rounded bg-ocre-claro px-1.5 py-0.5 text-xs font-semibold text-ocre-escuro">sem lotação aqui</span>
                        )}
                      </td>
                      <td className={tdCls}>{i.matricula}</td>
                      <td className={tdCls}>{i.cargo}</td>
                      <td className={tdCls}>{i.vinculo}</td>
                      <td className={tdCls}>{i.obs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaWrap>
            <Paginacao p={pag} rotulo="funcionários" />
          </section>

          <aside className="space-y-4">
            <div className="rounded-lg border border-linha bg-white p-4">
              <h3 className="text-sm font-semibold">Lotados na unidade e fora da relação</h3>
              {foraDaRelacao.length === 0 ? (
                <p className="mt-1 text-sm text-tinta-suave">Todos os lotados estão na relação.</p>
              ) : (
                <ul className="mt-2 divide-y divide-linha/70 text-sm">
                  {foraDaRelacao.map((l) => (
                    <li key={l.id} className="py-2.5">
                      <Link href={`/funcionarios/perfil?id=${l.funcionario_id}`} className="font-medium hover:underline">{l.funcionario?.nome}</Link>
                      {l.funcionario?.matricula && <span className="text-tinta-suave"> ({l.funcionario.matricula})</span>}
                      <span className="block text-xs text-tinta-suave">Lotado aqui desde {dataBR(l.data_inicio)}</span>
                      {ajuste?.tipo === 'encerrar' && ajuste.lotado.id === l.id ? (
                        <div className="mt-2 space-y-2 rounded-md bg-papel/60 p-2.5">
                          <Campo rotulo="Saiu da unidade em">
                            <input type="date" value={ajuste.data} min={l.data_inicio} onChange={(e) => setAjuste({ ...ajuste, data: e.target.value })} className={inputCls} />
                          </Campo>
                          <Campo rotulo="Motivo">
                            <select value={ajuste.motivo} onChange={(e) => setAjuste({ ...ajuste, motivo: e.target.value })} className={inputCls}>
                              {MOTIVOS_ENCERRAMENTO.map((m) => <option key={m}>{m}</option>)}
                            </select>
                          </Campo>
                          <Campo rotulo="Justificativa">
                            <input value={ajuste.justificativa} onChange={(e) => setAjuste({ ...ajuste, justificativa: e.target.value })} className={inputCls} />
                          </Campo>
                          <div className="flex gap-2">
                            <Botao variante="perigo" className="px-3 py-1.5 text-xs" carregando={ocupado} onClick={confirmarAjuste}>Confirmar saída</Botao>
                            <Botao variante="discreto" className="px-3 py-1.5 text-xs" onClick={() => setAjuste(null)}>Cancelar</Botao>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Botao variante="secundario" className="px-2.5 py-1 text-xs" disabled={ocupado} onClick={() => incluirNaRelacao(l)}>
                            <UserPlus className="size-3.5" aria-hidden /> Incluir na relação
                          </Botao>
                          <Botao variante="discreto" className="px-2.5 py-1 text-xs" disabled={ocupado}
                            onClick={() => { setOk(null); setAjuste({ tipo: 'encerrar', lotado: l, data: hojeISO(), motivo: 'Término de atuação na unidade', justificativa: `Não consta na relação de ${mesRelacao} da unidade` }); }}>
                            <LogOut className="size-3.5" aria-hidden /> Tirar da unidade
                          </Botao>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-tinta-suave">
                Incluir na relação: a unidade esqueceu dele. Tirar da unidade: ele não trabalha mais aqui (encerra a lotação; cadastro e histórico continuam).
              </p>
            </div>

            {itensSemLotacao.length > 0 && (
              <div className="rounded-lg border border-ocre/40 bg-white p-4">
                <h3 className="text-sm font-semibold">Na relação e sem lotação nesta unidade</h3>
                <ul className="mt-2 divide-y divide-linha/70 text-sm">
                  {itensSemLotacao.map((i) => (
                    <li key={i.id} className="py-2.5">
                      <Link href={`/funcionarios/perfil?id=${i.funcionario_id}`} className="font-medium hover:underline">{i.funcionario_nome}</Link>
                      {i.matricula && <span className="text-tinta-suave"> ({i.matricula})</span>}
                      {ajuste?.tipo === 'lotar' && ajuste.item.id === i.id ? (
                        <div className="mt-2 space-y-2 rounded-md bg-papel/60 p-2.5">
                          <Campo rotulo={`Começou em ${unidade.nome} em`}>
                            <input type="date" value={ajuste.data} onChange={(e) => setAjuste({ ...ajuste, data: e.target.value })} className={inputCls} />
                          </Campo>
                          <Campo rotulo="CH semanal na unidade (opcional)">
                            <input type="number" min={0} max={80} value={ajuste.ch} onChange={(e) => setAjuste({ ...ajuste, ch: e.target.value })} className={inputCls} />
                          </Campo>
                          <div className="flex gap-2">
                            <Botao className="px-3 py-1.5 text-xs" carregando={ocupado} onClick={confirmarAjuste}>Confirmar lotação</Botao>
                            <Botao variante="discreto" className="px-3 py-1.5 text-xs" onClick={() => setAjuste(null)}>Cancelar</Botao>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Botao variante="secundario" className="px-2.5 py-1 text-xs" disabled={ocupado}
                            onClick={() => { setOk(null); setAjuste({ tipo: 'lotar', item: i, data: inicioSugerido, ch: '' }); }}>
                            <MapPinPlus className="size-3.5" aria-hidden /> Lotar nesta unidade
                          </Botao>
                          <Botao variante="discreto" className="px-2.5 py-1 text-xs" disabled={ocupado} onClick={() => tirarDaRelacao(i)}>
                            <UserMinus className="size-3.5" aria-hidden /> Tirar da relação
                          </Botao>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-tinta-suave">
                  Lotar: ele trabalha aqui e faltava no cadastro (depois, cadastre os horários no perfil). Tirar da relação: entrou por engano.
                </p>
              </div>
            )}

            {podeDecidir && (
              <div className="rounded-lg border border-linha bg-white p-4">
                {devolvendo ? (
                  <>
                    <label htmlFor="motivo" className="text-sm font-semibold">Motivo da devolução</label>
                    <textarea id="motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus className={`${inputCls} mt-2`} />
                    <div className="mt-3 flex gap-2">
                      <Botao variante="perigo" onClick={devolver} carregando={ocupado}>Devolver à unidade</Botao>
                      <Botao variante="discreto" onClick={() => setDevolvendo(false)}>Cancelar</Botao>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    {relacao.situacao === 'Enviada' && <Botao onClick={conferir} carregando={ocupado}>Marcar como conferida</Botao>}
                    <Botao variante="secundario" onClick={() => setDevolvendo(true)}>Devolver para ajuste</Botao>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
