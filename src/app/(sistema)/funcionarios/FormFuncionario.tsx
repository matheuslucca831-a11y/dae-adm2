'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DIAS_SEMANA, FREQUENCIAS } from '@/lib/constantes';
import { mensagemErro } from '@/lib/formato';
import { registrarAcesso } from '@/lib/acessos';
import { Aviso, Botao, Campo, inputCls } from '@/components/ui';
import FichaProfissional, { FICHA_VAZIA, fichaDoBanco, fichaParaBanco, validarFicha, type FichaDados } from '@/components/ficha/FichaProfissional';
import AtalhosHorario, { SeletorAtalho, juntarLinhas } from '@/components/AtalhosHorario';
import { DESTINOS_1DOC } from '@/lib/lancamentos';
import { todosConflitos, type LotacaoBase } from '@/lib/escalas';

export type UnidadeOpcao = { id: string; nome: string; sigla: string | null; cnes?: string | null };

type Dados = FichaDados & {
  obs: string; situacao: 'Ativo' | 'Inativo'; inativo_justificativa: string; exige_1doc: boolean; destino_1doc: string;
};
type HorarioForm = { chave: number; dia_semana: string; frequencia: string; entrada: string; saida: string; data_referencia: string };
type LotacaoForm = { chave: number; unidade_id: string; carga_horaria: string; data_inicio: string; horarios: HorarioForm[] };
type LotacaoExistente = {
  id: string; situacao: string; data_inicio: string; carga_horaria: number | null;
  unidade: { nome: string } | null;
  horarios: { dia_semana: string | null; frequencia: string; entrada: string | null; saida: string | null; data_referencia: string | null }[];
};

const VAZIO: Dados = {
  ...FICHA_VAZIA, obs: '', situacao: 'Ativo', inativo_justificativa: '', exige_1doc: false, destino_1doc: '',
};

let seq = 0;
const novaChave = () => ++seq;
const novoHorario = (): HorarioForm => ({ chave: novaChave(), dia_semana: 'Segunda-feira', frequencia: 'Semanal', entrada: '', saida: '', data_referencia: '' });
const hoje = () => new Date().toISOString().slice(0, 10);

/** '' vira null; números viram número */
function paraBanco(d: Dados) {
  return {
    ...fichaParaBanco(d), obs: d.obs.trim() || null, exige_1doc: d.exige_1doc,
    destino_1doc: d.exige_1doc ? d.destino_1doc.trim() || null : null,
  };
}

export default function FormFuncionario({
  funcionarioId, unidades, vinculos, onFechar, onSalvo, mostrarLotacoes = true,
}: {
  funcionarioId: string | null; unidades: UnidadeOpcao[]; vinculos: string[]; mostrarLotacoes?: boolean;
  onFechar: () => void; onSalvo: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const editando = !!funcionarioId;
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [existentes, setExistentes] = useState<LotacaoExistente[]>([]);
  const [novas, setNovas] = useState<LotacaoForm[]>([]);
  const [carregando, setCarregando] = useState(editando);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  useEffect(() => {
    if (!funcionarioId) return;
    registrarAcesso(supabase, funcionarioId, 'Edição do cadastro');
    let vivo = true;
    (async () => {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('*, lotacoes(id, situacao, data_inicio, carga_horaria, unidade:unidades(nome), horarios(dia_semana, frequencia, entrada, saida, data_referencia))')
        .eq('id', funcionarioId)
        .single();
      if (!vivo) return;
      if (error || !data) {
        setErro(mensagemErro(error));
      } else {
        setDados({
          ...VAZIO, ...fichaDoBanco(data),
          obs: data.obs ?? '', situacao: data.situacao, inativo_justificativa: data.inativo_justificativa ?? '',
          exige_1doc: !!data.exige_1doc, destino_1doc: data.destino_1doc ?? '',
        });
        setExistentes((data.lotacoes as unknown as LotacaoExistente[]) ?? []);
      }
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, funcionarioId]);

  const set = <K extends keyof Dados>(k: K, v: Dados[K]) => setDados((d) => ({ ...d, [k]: v }));
  const setLot = (chave: number, patch: Partial<LotacaoForm>) =>
    setNovas((l) => l.map((x) => (x.chave === chave ? { ...x, ...patch } : x)));
  const setHor = (lot: LotacaoForm, chave: number, patch: Partial<HorarioForm>) =>
    setLot(lot.chave, { horarios: lot.horarios.map((h) => (h.chave === chave ? { ...h, ...patch } : h)) });

  function validar(): string | null {
    const ficha = validarFicha(dados, { completa: !editando });
    if (ficha) return ficha;
    if (dados.situacao === 'Inativo' && !dados.inativo_justificativa.trim()) return 'Escreva a justificativa da inativação.';
    if (novas.some((l) => !l.unidade_id)) return 'Escolha a unidade de cada lotação.';
    if (new Set(novas.map((l) => l.unidade_id)).size !== novas.length) return 'Há duas lotações na mesma unidade.';
    return null;
  }

  const lotacoesJson = () =>
    novas.map((l) => ({
      unidade_id: l.unidade_id, carga_horaria: l.carga_horaria, data_inicio: l.data_inicio,
      horarios: l.horarios.map(({ dia_semana, frequencia, entrada, saida, data_referencia }) => ({
        dia_semana: frequencia === 'Datas específicas' ? '' : dia_semana, frequencia, entrada, saida, data_referencia,
      })),
    }));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const problema = validar();
    if (problema) return setErro(problema);
    // Mesmo dia e mesmo horário em duas unidades
    const nomeUn = (id: string) => unidades.find((u) => u.id === id)?.nome ?? '';
    const base: LotacaoBase[] = [
      ...existentes.map((x) => ({ chave: x.id, unidade: x.unidade?.nome ?? '', ativa: x.situacao === 'Ativa', horarios: x.horarios })),
      ...novas.map((x) => ({
        chave: `n${x.chave}`, unidade: nomeUn(x.unidade_id), ativa: true,
        horarios: x.horarios.map((h) => ({ dia_semana: h.frequencia === 'Datas específicas' ? null : h.dia_semana, data_referencia: h.data_referencia || null, entrada: h.entrada, saida: h.saida })),
      })),
    ];
    const choques = todosConflitos(base);
    if (choques.length && !window.confirm(
      `Atenção: o funcionário ficaria em duas unidades no mesmo horário (${choques.join('; ')}). ` +
      'O mesmo funcionário não pode estar em duas unidades no mesmo horário.\n\nSalvar mesmo assim?')) return;
    setErro(null);
    setSalvando(true);

    if (!editando) {
      const { error } = await supabase.rpc('criar_funcionario', { p_funcionario: paraBanco(dados), p_lotacoes: lotacoesJson() });
      setSalvando(false);
      if (error) return setErro(mensagemErro(error));
      return onSalvo();
    }

    const { error } = await supabase
      .from('funcionarios')
      .update({
        ...paraBanco(dados),
        situacao: dados.situacao,
        inativo_justificativa: dados.situacao === 'Inativo' ? dados.inativo_justificativa.trim() : null,
      })
      .eq('id', funcionarioId);
    if (error) {
      setSalvando(false);
      return setErro(error.code === '23505' ? 'Já existe um funcionário cadastrado com este CPF.' : mensagemErro(error));
    }

    for (const l of lotacoesJson()) {
      const { data: lot, error: e1 } = await supabase
        .from('lotacoes')
        .insert({ funcionario_id: funcionarioId, unidade_id: l.unidade_id, carga_horaria: l.carga_horaria ? Number(l.carga_horaria) : null, data_inicio: l.data_inicio || hoje() })
        .select('id')
        .single();
      if (e1) {
        setSalvando(false);
        return setErro(e1.code === '23505' ? 'O funcionário já tem lotação ativa nessa unidade.' : mensagemErro(e1));
      }
      if (l.horarios.length) {
        const { error: e2 } = await supabase.from('horarios').insert(
          l.horarios.map((h) => ({
            lotacao_id: lot.id, dia_semana: h.dia_semana || null, frequencia: h.frequencia,
            entrada: h.entrada || null, saida: h.saida || null, data_referencia: h.data_referencia || null,
          }))
        );
        if (e2) {
          setSalvando(false);
          return setErro(mensagemErro(e2));
        }
      }
    }
    setSalvando(false);
    onSalvo();
  }

  const unidadesLivres = (atual: string) => {
    const ativas = new Set(existentes.filter((x) => x.situacao === 'Ativa').map((x) => x.unidade?.nome));
    const escolhidas = new Set(novas.map((l) => l.unidade_id).filter((id) => id !== atual));
    return unidades.filter((u) => !ativas.has(u.nome) && !escolhidas.has(u.id));
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-tinta/40" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-form"
        onSubmit={salvar}
        className="flex h-full w-full max-w-3xl flex-col bg-papel shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-linha bg-white px-6 py-4">
          <h2 id="titulo-form" className="text-lg font-bold">{editando ? 'Editar funcionário' : 'Novo funcionário'}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded p-1.5 text-tinta-suave hover:bg-papel hover:text-tinta">
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {carregando ? (
            <p className="text-sm text-tinta-suave" role="status">Carregando…</p>
          ) : (
            <>
              <FichaProfissional valor={dados} onChange={(p) => setDados((d) => ({ ...d, ...p }))} vinculos={vinculos} completa={!editando} />
              {editando && <p className="-mt-3 text-xs text-tinta-suave">Cadastro antigo pode ficar com campos em branco; complete quando tiver a ficha.</p>}

              <fieldset className="rounded-lg border border-linha bg-white p-4">
                <legend className="px-1 text-sm font-bold">Outras informações</legend>
                <div className="grid gap-3 sm:grid-cols-6">
                  <label className="flex items-center gap-2 text-sm sm:col-span-2 sm:mt-6">
                    <input type="checkbox" checked={dados.exige_1doc}
                      onChange={(e) => setDados((d) => ({ ...d, exige_1doc: e.target.checked, destino_1doc: e.target.checked ? d.destino_1doc || DESTINOS_1DOC[0] : '' }))}
                      className="size-4 accent-[var(--acento)]" />
                    Exige comunicação 1Doc
                  </label>
                  {dados.exige_1doc && (
                    <Campo rotulo="Destino 1Doc" className="sm:col-span-4" dica="Unidades onde atende: avisa todas as unidades em que o funcionário tem lotação ativa.">
                      <select value={dados.destino_1doc} onChange={(e) => set('destino_1doc', e.target.value)} className={inputCls}>
                        {DESTINOS_1DOC.map((d) => <option key={d}>{d}</option>)}
                      </select>
                    </Campo>
                  )}
                </div>
                <Campo rotulo="Observações" className="mt-3">
                  <textarea rows={2} value={dados.obs} onChange={(e) => set('obs', e.target.value)} className={inputCls} />
                </Campo>
              </fieldset>

              {editando && (
                <fieldset className="rounded-lg border border-linha bg-white p-4">
                  <legend className="px-1 text-sm font-bold">Situação</legend>
                  <div className="grid gap-3 sm:grid-cols-6">
                    <Campo rotulo="Situação" className="sm:col-span-2">
                      <select value={dados.situacao} onChange={(e) => set('situacao', e.target.value as Dados['situacao'])} className={inputCls}>
                        <option>Ativo</option>
                        <option>Inativo</option>
                      </select>
                    </Campo>
                    {dados.situacao === 'Inativo' && (
                      <Campo rotulo="Justificativa *" className="sm:col-span-4">
                        <input value={dados.inativo_justificativa} onChange={(e) => set('inativo_justificativa', e.target.value)} className={inputCls} />
                      </Campo>
                    )}
                  </div>
                </fieldset>
              )}

              {mostrarLotacoes && (
              <fieldset className="rounded-lg border border-linha bg-white p-4">
                <legend className="px-1 text-sm font-bold">Identificação da unidade (lotações e escalas)</legend>

                {existentes.length > 0 && (
                  <ul className="mb-4 space-y-2">
                    {existentes.map((l) => (
                      <li key={l.id} className="rounded-md border border-linha px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong>{l.unidade?.nome}</strong>
                          <span className={l.situacao === 'Ativa' ? 'text-pinho-escuro' : 'text-tinta-suave'}>
                            {l.situacao}{l.carga_horaria ? `, ${l.carga_horaria}h` : ''}
                          </span>
                        </div>
                        {l.horarios.length > 0 && (
                          <p className="mt-1 text-xs text-tinta-suave">
                            {l.horarios.map((h) => `${h.dia_semana ?? h.data_referencia ?? h.frequencia} ${h.entrada?.slice(0, 5) ?? ''}–${h.saida?.slice(0, 5) ?? ''}`).join('; ')}
                          </p>
                        )}
                      </li>
                    ))}
                    <li className="text-xs text-tinta-suave">Para encerrar uma lotação ou mudar escalas, abra o perfil do funcionário.</li>
                  </ul>
                )}

                {novas.length === 0 && existentes.length === 0 && (
                  <p className="mb-3 text-sm text-tinta-suave">
                    Opcional. Sem lotação, o funcionário fica no cadastro e a unidade pode incluí-lo na relação do mês.
                  </p>
                )}

                <div className="space-y-4">
                  {novas.map((lot) => (
                    <div key={lot.chave} className="rounded-md border border-acento/30 bg-acento-claro/30 p-3">
                      <div className="grid gap-3 sm:grid-cols-6">
                        <Campo rotulo="Unidade *" className="sm:col-span-3"
                          dica={lot.unidade_id ? `CNES: ${unidades.find((u) => u.id === lot.unidade_id)?.cnes || 'não cadastrado (Administração > Unidades)'}` : undefined}>
                          <select value={lot.unidade_id} onChange={(e) => setLot(lot.chave, { unidade_id: e.target.value })} className={inputCls}>
                            <option value="">Selecione</option>
                            {unidadesLivres(lot.unidade_id).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                          </select>
                        </Campo>
                        <Campo rotulo="CH semanal na unidade" className="sm:col-span-1">
                          <input type="number" min={0} value={lot.carga_horaria} onChange={(e) => setLot(lot.chave, { carga_horaria: e.target.value })} className={inputCls} />
                        </Campo>
                        <Campo rotulo="Início na unidade" className="sm:col-span-2">
                          <input type="date" value={lot.data_inicio} onChange={(e) => setLot(lot.chave, { data_inicio: e.target.value })} className={inputCls} />
                        </Campo>
                      </div>

                      <div className="mt-3 space-y-2">
                        <AtalhosHorario onAplicar={(linhas) => setLot(lot.chave, {
                          horarios: juntarLinhas(lot.horarios, linhas, (l) => ({ ...novoHorario(), ...l })),
                        })} />
                        {lot.horarios.map((h) => (
                          <div key={h.chave} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_6rem_6rem_9rem_auto] sm:items-end">
                            <Campo rotulo="Frequência">
                              <select value={h.frequencia} onChange={(e) => setHor(lot, h.chave, { frequencia: e.target.value })} className={inputCls}>
                                {FREQUENCIAS.map((f) => <option key={f}>{f}</option>)}
                              </select>
                            </Campo>
                            {h.frequencia === 'Datas específicas' ? (
                              <Campo rotulo="Data">
                                <input type="date" value={h.data_referencia} onChange={(e) => setHor(lot, h.chave, { data_referencia: e.target.value })} className={inputCls} />
                              </Campo>
                            ) : (
                              <Campo rotulo="Dia">
                                <select value={h.dia_semana} onChange={(e) => setHor(lot, h.chave, { dia_semana: e.target.value })} className={inputCls}>
                                  {DIAS_SEMANA.map((d) => <option key={d}>{d}</option>)}
                                </select>
                              </Campo>
                            )}
                            <Campo rotulo="Entrada">
                              <input type="time" value={h.entrada} onChange={(e) => setHor(lot, h.chave, { entrada: e.target.value })} className={inputCls} />
                            </Campo>
                            <Campo rotulo="Saída">
                              <input type="time" value={h.saida} onChange={(e) => setHor(lot, h.chave, { saida: e.target.value })} className={inputCls} />
                            </Campo>
                            <Campo rotulo="Atalho">
                              <SeletorAtalho className={inputCls} onEscolher={(a) => setHor(lot, h.chave, { entrada: a.entrada, saida: a.saida })} />
                            </Campo>
                            <button type="button" aria-label="Remover horário"
                              onClick={() => setLot(lot.chave, { horarios: lot.horarios.filter((x) => x.chave !== h.chave) })}
                              className="justify-self-start rounded p-2 text-tinta-suave hover:bg-erro-claro hover:text-erro">
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Botao variante="secundario" onClick={() => setLot(lot.chave, { horarios: [...lot.horarios, novoHorario()] })}>
                          <Plus className="size-4" aria-hidden /> Horário
                        </Botao>
                        <Botao variante="discreto" onClick={() => setNovas((l) => l.filter((x) => x.chave !== lot.chave))}>
                          Remover lotação
                        </Botao>
                      </div>
                    </div>
                  ))}
                </div>

                <Botao variante="secundario" className="mt-4"
                  onClick={() => setNovas((l) => [...l, { chave: novaChave(), unidade_id: '', carga_horaria: '', data_inicio: hoje(), horarios: [novoHorario()] }])}>
                  <Plus className="size-4" aria-hidden /> Adicionar lotação
                </Botao>
              </fieldset>
              )}
            </>
          )}
        </div>

        <footer className="border-t border-linha bg-white px-6 py-4">
          {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
          <div className="flex justify-end gap-2">
            <Botao variante="discreto" onClick={onFechar}>Cancelar</Botao>
            <Botao type="submit" carregando={salvando} disabled={carregando}>
              {editando ? 'Salvar alterações' : 'Cadastrar funcionário'}
            </Botao>
          </div>
        </footer>
      </form>
    </div>
  );
}
