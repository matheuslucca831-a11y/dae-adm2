'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Eye, ShieldCheck, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { buscarTudo } from '@/lib/buscarTudo';
import { useConsulta } from '@/lib/cacheTela';
import { dataBR, mensagemErro, normalizar } from '@/lib/formato';
import { resumoHorario } from '@/lib/escalas';
import { registrarAcesso } from '@/lib/acessos';
import { DIAS_SEMANA } from '@/lib/constantes';
import { Aviso, Botao, Selo, TabelaWrap, campoCls, tdCls, thCls } from '@/components/ui';
import SugerirHorario from './SugerirHorario';
import { Paginacao, usePaginacao } from '@/components/Paginacao';
import DadosFicha, { type FuncionarioFicha } from '@/components/ficha/DadosFicha';

type Horario = { frequencia: string; dia_semana: string | null; data_referencia: string | null; entrada: string | null; saida: string | null; obs: string | null };
type Linha = {
  id: string; carga_horaria: number | null; data_inicio: string;
  funcionario: { id: string; nome: string; matricula: string | null; cargo: string | null; vinculo: string | null } | null;
  horarios: Horario[];
};
const SEM_ITENS: never[] = [];
const ordemDia = (h: Horario) => (h.dia_semana ? DIAS_SEMANA.indexOf(h.dia_semana) : 7);

/** Unidade: funcionários lotados nela, com horários e (ao abrir) os dados da ficha */
export default function MeusFuncionarios({ unidadeNome }: { unidadeNome: string }) {
  const supabase = useMemo(() => createClient(), []);
  const consultaUrl = useSearchParams().get('q');
  const [busca, setBusca] = useState(consultaUrl ?? '');
  // Busca vinda da barra superior
  useEffect(() => {
    if (consultaUrl !== null) setBusca(consultaUrl);
  }, [consultaUrl]);
  const [aberto, setAberto] = useState<Linha | null>(null);
  const [pendentes, setPendentes] = useState<Set<string>>(new Set());
  const [versaoPend, setVersaoPend] = useState(0);

  // lotações com mudança de horário aguardando a DAE
  useEffect(() => {
    let vivo = true;
    supabase.from('sugestoes_horario').select('lotacao_id').eq('situacao', 'Pendente')
      .then(({ data }) => vivo && setPendentes(new Set((data ?? []).map((x) => x.lotacao_id as string))));
    return () => {
      vivo = false;
    };
  }, [supabase, versaoPend]);

  // as regras do banco só devolvem as lotações da própria unidade; memória da tela ao voltar
  const consulta = useConsulta('equipe:lista', async () => {
    const { data, error } = await buscarTudo((de, ate) => supabase.from('lotacoes')
      .select('id, carga_horaria, data_inicio, funcionario:funcionarios(id, nome, matricula, cargo, vinculo), horarios(frequencia, dia_semana, data_referencia, entrada, saida, obs)')
      .eq('situacao', 'Ativa').order('id').range(de, ate));
    if (error) throw new Error(mensagemErro(error));
    return ((data ?? []) as unknown as Linha[]).filter((l) => l.funcionario)
      .map((l) => ({ ...l, horarios: [...l.horarios].sort((a, b) => ordemDia(a) - ordemDia(b)) }))
      .sort((a, b) => a.funcionario!.nome.localeCompare(b.funcionario!.nome, 'pt-BR'));
  });
  const lista = consulta.dados ?? null;
  const erro = consulta.erro;

  const filtrados = useMemo(() => {
    const b = normalizar(busca.trim());
    if (!lista) return SEM_ITENS;
    return b ? lista.filter((l) => normalizar(`${l.funcionario?.nome} ${l.funcionario?.matricula ?? ''} ${l.funcionario?.cargo ?? ''}`).includes(b)) : lista;
  }, [lista, busca]);
  const pag = usePaginacao(filtrados, 50);

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold">Meus funcionários</h1>
      <p className="mt-1 text-tinta-suave">
        Funcionários lotados em {unidadeNome}, com os horários cadastrados na DAE. Para mudar o horário de alguém, abra Ver dados e use Sugerir alteração de horário; para outros dados, fale com a DAE.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, matrícula ou cargo"
          aria-label="Buscar" className={`${campoCls} min-w-72`} />
        {lista && <span className="text-sm text-tinta-suave">{filtrados.length} de {lista.length} funcionários</span>}
      </div>
      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}

      <div className="mt-4">
        <TabelaWrap>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={thCls}>Nome</th><th className={thCls}>Matrícula</th><th className={thCls}>Cargo</th>
                <th className={thCls}>Vínculo</th><th className={thCls}>CH</th><th className={thCls}>Horários em {unidadeNome}</th>
                <th className={thCls}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {!lista && <tr><td colSpan={7} className={`${tdCls} text-tinta-suave`}>Carregando…</td></tr>}
              {lista && filtrados.length === 0 && <tr><td colSpan={7} className={`${tdCls} text-tinta-suave`}>Nenhum funcionário encontrado.</td></tr>}
              {pag.visiveis.map((l) => (
                <tr key={l.id} className="hover:bg-papel/50">
                  <td className={`${tdCls} font-medium`}>{l.funcionario?.nome}</td>
                  <td className={tdCls}>{l.funcionario?.matricula}</td>
                  <td className={tdCls}>{l.funcionario?.cargo}</td>
                  <td className={tdCls}>{l.funcionario?.vinculo}</td>
                  <td className={tdCls}>{l.carga_horaria ? `${l.carga_horaria}h` : '—'}</td>
                  <td className={`${tdCls} text-xs`}>
                    {l.horarios.length ? l.horarios.map(resumoHorario).join('; ') : <span className="text-tinta-suave">sem horários</span>}
                    {pendentes.has(l.id) && <span className="ml-2 inline-block align-middle"><Selo texto="Aguardando a DAE" /></span>}
                  </td>
                  <td className={`${tdCls} text-right`}>
                    <Botao variante="discreto" className="px-2.5 py-1.5 text-xs" onClick={() => setAberto(l)}>
                      <Eye className="size-3.5" aria-hidden /> Ver dados
                    </Botao>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaWrap>
        <Paginacao p={pag} rotulo="funcionários" />
      </div>

      {aberto && <DetalheFuncionario linha={aberto} unidadeNome={unidadeNome} onFechar={() => setAberto(null)} onMudou={() => setVersaoPend((v) => v + 1)} />}
    </div>
  );
}

function DetalheFuncionario({ linha, unidadeNome, onFechar, onMudou }: { linha: Linha; unidadeNome: string; onFechar: () => void; onMudou: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [f, setF] = useState<FuncionarioFicha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const id = linha.funcionario!.id;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      await registrarAcesso(supabase, id, 'Meus funcionários (unidade)');
      const { data, error } = await supabase.from('funcionarios').select('*').eq('id', id).single();
      if (!vivo) return;
      setF(data as FuncionarioFicha | null);
      setErro(error ? mensagemErro(error) : null);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, id]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-tinta/40" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <section role="dialog" aria-modal="true" aria-labelledby="titulo-detalhe" className="flex h-full w-full max-w-3xl flex-col bg-papel shadow-xl">
        <header className="flex items-center justify-between border-b border-linha bg-white px-6 py-4">
          <h2 id="titulo-detalhe" className="text-lg font-bold">{linha.funcionario?.nome}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded p-1.5 text-tinta-suave hover:bg-papel hover:text-tinta">
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <p className="flex items-start gap-2 rounded-md bg-azul-claro px-3 py-2 text-xs text-azul">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            Dados pessoais protegidos (LGPD): use só para o trabalho da unidade. Esta consulta fica registrada e a DAE vê quem consultou.
          </p>
          {erro && <Aviso>{erro}</Aviso>}
          {!f && !erro && <p className="text-sm text-tinta-suave" role="status">Carregando…</p>}
          {f && <DadosFicha f={f} mostrar1Doc={false} />}

          <section className="rounded-lg border border-linha bg-white p-4">
            <h3 className="text-sm font-bold">Em {unidadeNome}</h3>
            <p className="mt-1 text-sm text-tinta-suave">
              Desde {dataBR(linha.data_inicio)}{linha.carga_horaria ? ` · ${linha.carga_horaria}h semanais` : ''}
            </p>
            {linha.horarios.length === 0 ? (
              <p className="mt-3 text-sm text-tinta-suave">Nenhum horário cadastrado.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead><tr><th className={thCls}>Dia / Data</th><th className={thCls}>Entrada</th><th className={thCls}>Saída</th><th className={thCls}>Frequência</th><th className={thCls}>Obs.</th></tr></thead>
                <tbody>
                  {linha.horarios.map((h, i) => (
                    <tr key={i}>
                      <td className={tdCls}>{h.dia_semana ?? dataBR(h.data_referencia)}</td>
                      <td className={tdCls}>{h.entrada?.slice(0, 5) ?? '—'}</td>
                      <td className={tdCls}>{h.saida?.slice(0, 5) ?? '—'}</td>
                      <td className={tdCls}>{h.frequencia}</td>
                      <td className={tdCls}>{h.obs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <SugerirHorario lotacaoId={linha.id} horariosAtuais={linha.horarios} onMudou={onMudou} />
        </div>
      </section>
    </div>
  );
}
