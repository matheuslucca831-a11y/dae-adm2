'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { dataBR, dataHoraBR, mensagemErro } from '@/lib/formato';
import { conflitosDoHorario, resumoHorario, type LotacaoBase } from '@/lib/escalas';
import { Aviso, Botao, Selo, inputCls } from '@/components/ui';
import { Paginacao, usePaginacao } from '@/components/Paginacao';
import type { HorarioSugestao } from './EditorHorarios';

type HorarioBanco = { frequencia: string; dia_semana: string | null; data_referencia: string | null; entrada: string | null; saida: string | null };
type Sugestao = {
  id: string; lotacao_id: string; horarios: HorarioSugestao[]; horarios_atuais: HorarioSugestao[];
  a_partir_de: string; motivo: string | null; situacao: 'Pendente' | 'Aceita' | 'Recusada'; motivo_recusa: string | null;
  criado_em: string; analisado_em: string | null;
  unidade: { nome: string } | null;
  funcionario: {
    id: string; nome: string; matricula: string | null; cargo: string | null;
    lotacoes: { id: string; situacao: string; unidade: { nome: string } | null; horarios: HorarioBanco[] }[];
  } | null;
};

const ROTULO: Record<Sugestao['situacao'], string> = { Pendente: 'Aguardando a DAE', Aceita: 'Aceita', Recusada: 'Recusada' };
const SEM_ITENS: never[] = [];
const comoBase = (h: HorarioSugestao | HorarioBanco) => ({
  dia_semana: h.frequencia === 'Datas específicas' ? null : h.dia_semana || null,
  data_referencia: h.data_referencia || null, entrada: h.entrada?.slice(0, 5) || null, saida: h.saida?.slice(0, 5) || null,
});
const chave = (hs: (HorarioSugestao | HorarioBanco)[]) =>
  JSON.stringify(hs.map((h) => { const b = comoBase(h); return [h.frequencia, b.dia_semana, b.data_referencia, b.entrada, b.saida]; }).sort());

/** Sede: pedidos das unidades para mudar o horário de um funcionário */
export default function SugestoesHorario({ onMudou }: { onMudou?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [situacao, setSituacao] = useState<Sugestao['situacao']>('Pendente');
  const [lista, setLista] = useState<Sugestao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    supabase.from('sugestoes_horario')
      .select('id, lotacao_id, horarios, horarios_atuais, a_partir_de, motivo, situacao, motivo_recusa, criado_em, analisado_em, unidade:unidades(nome), ' +
        'funcionario:funcionarios(id, nome, matricula, cargo, lotacoes(id, situacao, unidade:unidades(nome), horarios(frequencia, dia_semana, data_referencia, entrada, saida)))')
      .eq('situacao', situacao).order('criado_em', { ascending: situacao === 'Pendente' }).limit(500)
      .then(({ data, error }) => {
        if (!vivo) return;
        setLista((data as unknown as Sugestao[]) ?? []);
        setErro(error ? mensagemErro(error) : null);
      });
    return () => {
      vivo = false;
    };
  }, [supabase, situacao, versao]);

  const pag = usePaginacao(lista ?? SEM_ITENS, 25);

  function concluido(texto: string) {
    setOk(texto);
    setErro(null);
    setVersao((v) => v + 1);
    onMudou?.();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Situação" className="inline-flex rounded-md border border-linha bg-white p-1">
          {(['Pendente', 'Aceita', 'Recusada'] as const).map((s) => (
            <button key={s} role="tab" type="button" aria-selected={situacao === s} onClick={() => { setLista(null); setOk(null); setSituacao(s); }}
              className={`rounded px-3 py-1.5 text-sm font-semibold ${situacao === s ? 'bg-acento text-white' : 'text-tinta-suave hover:text-tinta'}`}>
              {s === 'Pendente' ? 'Aguardando análise' : s === 'Aceita' ? 'Aceitas' : 'Recusadas'}
            </button>
          ))}
        </div>
        <p className="text-sm text-tinta-suave">Ao aceitar, a escala do funcionário naquela unidade é trocada pelo horário sugerido.</p>
      </div>

      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}
      {ok && <div className="mt-4"><Aviso tom="info">{ok}</Aviso></div>}

      <div className="mt-4 space-y-3">
        {!lista && <p className="text-sm text-tinta-suave" role="status">Carregando…</p>}
        {lista?.length === 0 && (
          <p className="rounded-lg border border-dashed border-linha bg-white p-6 text-sm text-tinta-suave">
            {situacao === 'Pendente' ? 'Nenhuma alteração de horário aguardando análise.' : 'Nada por aqui.'}
          </p>
        )}
        {pag.visiveis.map((s) => <CartaoHorario key={s.id} s={s} onErro={setErro} onConcluido={concluido} />)}
        <Paginacao p={pag} rotulo="pedidos" />
      </div>
    </>
  );
}

export function CartaoHorario({ s, onErro, onConcluido }: { s: Sugestao; onErro: (m: string) => void; onConcluido: (t: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const pendente = s.situacao === 'Pendente';
  const unidade = s.unidade?.nome ?? 'Unidade';
  const nome = s.funcionario?.nome ?? 'Funcionário';

  const lotacoes = s.funcionario?.lotacoes ?? [];
  const lotacao = lotacoes.find((l) => l.id === s.lotacao_id && l.situacao === 'Ativa');
  const atualHoje = lotacoes.find((l) => l.id === s.lotacao_id)?.horarios ?? [];
  const mudouDesdeOPedido = pendente && chave(atualHoje) !== chave(s.horarios_atuais);

  // o novo horário bate com o de outra unidade?
  const base: LotacaoBase[] = [
    ...lotacoes.filter((l) => l.id !== s.lotacao_id)
      .map((l) => ({ chave: l.id, unidade: l.unidade?.nome ?? '', ativa: l.situacao === 'Ativa', horarios: l.horarios.map(comoBase) })),
    { chave: 'nova', unidade, ativa: true, horarios: s.horarios.map(comoBase) },
  ];
  const conflitos = s.horarios.map((h) => (pendente ? conflitosDoHorario(comoBase(h), 'nova', base) : []));
  const temConflito = conflitos.some((c) => c.length > 0);

  async function aceitar() {
    if (temConflito && !window.confirm('O novo horário coincide com o de outra unidade. O mesmo funcionário não pode estar em duas unidades no mesmo horário.\n\nAceitar mesmo assim?')) return;
    setOcupado(true);
    const { error } = await supabase.rpc('aceitar_sugestao_horario', { p_sugestao: s.id });
    setOcupado(false);
    if (error) return onErro(mensagemErro(error));
    onConcluido(`Horário de ${nome} em ${unidade} atualizado.`);
  }

  async function recusar() {
    if (!motivo.trim()) return onErro('Escreva o motivo da recusa; a unidade vai ver.');
    setOcupado(true);
    const { error } = await supabase.rpc('recusar_sugestao_horario', { p_sugestao: s.id, p_motivo: motivo.trim() });
    setOcupado(false);
    if (error) return onErro(mensagemErro(error));
    setRecusando(false);
    onConcluido(`Pedido de ${nome} recusado.`);
  }

  return (
    <article className="rounded-lg border border-linha bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">
            {s.funcionario ? <Link href={`/funcionarios/perfil?id=${s.funcionario.id}`} className="hover:underline">{nome}</Link> : nome}
          </h3>
          <p className="text-sm text-tinta-suave">
            {[s.funcionario?.matricula && `Matrícula ${s.funcionario.matricula}`, s.funcionario?.cargo].filter(Boolean).join(' · ')}
            {' · '}<strong className="text-tinta">{unidade}</strong> · a partir de {dataBR(s.a_partir_de)}
          </p>
          {s.motivo && <p className="mt-1 text-sm">Motivo da unidade: {s.motivo}</p>}
          <p className="mt-1 text-xs text-tinta-suave">Enviado em {dataHoraBR(s.criado_em)}{s.analisado_em && `, analisado em ${dataHoraBR(s.analisado_em)}`}</p>
        </div>
        <Selo texto={ROTULO[s.situacao]} />
      </div>

      <div className="mt-3 grid items-stretch gap-2 text-sm sm:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-md bg-papel p-3">
          <p className="text-xs font-semibold text-tinta-suave">{pendente ? 'Hoje no cadastro' : 'Antes'}</p>
          <ul className="mt-1 space-y-0.5">
            {(pendente ? atualHoje : s.horarios_atuais).length === 0 && <li className="text-tinta-suave">sem horários</li>}
            {(pendente ? atualHoje : s.horarios_atuais).map((h, i) => <li key={i}>{resumoHorario(comoBase(h) as HorarioBanco)}</li>)}
          </ul>
        </div>
        <ArrowRight className="hidden size-5 self-center text-tinta-suave sm:block" aria-hidden />
        <div className="rounded-md bg-acento-claro/40 p-3">
          <p className="text-xs font-semibold text-acento-escuro">Sugerido pela unidade</p>
          <ul className="mt-1 space-y-0.5">
            {s.horarios.map((h, i) => (
              <li key={i} className={conflitos[i]?.length ? 'font-semibold text-erro' : ''}>
                {resumoHorario(comoBase(h) as HorarioBanco)}{conflitos[i]?.length ? ` (mesmo horário em ${conflitos[i].join(' e ')})` : ''}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {mudouDesdeOPedido && (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-ocre-escuro">
          <AlertTriangle className="size-3.5" aria-hidden /> A escala foi alterada na DAE depois deste pedido. Confira antes de aceitar.
        </p>
      )}
      {pendente && !lotacao && (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-erro">
          <AlertTriangle className="size-3.5" aria-hidden /> A lotação não está mais ativa; recuse o pedido.
        </p>
      )}
      {temConflito && (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-erro">
          <AlertTriangle className="size-3.5" aria-hidden /> Há horário que se sobrepõe ao de outra unidade.
        </p>
      )}
      {s.situacao === 'Recusada' && <p className="mt-2 text-sm text-erro">Motivo: {s.motivo_recusa}</p>}

      {pendente && (recusando ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da recusa (a unidade verá)"
            onKeyDown={(e) => e.key === 'Enter' && recusar()} className={`${inputCls} max-w-md flex-1`} aria-label="Motivo" />
          <Botao variante="perigo" carregando={ocupado} onClick={recusar}>Recusar</Botao>
          <Botao variante="discreto" onClick={() => setRecusando(false)}>Cancelar</Botao>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Botao carregando={ocupado} onClick={aceitar} disabled={!lotacao}><Check className="size-4" aria-hidden /> Aceitar e atualizar escala</Botao>
          <Botao variante="secundario" onClick={() => setRecusando(true)}><X className="size-4" aria-hidden /> Recusar</Botao>
        </div>
      ))}
    </article>
  );
}
