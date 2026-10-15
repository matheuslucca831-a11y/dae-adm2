'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2,
  FileText,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatarCPF, mensagemErro, normalizar, soDigitos } from '@/lib/formato';
import { buscarTudo } from '@/lib/buscarTudo';
import { useConsulta } from '@/lib/cacheTela';
import { Paginacao, usePaginacao } from '@/components/Paginacao';
import { Aviso, Botao, Selo, TabelaWrap, campoCls, inputCls, tdCls, thCls } from '@/components/ui';
import FormFuncionario, { type UnidadeOpcao } from './FormFuncionario';
import RelacoesUnidades from './RelacoesUnidades';
import SugestoesUnidades from '@/components/sugestoes/SugestoesUnidades';
import SugestoesHorario from '@/components/sugestoes/SugestoesHorario';

type Aba = 'cadastro' | 'sugestoes' | 'relacoes';

type Linha = {
  id: string;
  nome: string;
  matricula: string | null;
  cpf: string | null;
  cargo: string | null;
  funcao: string | null;
  vinculo: string | null;
  situacao: 'Ativo' | 'Inativo';
  lotacoes: { situacao: string; unidade: { id: string; nome: string; sigla: string | null } | null }[];
};

const SEM_LINHAS: never[] = [];
const SEM_UNIDADES: never[] = [];
const SEM_VINCULOS: never[] = [];

export default function FuncionariosCentral({ abaInicial = 'cadastro' }: { abaInicial?: Aba }) {
  const supabase = useMemo(() => createClient(), []);
  const [aba, setAbaAtual] = useState<Aba>(abaInicial);
  const [abertas, setAbertas] = useState<Set<Aba>>(() => new Set([abaInicial]));
  const setAba = (a: Aba) => {
    setAbaAtual(a);
    setAbertas((s) => (s.has(a) ? s : new Set(s).add(a)));
  };
  const [pendentes, setPendentes] = useState({ cadastro: 0, horario: 0 });
  const [tipoSug, setTipoSug] = useState<'cadastro' | 'horario'>('cadastro');
  const [versao, setVersao] = useState(0);

  // Quantas sugestões das unidades aguardam análise
  useEffect(() => {
    Promise.all([
      supabase.from('sugestoes_cadastro').select('id', { count: 'exact', head: true }).eq('situacao', 'Pendente'),
      supabase.from('sugestoes_horario').select('id', { count: 'exact', head: true }).eq('situacao', 'Pendente'),
    ]).then(([c, h]) => setPendentes({ cadastro: c.count ?? 0, horario: h.count ?? 0 }));
  }, [supabase, versao]);

  return (
    <div className="w-full space-y-6">
      {/* Abas Superiores no estilo de Pílulas do SIGER APS */}
      <div role="tablist" aria-label="Seções" className="flex flex-wrap gap-2">
        {([
          ['cadastro', 'Gestão de Funcionários', Users],
          ['sugestoes', 'Sugestões das Unidades', UserCheck],
          ['relacoes', 'Relações Mensais', FileText],
        ] as const).map(([valor, rotulo, Icone]) => {
          const ativo = aba === valor;
          const totalPendentes = pendentes.cadastro + pendentes.horario;
          return (
            <button
              key={valor}
              role="tab"
              type="button"
              aria-selected={ativo}
              onClick={() => setAba(valor)}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold transition-all ${
                ativo
                  ? 'bg-electric-cobalt text-white shadow-xs'
                  : 'bg-white text-mid-graphite border border-linha hover:bg-faint-gray hover:text-ink-charcoal'
              }`}
            >
              <Icone className={`size-3.5 ${ativo ? 'text-white' : 'text-slate-gray'}`} />
              <span>{rotulo}</span>
              {valor === 'sugestoes' && totalPendentes > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ativo ? 'bg-white/20 text-white' : 'bg-warning-light text-warning'}`}>
                  {totalPendentes}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div>
        {abertas.has('cadastro') && (
          <div hidden={aba !== 'cadastro'}>
            <Cadastro atualizar={versao} />
          </div>
        )}
        {abertas.has('sugestoes') && (
          <div hidden={aba !== 'sugestoes'}>
            <div role="tablist" aria-label="Tipo de sugestão" className="mb-4 flex flex-wrap gap-2">
              {([
                ['cadastro', 'Cadastros novos'],
                ['horario', 'Mudanças de horário'],
              ] as const).map(([v, r]) => (
                <button
                  key={v}
                  role="tab"
                  type="button"
                  aria-selected={tipoSug === v}
                  onClick={() => setTipoSug(v)}
                  className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
                    tipoSug === v
                      ? 'border-electric-cobalt bg-electric-cobalt text-white shadow-xs'
                      : 'border-linha bg-white text-slate-gray hover:text-ink-charcoal'
                  }`}
                >
                  {r}
                  {pendentes[v] > 0 && (
                    <span className={`ml-2 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${tipoSug === v ? 'bg-white/25' : 'bg-warning-light text-warning'}`}>
                      {pendentes[v]}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {tipoSug === 'cadastro' ? (
              <SugestoesUnidades onMudou={() => setVersao((v) => v + 1)} />
            ) : (
              <SugestoesHorario onMudou={() => setVersao((v) => v + 1)} />
            )}
          </div>
        )}
        {abertas.has('relacoes') && <div hidden={aba !== 'relacoes'}><RelacoesUnidades /></div>}
      </div>
    </div>
  );
}

/** `atualizar` muda quando algo fora da aba altera o cadastro */
function Cadastro({ atualizar = 0 }: { atualizar?: number }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [versao, setVersao] = useState(0);

  const consultaUrl = useSearchParams().get('q');
  const [busca, setBusca] = useState(consultaUrl ?? '');
  // Busca vinda da barra superior
  useEffect(() => {
    if (consultaUrl !== null) setBusca(consultaUrl);
  }, [consultaUrl]);
  const [fUnidade, setFUnidade] = useState('');
  const [fVinculo, setFVinculo] = useState('');
  const [fSituacao, setFSituacao] = useState<'Ativo' | 'Inativo' | ''>('Ativo');
  const [modoVisualizacao, setModoVisualizacao] = useState<'cards' | 'tabela'>('cards');

  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const consulta = useConsulta('funcionarios:cadastro', async () => {
    const [f, u, v] = await Promise.all([
      buscarTudo((de, ate) =>
        supabase
          .from('funcionarios')
          .select('id, nome, matricula, cpf, cargo, funcao, vinculo, situacao, lotacoes(situacao, unidade:unidades(id, nome, sigla))')
          .order('nome')
          .order('id')
          .range(de, ate),
      ),
      supabase.from('unidades').select('*').eq('ativa', true).order('nome'),
      supabase.from('vinculos').select('nome').order('nome'),
    ]);
    if (f.error || u.error) throw new Error(mensagemErro(f.error || u.error));
    return {
      linhas: (f.data as unknown as Linha[]) ?? [],
      unidades: (u.data as UnidadeOpcao[]) ?? [],
      vinculos: (v.data ?? []).map((x) => x.nome as string),
    };
  }, [versao, atualizar]);

  const linhas = consulta.dados?.linhas ?? SEM_LINHAS;
  const unidades = consulta.dados?.unidades ?? SEM_UNIDADES;
  const vinculos = consulta.dados?.vinculos ?? SEM_VINCULOS;
  const carregando = consulta.carregando;
  const erro = consulta.erro;

  const totalAtivos = useMemo(() => linhas.filter((l) => l.situacao === 'Ativo').length, [linhas]);
  const totalInativos = useMemo(() => linhas.filter((l) => l.situacao === 'Inativo').length, [linhas]);

  const filtradas = useMemo(() => {
    const t = normalizar(busca.trim());
    const dig = soDigitos(busca);
    return linhas.filter((l) => {
      if (fSituacao && l.situacao !== fSituacao) return false;
      if (fVinculo && l.vinculo !== fVinculo) return false;
      const ativas = l.lotacoes.filter((x) => x.situacao === 'Ativa');
      if (fUnidade === 'sem' && ativas.length > 0) return false;
      if (fUnidade && fUnidade !== 'sem' && !ativas.some((x) => x.unidade?.id === fUnidade)) return false;
      if (t) {
        const alvo = normalizar(`${l.nome} ${l.matricula ?? ''} ${l.cargo ?? ''}`);
        if (!alvo.includes(t) && !(dig.length >= 3 && (l.cpf ?? '').includes(dig))) return false;
      }
      return true;
    });
  }, [linhas, busca, fUnidade, fVinculo, fSituacao]);

  const pag = usePaginacao(filtradas, 25);

  function abrir(id: string | null) {
    setEditandoId(id);
    setFormAberto(true);
  }

  return (
    <div className="space-y-6">
      {/* Banner de Cabeçalho Executivo do SIGER APS */}
      <div className="dock-card p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-electric-cobalt text-white flex items-center justify-center shrink-0 shadow-xs">
            <Users className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-ink-charcoal">Gestão Unificada de Funcionários e Escalas</h2>
            <p className="text-xs text-slate-gray mt-0.5">Governança central de colaboradores, lotações por unidade e sincronização de dados</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setVersao((v) => v + 1)}
            className="dock-btn-ghost rounded-full px-4 py-2 text-xs font-semibold flex items-center gap-2"
          >
            <RefreshCw className={`size-3.5 ${consulta.atualizando ? 'animate-spin' : ''}`} />
            <span>Sincronizar Rede</span>
          </button>
          <button
            type="button"
            onClick={() => abrir(null)}
            className="dock-btn-primary rounded-full px-5 py-2.5 text-xs font-semibold flex items-center gap-2 shadow-xs"
          >
            <Plus className="size-4" />
            <span>Novo Funcionário</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros em Pílulas e Pesquisa */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Pílulas de Status */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFSituacao('')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              fSituacao === ''
                ? 'bg-electric-cobalt text-white shadow-xs'
                : 'bg-white text-slate-gray border border-linha hover:text-ink-charcoal'
            }`}
          >
            Todos os Funcionários <span className="opacity-80">({linhas.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFSituacao('Ativo')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              fSituacao === 'Ativo'
                ? 'bg-electric-cobalt text-white shadow-xs'
                : 'bg-white text-slate-gray border border-linha hover:text-ink-charcoal'
            }`}
          >
            Ativos <span className="opacity-80">({totalAtivos})</span>
          </button>
          <button
            type="button"
            onClick={() => setFSituacao('Inativo')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              fSituacao === 'Inativo'
                ? 'bg-electric-cobalt text-white shadow-xs'
                : 'bg-white text-slate-gray border border-linha hover:text-ink-charcoal'
            }`}
          >
            Inativos <span className="opacity-80">({totalInativos})</span>
          </button>
        </div>

        {/* Filtros de Seleção e Busca */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={fUnidade}
            onChange={(e) => setFUnidade(e.target.value)}
            aria-label="Filtrar por Unidade"
            className="rounded-full border border-linha bg-white px-3.5 py-1.5 text-xs text-ink-charcoal outline-none focus:border-electric-cobalt"
          >
            <option value="">Todas as Unidades</option>
            <option value="sem">Sem lotação ativa</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>

          <select
            value={fVinculo}
            onChange={(e) => setFVinculo(e.target.value)}
            aria-label="Filtrar por Vínculo"
            className="rounded-full border border-linha bg-white px-3.5 py-1.5 text-xs text-ink-charcoal outline-none focus:border-electric-cobalt"
          >
            <option value="">Todos os Vínculos</option>
            {vinculos.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          {/* Alternador de Modo Cards / Tabela */}
          <div className="flex items-center rounded-full border border-linha bg-white p-1">
            <button
              type="button"
              onClick={() => setModoVisualizacao('cards')}
              title="Visualização em Cards"
              className={`p-1.5 rounded-full transition-colors ${
                modoVisualizacao === 'cards' ? 'bg-electric-cobalt text-white' : 'text-slate-gray hover:text-ink-charcoal'
              }`}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setModoVisualizacao('tabela')}
              title="Visualização em Tabela"
              className={`p-1.5 rounded-full transition-colors ${
                modoVisualizacao === 'tabela' ? 'bg-electric-cobalt text-white' : 'text-slate-gray hover:text-ink-charcoal'
              }`}
            >
              <List className="size-3.5" />
            </button>
          </div>

          {/* Campo de Pesquisa Local */}
          <div className="relative min-w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-gray" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar por nome, matrícula..."
              className="w-full rounded-full border border-linha bg-white pl-8 pr-3.5 py-1.5 text-xs text-ink-charcoal outline-none focus:border-electric-cobalt"
            />
          </div>
        </div>
      </div>

      {erro && (
        <div>
          <Aviso>{erro}</Aviso>
        </div>
      )}

      {/* Renderização em Cards ou Tabela */}
      {carregando ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="dock-card p-5 animate-pulse flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-11 rounded-full bg-linha/70" />
                <div className="space-y-2">
                  <div className="h-4 w-52 rounded bg-linha/60" />
                  <div className="h-3 w-80 rounded bg-linha/40" />
                </div>
              </div>
              <div className="h-8 w-24 rounded-full bg-linha/50" />
            </div>
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="dock-card p-12 text-center text-slate-gray">
          <p className="text-sm font-semibold">Nenhum funcionário localizado</p>
          <p className="text-xs mt-1">Tente ajustar os filtros ou cadastre um novo colaborador pelo botão acima.</p>
        </div>
      ) : modoVisualizacao === 'cards' ? (
        /* Lista de Cards no Padrão SIGER APS */
        <div className="space-y-3">
          {pag.visiveis.map((l) => {
            const ativas = l.lotacoes.filter((x) => x.situacao === 'Ativa');
            const iniciais = l.nome
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0].toUpperCase())
              .join('');
            const cargoOuFuncao = l.cargo || l.funcao || 'Colaborador';
            const unidadeTexto = ativas.length
              ? ativas.map((a) => a.unidade?.sigla || a.unidade?.nome).join(', ')
              : 'Sem lotação ativa';

            return (
              <div
                key={l.id}
                onClick={() => router.push(`/funcionarios/perfil?id=${l.id}`)}
                className="dock-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-electric-cobalt/40 transition-all cursor-pointer group"
              >
                <div className="flex items-start md:items-center gap-4">
                  {/* Avatar com Iniciais */}
                  <div className="size-11 rounded-full bg-lavender-mist text-electric-cobalt font-extrabold text-xs flex items-center justify-center shrink-0 border border-powder-blue shadow-xs">
                    {iniciais}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold tracking-tight text-ink-charcoal uppercase group-hover:text-electric-cobalt transition-colors">
                        {l.nome}
                      </h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#edf3fc] text-[#004aad] border border-powder-blue/40 uppercase">
                        {cargoOuFuncao}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-gray">
                      {l.matricula && <span>#{l.matricula}</span>}
                      {l.cpf && <span>CPF: {formatarCPF(l.cpf)}</span>}
                      {l.vinculo && <span>Vínculo: {l.vinculo}</span>}
                      <span className="inline-flex items-center gap-1 text-ink-charcoal font-medium">
                        <Building2 className="size-3 text-slate-gray" />
                        {unidadeTexto}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                      l.situacao === 'Ativo'
                        ? 'bg-[#e6f4ea] text-[#046645] border border-[#046645]/20'
                        : 'bg-faint-gray text-slate-gray border border-linha'
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${l.situacao === 'Ativo' ? 'bg-[#046645]' : 'bg-slate-gray'}`} />
                    {l.situacao}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      abrir(l.id);
                    }}
                    className="dock-btn-ghost rounded-full px-4 py-1.5 text-xs font-semibold hover:border-electric-cobalt hover:text-electric-cobalt"
                  >
                    Editar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Visualização em Tabela Clássica */
        <TabelaWrap>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={thCls}>Nome</th>
                <th className={thCls}>Matrícula</th>
                <th className={thCls}>CPF</th>
                <th className={thCls}>Cargo</th>
                <th className={thCls}>Vínculo</th>
                <th className={thCls}>Lotações ativas</th>
                <th className={thCls}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {pag.visiveis.map((l) => {
                const ativas = l.lotacoes.filter((x) => x.situacao === 'Ativa');
                return (
                  <tr
                    key={l.id}
                    onClick={() => router.push(`/funcionarios/perfil?id=${l.id}`)}
                    className="cursor-pointer hover:bg-lavender-mist/40 transition-colors"
                  >
                    <td className={`${tdCls} font-medium`}>
                      <button
                        type="button"
                        className="text-left font-bold text-ink-charcoal hover:text-electric-cobalt"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/funcionarios/perfil?id=${l.id}`);
                        }}
                      >
                        {l.nome}
                      </button>
                    </td>
                    <td className={tdCls}>{l.matricula ?? '—'}</td>
                    <td className={`${tdCls} whitespace-nowrap`}>{formatarCPF(l.cpf)}</td>
                    <td className={tdCls}>{l.cargo ?? '—'}</td>
                    <td className={`${tdCls} whitespace-nowrap`}>{l.vinculo ?? '—'}</td>
                    <td className={tdCls}>
                      {ativas.length
                        ? ativas.map((a) => a.unidade?.sigla || a.unidade?.nome).join(', ')
                        : <span className="text-slate-gray">Nenhuma</span>}
                    </td>
                    <td className={tdCls}><Selo texto={l.situacao} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TabelaWrap>
      )}

      <Paginacao p={pag} rotulo="funcionários" />

      {formAberto && (
        <FormFuncionario
          funcionarioId={editandoId}
          unidades={unidades}
          vinculos={vinculos}
          onFechar={() => setFormAberto(false)}
          onSalvo={() => {
            setFormAberto(false);
            setVersao((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
