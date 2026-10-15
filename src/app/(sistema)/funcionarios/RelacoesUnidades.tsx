'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { competenciaAtual, dataHoraBR, mensagemErro, nomeCompetencia } from '@/lib/formato';
import type { SituacaoRelacao } from '@/lib/constantes';
import { Aviso, Botao, Selo, SeletorMes, TabelaWrap, inputCls, tdCls, thCls } from '@/components/ui';

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
type Lotado = { funcionario_id: string; funcionario: { nome: string; matricula: string | null } | null };

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

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [i, l] = await Promise.all([
        supabase.from('relacao_itens').select('id, funcionario_id, funcionario_nome, matricula, cargo, funcao, vinculo, obs')
          .eq('relacao_id', relacao.id).order('funcionario_nome'),
        supabase.from('lotacoes').select('funcionario_id, funcionario:funcionarios(nome, matricula)')
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
  }, [supabase, relacao.id, unidade.id]);

  const idsLotados = useMemo(() => new Set(lotados.map((l) => l.funcionario_id)), [lotados]);
  const idsRelacao = useMemo(() => new Set(itens.map((i) => i.funcionario_id)), [itens]);
  const foraDaRelacao = lotados.filter((l) => !idsRelacao.has(l.funcionario_id));
  const semLotacao = itens.filter((i) => !idsLotados.has(i.funcionario_id)).length;

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
      <button type="button" onClick={() => onVoltar(false)} className="inline-flex items-center gap-1.5 text-sm font-medium text-tinta-suave hover:text-tinta">
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
                  {itens.map((i) => (
                    <tr key={i.id}>
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
          </section>

          <aside className="space-y-4">
            <div className="rounded-lg border border-linha bg-white p-4">
              <h3 className="text-sm font-semibold">Lotados na unidade e fora da relação</h3>
              {foraDaRelacao.length === 0 ? (
                <p className="mt-1 text-sm text-tinta-suave">Todos os lotados estão na relação.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {foraDaRelacao.map((l) => (
                    <li key={l.funcionario_id}>
                      {l.funcionario?.nome}
                      {l.funcionario?.matricula && <span className="text-tinta-suave"> ({l.funcionario.matricula})</span>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-tinta-suave">Use isso para decidir se ajusta a lotação no cadastro ou devolve a relação.</p>
            </div>

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
