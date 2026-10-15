'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, UserPlus, Users, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { dataBR, dataHoraBR, formatarCNS, formatarCPF, mensagemErro } from '@/lib/formato';
import { conflitosDoHorario, resumoHorario, type LotacaoBase } from '@/lib/escalas';
import { Aviso, Botao, Selo, inputCls } from '@/components/ui';
import { Paginacao, usePaginacao } from '@/components/Paginacao';
import type { HorarioSugestao } from './EditorHorarios';

type Sugestao = {
  id: string; unidade_id: string; nome: string; matricula: string; cpf: string | null; cargo: string | null; vinculo: string | null;
  data_inicio: string; horarios: HorarioSugestao[]; obs: string | null; situacao: 'Pendente' | 'Aceita' | 'Recusada';
  motivo_recusa: string | null; funcionario_id: string | null; juntou: boolean; criado_em: string; analisado_em: string | null;
  unidade: { nome: string } | null;
  // campos da ficha (017)
  cns?: string | null; data_nascimento?: string | null; rg?: string | null; sexo?: string | null; cbo?: string | null;
  conselho?: string | null; numero_conselho?: string | null; conselho_uf?: string | null; forma_contratacao?: string | null;
  carga_horaria_semanal?: number | null; carga_horaria_unidade?: number | null; outras_unidades?: string | null;
};
type Existente = {
  id: string; nome: string; matricula: string | null; cpf: string | null; cargo: string | null; vinculo: string | null; situacao: string;
  lotacoes: { situacao: string; unidade: { nome: string } | null; horarios: { frequencia: string; dia_semana: string | null; data_referencia: string | null; entrada: string | null; saida: string | null }[] }[];
};

const ROTULO: Record<Sugestao['situacao'], string> = { Pendente: 'Aguardando a DAE', Aceita: 'Aceita', Recusada: 'Recusada' };
const SEM_ITENS: never[] = [];

/** Sede: sugestões de cadastro enviadas pelas unidades */
export default function SugestoesUnidades({ onMudou }: { onMudou?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [situacao, setSituacao] = useState<Sugestao['situacao']>('Pendente');
  const [lista, setLista] = useState<Sugestao[] | null>(null);
  const [existentes, setExistentes] = useState<Existente[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<{ texto: string; id: string } | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await supabase.from('sugestoes_cadastro')
        .select('*, unidade:unidades(nome)')
        .eq('situacao', situacao).order('criado_em', { ascending: situacao === 'Pendente' }).limit(500);
      const ls = (data as unknown as Sugestao[]) ?? [];
      // Cadastros que já existem com a mesma matrícula ou CPF
      let ex: Existente[] = [];
      if (situacao === 'Pendente' && ls.length) {
        const mats = [...new Set(ls.map((s) => s.matricula))];
        const cpfs = [...new Set(ls.map((s) => s.cpf).filter(Boolean))] as string[];
        const filtro = [`matricula.in.(${mats.map((m) => `"${m.replace(/"/g, '')}"`).join(',')})`, ...(cpfs.length ? [`cpf.in.(${cpfs.join(',')})`] : [])].join(',');
        const r = await supabase.from('funcionarios')
          .select('id, nome, matricula, cpf, cargo, vinculo, situacao, lotacoes(situacao, unidade:unidades(nome), horarios(frequencia, dia_semana, data_referencia, entrada, saida))')
          .or(filtro);
        ex = (r.data as unknown as Existente[]) ?? [];
      }
      if (!vivo) return;
      setLista(ls);
      setExistentes(ex);
      setErro(error ? mensagemErro(error) : null);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, situacao, versao]);

  const pag = usePaginacao(lista ?? SEM_ITENS, 25);

  function concluido(texto: string, id: string) {
    setOk({ texto, id });
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
        <p className="text-sm text-tinta-suave">As unidades sugerem; ao aceitar, o sistema cria o cadastro ou junta ao que já existe (pela matrícula ou CPF).</p>
      </div>

      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}
      {ok && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md bg-azul-claro px-3 py-2 text-sm text-azul" role="status">
          {ok.texto}
          {ok.id && <Link href={`/funcionarios/perfil?id=${ok.id}`} className="font-semibold underline">Abrir o cadastro</Link>}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {!lista && <p className="text-sm text-tinta-suave" role="status">Carregando…</p>}
        {lista?.length === 0 && (
          <p className="rounded-lg border border-dashed border-linha bg-white p-6 text-sm text-tinta-suave">
            {situacao === 'Pendente' ? 'Nenhuma sugestão aguardando análise.' : 'Nada por aqui.'}
          </p>
        )}
        {pag.visiveis.map((s) => (
          <CartaoSugestao key={s.id} s={s} existente={existentes.find((e) => e.matricula === s.matricula || (!!s.cpf && e.cpf === s.cpf)) ?? null}
            onErro={setErro} onConcluido={concluido} />
        ))}
        <Paginacao p={pag} rotulo="sugestões" />
      </div>
    </>
  );
}

function CartaoSugestao({ s, existente, onErro, onConcluido }: {
  s: Sugestao; existente: Existente | null; onErro: (m: string) => void; onConcluido: (texto: string, id: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const unidade = s.unidade?.nome ?? 'Unidade';
  const pendente = s.situacao === 'Pendente';

  // Mesmo dia em outra unidade?
  const base: LotacaoBase[] = [
    ...(existente?.lotacoes ?? []).map((l, i) => ({ chave: `e${i}`, unidade: l.unidade?.nome ?? '', ativa: l.situacao === 'Ativa', horarios: l.horarios })),
    { chave: 'nova', unidade, ativa: true, horarios: s.horarios.map((h) => ({ dia_semana: h.frequencia === 'Datas específicas' ? null : h.dia_semana, data_referencia: h.data_referencia || null, entrada: h.entrada, saida: h.saida })) },
  ];
  const conflitos = s.horarios.map((h) => conflitosDoHorario(
    { dia_semana: h.frequencia === 'Datas específicas' ? null : h.dia_semana, data_referencia: h.data_referencia || null, entrada: h.entrada, saida: h.saida }, 'nova', base));
  const temConflito = conflitos.some((c) => c.length > 0);
  const jaLotado = existente?.lotacoes.some((l) => l.situacao === 'Ativa' && l.unidade?.nome === unidade);
  const diferencas = existente ? [
    existente.nome.trim().toLowerCase() !== s.nome.trim().toLowerCase() && `nome no cadastro: ${existente.nome}`,
    s.cpf && existente.cpf && existente.cpf !== s.cpf && `CPF no cadastro: ${formatarCPF(existente.cpf)}`,
    s.cargo && existente.cargo && existente.cargo.trim().toLowerCase() !== s.cargo.trim().toLowerCase() && `cargo no cadastro: ${existente.cargo}`,
    s.vinculo && existente.vinculo && existente.vinculo !== s.vinculo && `vínculo no cadastro: ${existente.vinculo}`,
  ].filter(Boolean) as string[] : [];

  async function aceitar() {
    if (temConflito && !window.confirm('Há horários em que o funcionário já está em outra unidade. O mesmo funcionário não pode estar em duas unidades no mesmo horário.\n\nAceitar mesmo assim?')) return;
    setOcupado(true);
    const { data, error } = await supabase.rpc('aceitar_sugestao', { p_sugestao: s.id });
    setOcupado(false);
    if (error) return onErro(mensagemErro(error));
    onConcluido(existente ? `${s.nome}: dias em ${unidade} incluídos no cadastro existente.` : `Cadastro de ${s.nome} criado com lotação em ${unidade}.`, data as string);
  }

  async function recusar() {
    if (!motivo.trim()) return onErro('Escreva o motivo da recusa; a unidade vai ver.');
    setOcupado(true);
    const { error } = await supabase.rpc('recusar_sugestao', { p_sugestao: s.id, p_motivo: motivo.trim() });
    setOcupado(false);
    if (error) return onErro(mensagemErro(error));
    setRecusando(false);
    onConcluido(`Sugestão de ${s.nome} recusada.`, s.funcionario_id ?? '');
  }

  return (
    <article className="rounded-lg border border-linha bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">{s.nome}</h3>
          <p className="text-sm text-tinta-suave">
            Matrícula {s.matricula}{s.cpf && ` · CPF ${formatarCPF(s.cpf)}`}{s.cargo && ` · ${s.cargo}`}{s.vinculo && ` · ${s.vinculo}`}
          </p>
          <p className="mt-1 text-sm">
            <strong>{unidade}</strong>{s.carga_horaria_unidade ? ` (${s.carga_horaria_unidade}h semanais)` : ''}, a partir de {dataBR(s.data_inicio)}:{' '}
            {s.horarios.map((h, i) => (
              <span key={i} className={conflitos[i]?.length ? 'font-semibold text-erro' : ''}>
                {resumoHorario(h)}{conflitos[i]?.length ? ` (mesmo horário em ${conflitos[i].join(' e ')})` : ''}{i < s.horarios.length - 1 ? '; ' : ''}
              </span>
            ))}
          </p>
          {s.outras_unidades && <p className="mt-1 text-xs">Também atende em: <strong>{s.outras_unidades}</strong></p>}
          {s.obs && <p className="mt-1 text-xs text-tinta-suave">Obs. da unidade: {s.obs}</p>}
          <FichaResumo s={s} />
          <p className="mt-1 text-xs text-tinta-suave">Enviada em {dataHoraBR(s.criado_em)}{s.analisado_em && `, analisada em ${dataHoraBR(s.analisado_em)}`}</p>
        </div>
        <Selo texto={ROTULO[s.situacao]} />
      </div>

      {pendente && (
        <div className={`mt-3 flex gap-2 rounded-md px-3 py-2 text-sm ${existente ? 'bg-ocre-claro text-ocre-escuro' : 'bg-papel'}`}>
          {existente ? <Users className="mt-0.5 size-4 shrink-0" aria-hidden /> : <UserPlus className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <div>
            {existente ? (
              <>
                <p>
                  <strong>Já cadastrado</strong> como <Link href={`/funcionarios/perfil?id=${existente.id}`} className="font-semibold underline">{existente.nome}</Link>
                  {existente.situacao === 'Inativo' && ' (inativo, será reativado)'}.
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {existente.lotacoes.filter((l) => l.situacao === 'Ativa').map((l, i) => (
                    <li key={i}>{l.unidade?.nome}: {l.horarios.length ? l.horarios.map(resumoHorario).join('; ') : 'sem horários cadastrados'}</li>
                  ))}
                  {!existente.lotacoes.some((l) => l.situacao === 'Ativa') && <li>Sem lotação ativa.</li>}
                </ul>
                {jaLotado && <p className="mt-1 text-xs">Já está lotado em {unidade}: os dias sugeridos serão acrescentados a essa lotação.</p>}
                {diferencas.length > 0 && <p className="mt-1 text-xs">Diferenças em relação ao cadastro (o cadastro é mantido; só os campos em branco são completados com a ficha): {diferencas.join('; ')}.</p>}
              </>
            ) : (
              <p>Funcionário novo: ao aceitar, o cadastro é criado com lotação em {unidade}.</p>
            )}
            {temConflito && (
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-erro">
                <AlertTriangle className="size-3.5" aria-hidden /> Há horário que se sobrepõe ao de outra unidade. Confira antes de aceitar.
              </p>
            )}
          </div>
        </div>
      )}

      {s.situacao === 'Recusada' && <p className="mt-2 text-sm text-erro">Motivo: {s.motivo_recusa}</p>}
      {s.situacao === 'Aceita' && s.funcionario_id && (
        <p className="mt-2 text-sm">
          {s.juntou ? 'Juntada ao cadastro existente.' : 'Cadastro criado.'}{' '}
          <Link href={`/funcionarios/perfil?id=${s.funcionario_id}`} className="font-semibold underline">Abrir o cadastro</Link>
        </p>
      )}

      {pendente && (recusando ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da recusa (a unidade verá)"
            onKeyDown={(e) => e.key === 'Enter' && recusar()} className={`${inputCls} max-w-md flex-1`} aria-label="Motivo" />
          <Botao variante="perigo" carregando={ocupado} onClick={recusar}>Recusar</Botao>
          <Botao variante="discreto" onClick={() => setRecusando(false)}>Cancelar</Botao>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Botao carregando={ocupado} onClick={aceitar}>
            <Check className="size-4" aria-hidden /> {existente ? `Aceitar e juntar ao cadastro de ${existente.nome}` : 'Aceitar e criar cadastro'}
          </Botao>
          <Botao variante="secundario" onClick={() => setRecusando(true)}><X className="size-4" aria-hidden /> Recusar</Botao>
        </div>
      ))}
    </article>
  );
}


/** Ficha CNES enviada pela unidade */
function FichaResumo({ s }: { s: Sugestao }) {
  const conselho = [s.conselho, s.numero_conselho, s.conselho_uf].filter(Boolean).join(' ');
  const itens: [string, string | null | undefined][] = [
    ['CPF', s.cpf && formatarCPF(s.cpf)], ['Cartão SUS', formatarCNS(s.cns)], ['Nascimento', s.data_nascimento && dataBR(s.data_nascimento)],
    ['RG', s.rg], ['Sexo', s.sexo], ['Cargo', s.cargo], ['CBO', s.cbo], ['Vínculo', s.vinculo],
    ['Forma de contratação', s.forma_contratacao], ['CH semanal', s.carga_horaria_semanal ? `${s.carga_horaria_semanal}h` : null],
    ['Conselho de classe', conselho],
  ];
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-acento-escuro">Ver ficha completa</summary>
      <dl className="mt-2 grid gap-x-6 gap-y-1 rounded-md bg-papel/60 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {itens.map(([r, v]) => (
          <div key={r} className="flex gap-2">
            <dt className="text-tinta-suave">{r}:</dt>
            <dd className={v ? 'font-medium' : 'text-tinta-suave'}>{v || 'não informado'}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
