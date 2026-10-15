'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { dataBR, dataHoraBR, hojeISO, mensagemErro, soDigitos } from '@/lib/formato';
import { resumoHorario } from '@/lib/escalas';
import { Aviso, Botao, Campo, Selo, inputCls } from '@/components/ui';
import FichaProfissional, { FICHA_VAZIA, fichaParaBanco, validarFicha, type FichaDados } from '@/components/ficha/FichaProfissional';
import { Paginacao, usePaginacao } from '@/components/Paginacao';
import EditorHorarios, { novoHorario, type HorarioSugestao } from './EditorHorarios';

type Encontrado = { funcionario_id: string; nome: string; matricula: string | null; achado_por: string; unidades: string[] };
type Sugestao = {
  id: string; nome: string; matricula: string; cpf: string | null; cargo: string | null; vinculo: string | null;
  data_inicio: string; horarios: HorarioSugestao[]; obs: string | null; situacao: 'Pendente' | 'Aceita' | 'Recusada';
  motivo_recusa: string | null; juntou: boolean; criado_em: string; analisado_em: string | null;
};

type Form = FichaDados & { data_inicio: string; obs: string; carga_horaria_unidade: string; mais_unidades: '' | 'Sim' | 'Não'; outras_unidades: string };
const VAZIO: Form = { ...FICHA_VAZIA, data_inicio: hojeISO(), obs: '', carga_horaria_unidade: '', mais_unidades: '', outras_unidades: '' };
const ROTULO: Record<Sugestao['situacao'], string> = { Pendente: 'Aguardando a DAE', Aceita: 'Aceita', Recusada: 'Recusada' };

/** Tela da unidade: sugere o cadastro de um funcionário com os dias que ele trabalha aqui */
export default function SugerirCadastro({ unidadeNome }: { unidadeNome: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [f, setF] = useState<Form>(VAZIO);
  const [cnes, setCnes] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<HorarioSugestao[]>([novoHorario()]);
  const [vinculos, setVinculos] = useState<string[]>([]);
  const [encontrado, setEncontrado] = useState<Encontrado[]>([]);
  const [lista, setLista] = useState<Sugestao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    supabase.from('vinculos').select('nome').order('nome').then(({ data }) => setVinculos((data ?? []).map((v) => v.nome)));
    supabase.from('unidades').select('*').eq('nome', unidadeNome).maybeSingle().then(({ data }) => setCnes(data?.cnes ?? null));
  }, [supabase, unidadeNome]);

  useEffect(() => {
    let vivo = true;
    supabase.from('sugestoes_cadastro')
      .select('id, nome, matricula, cpf, cargo, vinculo, data_inicio, horarios, obs, situacao, motivo_recusa, juntou, criado_em, analisado_em')
      .order('criado_em', { ascending: false })
      .then(({ data, error }) => {
        if (!vivo) return;
        setLista((data as Sugestao[]) ?? []);
        if (error) setErro(mensagemErro(error));
      });
    return () => {
      vivo = false;
    };
  }, [supabase, versao]);

  const pag = usePaginacao(lista ?? SEM_ITENS, 25);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));

  /** Ao sair da matrícula ou do CPF: o funcionário já existe em algum lugar? */
  async function verificar() {
    if (!f.matricula.trim() && soDigitos(f.cpf).length !== 11) return setEncontrado([]);
    const { data } = await supabase.rpc('verificar_cadastro', { p_matricula: f.matricula.trim(), p_cpf: f.cpf });
    setEncontrado((data as Encontrado[]) ?? []);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    const problema = validarFicha(f, { completa: true, matricula: true })
      ?? (!f.carga_horaria_unidade ? 'Informe a carga horária semanal na unidade.' : null)
      ?? (!f.data_inicio ? 'Informe a data de início na unidade.' : null)
      ?? (!f.mais_unidades ? 'Responda se o profissional atende em mais de uma unidade.' : null)
      ?? (f.mais_unidades === 'Sim' && !f.outras_unidades.trim() ? 'Informe em quais outras unidades ele atende.' : null);
    if (problema) return setErro(problema);
    if (horarios.length === 0) return setErro('Informe pelo menos um dia de trabalho na unidade.');
    if (horarios.some((h) => h.frequencia === 'Datas específicas' && !h.data_referencia)) return setErro('Informe a data nas linhas de "Datas específicas".');
    setErro(null);
    setSalvando(true);
    const { error } = await supabase.from('sugestoes_cadastro').insert({
      ...fichaParaBanco(f), matricula: f.matricula.trim(),
      data_inicio: f.data_inicio, obs: f.obs.trim() || null,
      carga_horaria_unidade: Number(f.carga_horaria_unidade),
      outras_unidades: f.mais_unidades === 'Sim' ? f.outras_unidades.trim() : null,
      horarios, // a unidade é preenchida pelo banco com a de quem envia
    });
    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    setOk(`Sugestão de ${f.nome.trim()} enviada à DAE. Acompanhe a resposta na lista abaixo.`);
    setF(VAZIO);
    setHorarios([novoHorario()]);
    setEncontrado([]);
    setVersao((v) => v + 1);
  }

  async function retirar(s: Sugestao) {
    if (!window.confirm(`Retirar a sugestão de ${s.nome}?`)) return;
    const { error } = await supabase.from('sugestoes_cadastro').delete().eq('id', s.id);
    if (error) return setErro(mensagemErro(error));
    setVersao((v) => v + 1);
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold">Sugerir cadastro</h1>
      <p className="mt-1 text-tinta-suave">
        Informe os dados do funcionário e os dias em que ele trabalha em {unidadeNome}. A DAE confere e aprova o cadastro.
      </p>

      <form onSubmit={enviar} className="mt-6 rounded-lg border border-linha bg-white p-5" noValidate>
        <div className="space-y-5">
          <fieldset className="rounded-lg border border-linha p-4">
            <legend className="px-1 text-sm font-bold">1 - Identificação da Unidade</legend>
            <div className="grid gap-3 sm:grid-cols-6">
              <Campo rotulo="Unidade" className="sm:col-span-2">
                <input value={unidadeNome} readOnly className={`${inputCls} bg-papel`} />
              </Campo>
              <Campo rotulo="CNES" className="sm:col-span-1">
                <input value={cnes ?? ''} readOnly placeholder="—" className={`${inputCls} bg-papel`} />
              </Campo>
              <Campo rotulo="CH na unidade *" className="sm:col-span-1">
                <input type="number" min={1} max={80} value={f.carga_horaria_unidade} onChange={(e) => set({ carga_horaria_unidade: e.target.value })} className={inputCls} />
              </Campo>
              <Campo rotulo="Início na unidade *" className="sm:col-span-2">
                <input type="date" value={f.data_inicio} onChange={(e) => set({ data_inicio: e.target.value })} className={inputCls} />
              </Campo>
              <div className="sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-tinta-suave">Atende em mais de uma unidade? *</span>
                <div className="flex h-[38px] items-center gap-4 text-sm" role="radiogroup" aria-label="Atende em mais de uma unidade">
                  {(['Não', 'Sim'] as const).map((r) => (
                    <label key={r} className="flex items-center gap-1.5">
                      <input type="radio" name="mais_unidades" checked={f.mais_unidades === r} onChange={() => set({ mais_unidades: r })}
                        className="size-4 accent-[var(--acento)]" />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
              {f.mais_unidades === 'Sim' && (
                <Campo rotulo="Quais unidades? *" className="sm:col-span-4">
                  <input value={f.outras_unidades} onChange={(e) => set({ outras_unidades: e.target.value })} placeholder="ex.: CEM, CAPS" className={inputCls} />
                </Campo>
              )}
            </div>
          </fieldset>

          <FichaProfissional valor={f} onChange={set} vinculos={vinculos} matriculaObrigatoria onIdentificacao={verificar} numeroSecao={2} />
        </div>

        {encontrado.length > 0 && (
          <div className="mt-4 flex gap-2 rounded-md bg-ocre-claro px-3 py-2 text-sm text-ocre-escuro" role="status">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              {encontrado.map((x) => (
                <p key={x.funcionario_id}>
                  Pela {x.achado_por}, este funcionário já está cadastrado como <strong>{x.nome}</strong>
                  {x.unidades.length ? `, trabalhando em ${x.unidades.join(', ')}` : ', sem lotação ativa'}.
                </p>
              ))}
              <p className="mt-1">Pode enviar mesmo assim: a DAE vai juntar ao cadastro existente e incluir os dias desta unidade.</p>
            </div>
          </div>
        )}

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-bold">4 - Dias e horários em {unidadeNome} *</legend>
          <EditorHorarios valor={horarios} onChange={setHorarios} />
        </fieldset>

        <Campo rotulo="Observação para a DAE" className="mt-4">
          <textarea rows={2} value={f.obs} onChange={(e) => set({ obs: e.target.value })} className={inputCls} />
        </Campo>

        {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}
        {ok && <div className="mt-4"><Aviso tom="info">{ok}</Aviso></div>}
        <Botao type="submit" className="mt-4" carregando={salvando}>Enviar sugestão à DAE</Botao>
      </form>

      <h2 className="mt-8 text-lg font-bold">Sugestões enviadas</h2>
      <div className="mt-3 space-y-2">
        {!lista && <p className="text-sm text-tinta-suave" role="status">Carregando…</p>}
        {lista?.length === 0 && <p className="text-sm text-tinta-suave">Nenhuma sugestão enviada ainda.</p>}
        {pag.visiveis.map((s) => (
          <article key={s.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-linha bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{s.nome} <span className="font-normal text-tinta-suave">· matrícula {s.matricula}</span></p>
              <p className="text-xs text-tinta-suave">
                {[s.cargo, s.vinculo].filter(Boolean).join(', ')}{s.cargo || s.vinculo ? ' · ' : ''}
                começa em {dataBR(s.data_inicio)} · {s.horarios.map(resumoHorario).join('; ')}
              </p>
              {s.situacao === 'Recusada' && <p className="mt-1 text-sm text-erro">Motivo: {s.motivo_recusa}</p>}
              {s.situacao === 'Aceita' && (
                <p className="mt-1 text-sm text-pinho-escuro">{s.juntou ? 'Incluído no cadastro que já existia.' : 'Cadastro criado.'}</p>
              )}
              <p className="mt-1 text-xs text-tinta-suave">Enviada em {dataHoraBR(s.criado_em)}{s.analisado_em && `, respondida em ${dataHoraBR(s.analisado_em)}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <Selo texto={ROTULO[s.situacao]} />
              {s.situacao === 'Pendente' && (
                <button type="button" title="Retirar sugestão" onClick={() => retirar(s)}
                  className="rounded p-1.5 text-tinta-suave hover:bg-erro-claro hover:text-erro"><Trash2 className="size-4" /></button>
              )}
            </div>
          </article>
        ))}
        <Paginacao p={pag} rotulo="sugestões" />
      </div>
    </div>
  );
}

const SEM_ITENS: never[] = [];
