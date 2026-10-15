'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { dataBR, dataHoraBR, hojeISO, mensagemErro } from '@/lib/formato';
import { resumoHorario } from '@/lib/escalas';
import { Aviso, Botao, Campo, Selo, inputCls } from '@/components/ui';
import EditorHorarios, { novoHorario, type HorarioSugestao } from '@/components/sugestoes/EditorHorarios';

type HorarioAtual = { frequencia: string; dia_semana: string | null; data_referencia: string | null; entrada: string | null; saida: string | null };
type Sugestao = {
  id: string; horarios: HorarioSugestao[]; horarios_atuais: HorarioSugestao[]; a_partir_de: string; motivo: string | null;
  situacao: 'Pendente' | 'Aceita' | 'Recusada'; motivo_recusa: string | null; criado_em: string; analisado_em: string | null;
};
const ROTULO: Record<Sugestao['situacao'], string> = { Pendente: 'Aguardando a DAE', Aceita: 'Aceita', Recusada: 'Recusada' };

/** Escala atual no formato do editor */
const paraEditor = (hs: HorarioAtual[]): HorarioSugestao[] =>
  hs.length
    ? hs.map((h) => ({
        frequencia: h.frequencia, dia_semana: h.dia_semana ?? 'Segunda-feira', data_referencia: h.data_referencia ?? '',
        entrada: h.entrada?.slice(0, 5) ?? '', saida: h.saida?.slice(0, 5) ?? '',
      }))
    : [novoHorario()];

const chave = (hs: HorarioSugestao[]) =>
  JSON.stringify(hs.map((h) => [h.frequencia, h.frequencia === 'Datas específicas' ? h.data_referencia : h.dia_semana, h.entrada, h.saida]).sort());

/** Unidade: pede à DAE a mudança de horário de um funcionário (ex.: 8h–17h para 7h–16h) */
export default function SugerirHorario({ lotacaoId, horariosAtuais, onMudou }: {
  lotacaoId: string; horariosAtuais: HorarioAtual[]; onMudou?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [lista, setLista] = useState<Sugestao[] | null>(null);
  const [editando, setEditando] = useState(false);
  const [horarios, setHorarios] = useState<HorarioSugestao[]>([]);
  const [aPartirDe, setAPartirDe] = useState(hojeISO());
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    supabase.from('sugestoes_horario')
      .select('id, horarios, horarios_atuais, a_partir_de, motivo, situacao, motivo_recusa, criado_em, analisado_em')
      .eq('lotacao_id', lotacaoId).order('criado_em', { ascending: false }).limit(5)
      .then(({ data, error }) => {
        if (!vivo) return;
        setLista((data as Sugestao[]) ?? []);
        if (error) setErro(mensagemErro(error));
      });
    return () => {
      vivo = false;
    };
  }, [supabase, lotacaoId, versao]);

  const pendente = lista?.find((s) => s.situacao === 'Pendente');
  const respondidas = (lista ?? []).filter((s) => s.situacao !== 'Pendente').slice(0, 3);

  function abrir() {
    setHorarios(paraEditor(horariosAtuais));
    setAPartirDe(hojeISO());
    setMotivo('');
    setErro(null);
    setOk(null);
    setEditando(true);
  }

  async function enviar() {
    if (!horarios.length) return setErro('Informe pelo menos um dia de trabalho.');
    if (horarios.some((h) => !h.entrada || !h.saida)) return setErro('Preencha a entrada e a saída de todas as linhas.');
    if (horarios.some((h) => h.frequencia === 'Datas específicas' && !h.data_referencia)) return setErro('Informe a data nas linhas de "Datas específicas".');
    if (chave(horarios) === chave(paraEditor(horariosAtuais))) return setErro('O horário sugerido está igual ao atual.');
    if (!aPartirDe) return setErro('Informe a partir de quando vale o novo horário.');
    setErro(null);
    setSalvando(true);
    const { error } = await supabase.from('sugestoes_horario').insert({
      // unidade, funcionário e escala atual são preenchidos pelo banco
      lotacao_id: lotacaoId, horarios, a_partir_de: aPartirDe, motivo: motivo.trim() || null,
    });
    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    setEditando(false);
    setOk('Alteração enviada à DAE. O horário muda aqui assim que a DAE aceitar.');
    setVersao((v) => v + 1);
    onMudou?.();
  }

  async function retirar(s: Sugestao) {
    if (!window.confirm('Retirar o pedido de alteração de horário?')) return;
    const { error } = await supabase.from('sugestoes_horario').delete().eq('id', s.id);
    if (error) return setErro(mensagemErro(error));
    setVersao((v) => v + 1);
    onMudou?.();
  }

  return (
    <section className="rounded-lg border border-linha bg-white p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold"><CalendarClock className="size-4" aria-hidden /> Mudança de horário</h3>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
      {ok && <div className="mt-3"><Aviso tom="info">{ok}</Aviso></div>}

      {!lista && <p className="mt-2 text-sm text-tinta-suave">Carregando…</p>}

      {pendente && (
        <div className="mt-3 rounded-md bg-ocre-claro/60 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Selo texto={ROTULO.Pendente} />
            <button type="button" onClick={() => retirar(pendente)} className="inline-flex items-center gap-1 text-xs font-semibold text-tinta-suave hover:text-erro">
              <Trash2 className="size-3.5" aria-hidden /> Retirar pedido
            </button>
          </div>
          <p className="mt-2"><strong>Novo horário</strong> a partir de {dataBR(pendente.a_partir_de)}: {pendente.horarios.map(resumoHorario).join('; ')}</p>
          {pendente.motivo && <p className="mt-1 text-xs">Motivo: {pendente.motivo}</p>}
          <p className="mt-1 text-xs text-tinta-suave">Enviado em {dataHoraBR(pendente.criado_em)}</p>
        </div>
      )}

      {lista && !pendente && !editando && (
        <div className="mt-2">
          <p className="text-sm text-tinta-suave">O funcionário mudou de horário? Envie o horário novo; a DAE confere e atualiza o cadastro.</p>
          <Botao variante="secundario" className="mt-3" onClick={abrir}>Sugerir alteração de horário</Botao>
        </div>
      )}

      {editando && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-tinta-suave">Já vem preenchido com o horário de hoje: ajuste o que mudou (pode usar o Preencher rápido).</p>
          <EditorHorarios valor={horarios} onChange={setHorarios} />
          <div className="grid gap-3 sm:grid-cols-6">
            <Campo rotulo="Vale a partir de *" className="sm:col-span-2">
              <input type="date" value={aPartirDe} onChange={(e) => setAPartirDe(e.target.value)} className={inputCls} />
            </Campo>
            <Campo rotulo="Motivo" className="sm:col-span-4">
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: troca de turno a pedido da coordenação" className={inputCls} />
            </Campo>
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao carregando={salvando} onClick={enviar}>Enviar à DAE</Botao>
            <Botao variante="discreto" onClick={() => setEditando(false)}>Cancelar</Botao>
          </div>
        </div>
      )}

      {respondidas.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-linha pt-3 text-xs">
          {respondidas.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start gap-2">
              <Selo texto={ROTULO[s.situacao]} />
              <span className="min-w-0 flex-1">
                {s.horarios.map(resumoHorario).join('; ')} (a partir de {dataBR(s.a_partir_de)})
                {s.situacao === 'Recusada' && <span className="block text-erro">Motivo da DAE: {s.motivo_recusa}</span>}
                <span className="block text-tinta-suave">Respondido em {s.analisado_em ? dataHoraBR(s.analisado_em) : '—'}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
