'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DIAS_SEMANA, FREQUENCIAS, MOTIVOS_ENCERRAMENTO } from '@/lib/constantes';
import { dataBR, hojeISO, mensagemErro } from '@/lib/formato';
import { conflitosDoHorario, textoConflito, todosConflitos, type LotacaoBase } from '@/lib/escalas';
import { Aviso, Botao, Campo, campoCls, inputCls, tdCls, thCls } from '@/components/ui';
import type { UnidadeOpcao } from '../FormFuncionario';
import AtalhosHorario, { type LinhaRapida } from '@/components/AtalhosHorario';

type Horario = { id: string; dia_semana: string | null; frequencia: string; entrada: string | null; saida: string | null; data_referencia: string | null; obs: string | null };
type Lotacao = {
  id: string; unidade_id: string; carga_horaria: number | null; situacao: 'Ativa' | 'Encerrada'; data_inicio: string;
  data_encerramento: string | null; encerramento_motivo: string | null; encerramento_justificativa: string | null;
  obs: string | null; unidade: { nome: string } | null; horarios: Horario[];
};

const HOR_VAZIO = { dia_semana: 'Segunda-feira', frequencia: 'Semanal', entrada: '', saida: '', data_referencia: '', obs: '' };
const ENC_VAZIO = { data: hojeISO(), motivo: MOTIVOS_ENCERRAMENTO[0], justificativa: '' };

export default function LotacoesEscalas({ funcionarioId, unidades }: { funcionarioId: string; unidades: UnidadeOpcao[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [lotacoes, setLotacoes] = useState<Lotacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [ocupado, setOcupado] = useState(false);

  const [nova, setNova] = useState({ unidade_id: '', carga_horaria: '', data_inicio: hojeISO() });
  const [encerrando, setEncerrando] = useState<string | null>(null);
  const [enc, setEnc] = useState(ENC_VAZIO);
  const [novoHor, setNovoHor] = useState<Record<string, typeof HOR_VAZIO>>({});

  useEffect(() => {
    let vivo = true;
    supabase.from('lotacoes')
      .select('id, unidade_id, carga_horaria, situacao, data_inicio, data_encerramento, encerramento_motivo, encerramento_justificativa, obs, unidade:unidades(nome), horarios(id, dia_semana, frequencia, entrada, saida, data_referencia, obs)')
      .eq('funcionario_id', funcionarioId)
      .order('situacao').order('data_inicio', { ascending: false })
      .then(({ data, error }) => {
        if (!vivo) return;
        setLotacoes((data as unknown as Lotacao[]) ?? []);
        setErro(error ? mensagemErro(error) : null);
        setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [supabase, funcionarioId, versao]);

  /** Executa e recarrega */
  async function fazer(acao: () => PromiseLike<{ error: { message?: string; code?: string } | null }>, depois?: () => void) {
    setOcupado(true);
    const { error } = await acao();
    setOcupado(false);
    if (error) return setErro(error.code === '23505' ? 'O funcionário já tem lotação ativa nessa unidade.' : mensagemErro(error));
    setErro(null);
    depois?.();
    setVersao((v) => v + 1);
  }

  const ativas = new Set(lotacoes.filter((l) => l.situacao === 'Ativa').map((l) => l.unidade_id));
  // Escalas no formato de comparação (mesmo dia e horário em duas unidades)
  const base: LotacaoBase[] = lotacoes.map((l) => ({ chave: l.id, unidade: l.unidade?.nome ?? '', ativa: l.situacao === 'Ativa', horarios: l.horarios }));
  const choques = todosConflitos(base);

  function adicionarLotacao() {
    if (!nova.unidade_id) return setErro('Escolha a unidade.');
    fazer(() => supabase.from('lotacoes').insert({
      funcionario_id: funcionarioId, unidade_id: nova.unidade_id,
      carga_horaria: nova.carga_horaria ? Number(nova.carga_horaria) : null, data_inicio: nova.data_inicio || hojeISO(),
    }), () => setNova({ unidade_id: '', carga_horaria: '', data_inicio: hojeISO() }));
  }

  function encerrar(l: Lotacao) {
    if (!enc.data || !enc.justificativa.trim()) return setErro('Informe a data e a justificativa do encerramento.');
    if (enc.data < l.data_inicio) return setErro('O encerramento não pode ser antes do início da lotação.');
    fazer(() => supabase.from('lotacoes').update({
      situacao: 'Encerrada', data_encerramento: enc.data, encerramento_motivo: enc.motivo, encerramento_justificativa: enc.justificativa.trim(),
    }).eq('id', l.id), () => { setEncerrando(null); setEnc(ENC_VAZIO); });
  }

  function excluirLotacao(l: Lotacao) {
    if (!window.confirm(`Excluir a lotação em ${l.unidade?.nome} e os horários dela? Use isso só para corrigir um cadastro errado. Para saída da unidade, use "Encerrar".`)) return;
    fazer(() => supabase.from('lotacoes').delete().eq('id', l.id));
  }

  function adicionarHorario(l: Lotacao) {
    const h = novoHor[l.id] ?? HOR_VAZIO;
    if (h.frequencia === 'Datas específicas' && !h.data_referencia) return setErro('Informe a data do horário.');
    const novo = { dia_semana: h.frequencia === 'Datas específicas' ? null : h.dia_semana, data_referencia: h.data_referencia || null, entrada: h.entrada, saida: h.saida };
    const outras = conflitosDoHorario(novo, l.id, base);
    if (outras.length && !window.confirm(`${textoConflito(novo, outras)}\n\nSalvar mesmo assim?`)) return;
    fazer(() => supabase.from('horarios').insert({
      lotacao_id: l.id, frequencia: h.frequencia,
      dia_semana: h.frequencia === 'Datas específicas' ? null : h.dia_semana,
      entrada: h.entrada || null, saida: h.saida || null, data_referencia: h.data_referencia || null, obs: h.obs.trim() || null,
    }), () => setNovoHor((x) => ({ ...x, [l.id]: HOR_VAZIO })));
  }

  /** Preencher rápido: um horário por dia escolhido; dia que já tem horário semanal é atualizado */
  function adicionarVarios(l: Lotacao, linhas: LinhaRapida[]) {
    const choquesNovos = linhas.flatMap((x) => {
      const novo = { dia_semana: x.dia_semana, data_referencia: null, entrada: x.entrada, saida: x.saida };
      const outras = conflitosDoHorario(novo, l.id, base);
      return outras.length ? [textoConflito(novo, outras)] : [];
    });
    if (choquesNovos.length && !window.confirm(`${choquesNovos.join('\n')}\n\nSalvar mesmo assim?`)) return;
    const dias = linhas.map((x) => x.dia_semana);
    const substituir = l.horarios.filter((h) => h.frequencia === 'Semanal' && h.dia_semana && dias.includes(h.dia_semana)).map((h) => h.id);
    fazer(async () => {
      if (substituir.length) {
        const r = await supabase.from('horarios').delete().in('id', substituir);
        if (r.error) return r;
      }
      return supabase.from('horarios').insert(linhas.map((x) => ({
        lotacao_id: l.id, frequencia: 'Semanal', dia_semana: x.dia_semana, entrada: x.entrada, saida: x.saida,
      })));
    });
  }

  if (carregando) return <p className="text-sm text-tinta-suave" role="status">Carregando…</p>;

  return (
    <div className="space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      {choques.length > 0 && (
        <Aviso>
          Conflito de escala: o funcionário está em mais de uma unidade no mesmo horário ({choques.join('; ')}).
          Trabalhar de manhã numa unidade e à tarde em outra pode; no mesmo horário, não. Ajuste as escalas.
        </Aviso>
      )}
      {lotacoes.length === 0 && <p className="text-sm text-tinta-suave">Nenhuma lotação cadastrada.</p>}

      {lotacoes.map((l) => {
        const h = novoHor[l.id] ?? HOR_VAZIO;
        const setH = (p: Partial<typeof HOR_VAZIO>) => setNovoHor((x) => ({ ...x, [l.id]: { ...h, ...p } }));
        const ativa = l.situacao === 'Ativa';
        return (
          <section key={l.id} className={`rounded-lg border bg-white ${ativa ? 'border-linha' : 'border-dashed border-linha opacity-80'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha px-4 py-3">
              <div>
                <h3 className="font-bold">{l.unidade?.nome}</h3>
                <p className="text-xs text-tinta-suave">
                  {ativa ? 'Ativa' : 'Encerrada'} desde {dataBR(ativa ? l.data_inicio : l.data_encerramento)}
                  {!ativa && ` (início em ${dataBR(l.data_inicio)})`}
                  {l.carga_horaria ? `, ${l.carga_horaria}h semanais` : ''}
                </p>
                {!ativa && <p className="mt-0.5 text-xs text-tinta-suave">{l.encerramento_motivo}: {l.encerramento_justificativa}</p>}
              </div>
              <div className="flex gap-1">
                {ativa && encerrando !== l.id && <Botao variante="secundario" onClick={() => { setEncerrando(l.id); setEnc(ENC_VAZIO); }}>Encerrar lotação</Botao>}
                <button type="button" title="Excluir lotação" onClick={() => excluirLotacao(l)}
                  className="rounded p-2 text-tinta-suave hover:bg-erro-claro hover:text-erro"><Trash2 className="size-4" /></button>
              </div>
            </div>

            {encerrando === l.id && (
              <div className="grid gap-3 border-b border-linha bg-acento-claro/30 px-4 py-3 sm:grid-cols-[10rem_14rem_1fr_auto] sm:items-end">
                <Campo rotulo="Data do encerramento">
                  <input type="date" value={enc.data} onChange={(e) => setEnc({ ...enc, data: e.target.value })} className={inputCls} />
                </Campo>
                <Campo rotulo="Motivo">
                  <select value={enc.motivo} onChange={(e) => setEnc({ ...enc, motivo: e.target.value })} className={inputCls}>
                    {MOTIVOS_ENCERRAMENTO.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Justificativa *">
                  <input value={enc.justificativa} autoFocus onChange={(e) => setEnc({ ...enc, justificativa: e.target.value })} className={inputCls} />
                </Campo>
                <div className="flex gap-1">
                  <Botao carregando={ocupado} onClick={() => encerrar(l)}>Confirmar</Botao>
                  <Botao variante="discreto" onClick={() => setEncerrando(null)}>Cancelar</Botao>
                </div>
              </div>
            )}

            <div className="overflow-x-auto px-4 py-3">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={thCls}>Frequência</th><th className={thCls}>Dia / Data</th>
                    <th className={thCls}>Entrada</th><th className={thCls}>Saída</th><th className={thCls}>Obs.</th>
                    <th className={thCls}><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {l.horarios.length === 0 && (
                    <tr><td colSpan={6} className={`${tdCls} text-tinta-suave`}>Nenhum horário cadastrado.</td></tr>
                  )}
                  {l.horarios.map((x) => {
                    const outras = ativa ? conflitosDoHorario(x, l.id, base) : [];
                    return (
                    <tr key={x.id} className={outras.length ? 'bg-erro-claro/60' : ''}>
                      <td className={tdCls}>{x.frequencia}</td>
                      <td className={tdCls}>
                        {x.dia_semana ?? dataBR(x.data_referencia)}
                        {outras.length > 0 && <span className="block text-xs font-semibold text-erro">mesmo horário em {outras.join(' e ')}</span>}
                      </td>
                      <td className={tdCls}>{x.entrada?.slice(0, 5)}</td>
                      <td className={tdCls}>{x.saida?.slice(0, 5)}</td>
                      <td className={tdCls}>{x.obs}</td>
                      <td className={`${tdCls} w-10`}>
                        <button type="button" title="Excluir horário" onClick={() => fazer(() => supabase.from('horarios').delete().eq('id', x.id))}
                          className="rounded p-1.5 text-tinta-suave hover:bg-erro-claro hover:text-erro"><Trash2 className="size-4" /></button>
                      </td>
                    </tr>
                    );
                  })}
                  {ativa && (
                    <tr className="bg-papel/50">
                      <td className={tdCls}>
                        <select value={h.frequencia} onChange={(e) => setH({ frequencia: e.target.value })} aria-label="Frequência" className={campoCls}>
                          {FREQUENCIAS.map((fq) => <option key={fq}>{fq}</option>)}
                        </select>
                      </td>
                      <td className={tdCls}>
                        {h.frequencia === 'Datas específicas' ? (
                          <input type="date" value={h.data_referencia} onChange={(e) => setH({ data_referencia: e.target.value })} aria-label="Data" className={campoCls} />
                        ) : (
                          <select value={h.dia_semana} onChange={(e) => setH({ dia_semana: e.target.value })} aria-label="Dia" className={campoCls}>
                            {DIAS_SEMANA.map((d) => <option key={d}>{d}</option>)}
                          </select>
                        )}
                      </td>
                      <td className={tdCls}><input type="time" value={h.entrada} onChange={(e) => setH({ entrada: e.target.value })} aria-label="Entrada" className={campoCls} /></td>
                      <td className={tdCls}><input type="time" value={h.saida} onChange={(e) => setH({ saida: e.target.value })} aria-label="Saída" className={campoCls} /></td>
                      <td className={tdCls}><input value={h.obs} onChange={(e) => setH({ obs: e.target.value })} aria-label="Observação" placeholder="Obs." className={`${campoCls} w-full min-w-32`} /></td>
                      <td className={tdCls}>
                        <button type="button" title="Adicionar horário" disabled={ocupado} onClick={() => adicionarHorario(l)}
                          className="rounded bg-acento p-1.5 text-white hover:bg-acento-escuro disabled:opacity-50"><Plus className="size-4" /></button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {ativa && (
                <div className="mt-3">
                  <AtalhosHorario ocupado={ocupado} onAplicar={(linhas) => adicionarVarios(l, linhas)} />
                </div>
              )}
            </div>
          </section>
        );
      })}

      <section className="rounded-lg border border-dashed border-linha bg-white p-4">
        <h3 className="text-sm font-bold">Nova lotação</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_8rem_10rem_auto] sm:items-end">
          <Campo rotulo="Unidade">
            <select value={nova.unidade_id} onChange={(e) => setNova({ ...nova, unidade_id: e.target.value })} className={inputCls}>
              <option value="">Selecione</option>
              {unidades.filter((u) => !ativas.has(u.id)).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="CH semanal">
            <input type="number" min={0} value={nova.carga_horaria} onChange={(e) => setNova({ ...nova, carga_horaria: e.target.value })} className={inputCls} />
          </Campo>
          <Campo rotulo="Início">
            <input type="date" value={nova.data_inicio} onChange={(e) => setNova({ ...nova, data_inicio: e.target.value })} className={inputCls} />
          </Campo>
          <Botao carregando={ocupado} onClick={adicionarLotacao}><Plus className="size-4" aria-hidden /> Adicionar</Botao>
        </div>
      </section>
    </div>
  );
}
