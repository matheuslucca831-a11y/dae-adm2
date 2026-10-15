'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { mensagemErro, normalizar } from '@/lib/formato';
import { criarUsuario, redefinirSenha, type NovoUsuario } from '@/lib/adminUsuarios';
import { Aviso, Botao, Campo, Selo, TabelaWrap, campoCls, inputCls, tdCls, thCls } from '@/components/ui';
import { Paginacao, usePaginacao } from '@/components/Paginacao';

type Usuario = {
  id: string;
  nome: string;
  email: string | null;
  perfil: 'central' | 'unidade';
  unidade_id: string | null;
  ativo: boolean;
  unidade: { nome: string } | null;
};
type Unidade = { id: string; nome: string; ativa: boolean };

type FiltroPerfil = 'todos' | 'unidade' | 'central' | 'ativo' | 'inativo';

const NOVO: NovoUsuario = { nome: '', email: '', senha: '', perfil: 'unidade', unidade_id: null };

function obterIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'US';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

export default function AdminUsuarios({ meuId }: { meuId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [lista, setLista] = useState<Usuario[] | null>(null);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroPerfil>('todos');
  const [modoVisualizacao, setModoVisualizacao] = useState<'cards' | 'tabela'>('cards');
  const [novo, setNovo] = useState<NovoUsuario | null>(null);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [senha, setSenha] = useState<{ id: string; valor: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      supabase
        .from('perfis')
        .select('id, nome, email, perfil, unidade_id, ativo, unidade:unidades(nome)')
        .order('perfil')
        .order('nome'),
      supabase.from('unidades').select('id, nome, ativa').order('nome'),
    ]).then(([p, u]) => {
      if (!vivo) return;
      setLista((p.data as unknown as Usuario[]) ?? []);
      setUnidades((u.data as Unidade[]) ?? []);
      setErro(p.error ? mensagemErro(p.error) : null);
    });
    return () => {
      vivo = false;
    };
  }, [supabase, versao]);

  const totais = useMemo(() => {
    const todos = lista ?? [];
    return {
      total: todos.length,
      unidade: todos.filter((u) => u.perfil === 'unidade').length,
      central: todos.filter((u) => u.perfil === 'central').length,
      ativos: todos.filter((u) => u.ativo).length,
      inativos: todos.filter((u) => !u.ativo).length,
    };
  }, [lista]);

  const visiveis = useMemo(() => {
    const t = normalizar(busca);
    return (lista ?? []).filter((u) => {
      if (filtro === 'unidade' && u.perfil !== 'unidade') return false;
      if (filtro === 'central' && u.perfil !== 'central') return false;
      if (filtro === 'ativo' && !u.ativo) return false;
      if (filtro === 'inativo' && u.ativo) return false;
      if (t) {
        const alvo = normalizar(`${u.nome} ${u.email ?? ''} ${u.unidade?.nome ?? ''}`);
        if (!alvo.includes(t)) return false;
      }
      return true;
    });
  }, [lista, busca, filtro]);

  const pag = usePaginacao(visiveis, 25);

  function concluir(msg: string) {
    setOk(msg);
    setErro(null);
    setVersao((v) => v + 1);
  }

  async function salvarNovo() {
    if (!novo) return;
    setOcupado(true);
    const r = await criarUsuario(novo);
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    setNovo(null);
    concluir(`Login criado para ${novo.email}. Passe a senha para a pessoa; ela pode trocar depois com a Sede.`);
  }

  async function salvarEdicao() {
    if (!editando) return;
    if (editando.perfil === 'unidade' && !editando.unidade_id) return setErro('Escolha a unidade.');
    setOcupado(true);
    const { error } = await supabase
      .from('perfis')
      .update({
        nome: editando.nome.trim(),
        perfil: editando.perfil,
        unidade_id: editando.perfil === 'unidade' ? editando.unidade_id : null,
        ...(editando.perfil === 'unidade' ? { is_diretora: false } : {}),
      })
      .eq('id', editando.id);
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setEditando(null);
    concluir('Usuário atualizado.');
  }

  async function alternarAtivo(u: Usuario) {
    if (u.id === meuId) return setErro('Você não pode desativar o seu próprio acesso.');
    if (u.ativo && !window.confirm(`Desativar o acesso de ${u.nome}? A pessoa não consegue mais entrar.`)) return;
    const { error } = await supabase.from('perfis').update({ ativo: !u.ativo }).eq('id', u.id);
    if (error) return setErro(mensagemErro(error));
    concluir(u.ativo ? `Acesso de ${u.nome} desativado.` : `Acesso de ${u.nome} reativado.`);
  }

  async function trocarSenha() {
    if (!senha) return;
    setOcupado(true);
    const r = await redefinirSenha(senha.id, senha.valor);
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    setSenha(null);
    concluir('Senha alterada. Passe a nova senha para a pessoa.');
  }

  const unidadesAtivas = unidades.filter((u) => u.ativa);

  return (
    <div className="space-y-6">
      {/* Banner de Cabeçalho Executivo do SIGER APS */}
      <div className="dock-card p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-electric-cobalt text-white flex items-center justify-center shrink-0 shadow-xs">
            <Users className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-ink-charcoal">Gestão Unificada de Usuários e Permissões</h2>
            <p className="text-xs text-slate-gray mt-0.5">
              Governança central de gestores, atribuição de perfis RBAC, coberturas excepcionais e lotação multi-unidades
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setVersao((v) => v + 1)}
            className="dock-btn-ghost rounded-full px-4 py-2 text-xs font-semibold flex items-center gap-2"
          >
            <RefreshCw className="size-3.5" />
            <span>Sincronizar Rede</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setNovo(NOVO);
              setOk(null);
            }}
            className="dock-btn-primary rounded-full px-5 py-2.5 text-xs font-semibold flex items-center gap-2 shadow-xs"
          >
            <Plus className="size-4" />
            <span>Novo Usuário</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros em Pílulas e Pesquisa */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Pílulas de Perfis e Situação */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltro('todos')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              filtro === 'todos'
                ? 'bg-electric-cobalt text-white shadow-xs'
                : 'bg-white text-slate-gray border border-linha hover:text-ink-charcoal'
            }`}
          >
            Todos os Usuários <span className="opacity-80">({totais.total})</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltro('unidade')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              filtro === 'unidade'
                ? 'bg-electric-cobalt text-white shadow-xs'
                : 'bg-white text-slate-gray border border-linha hover:text-ink-charcoal'
            }`}
          >
            Gestores Unidade <span className="opacity-80">({totais.unidade})</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltro('central')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              filtro === 'central'
                ? 'bg-electric-cobalt text-white shadow-xs'
                : 'bg-white text-slate-gray border border-linha hover:text-ink-charcoal'
            }`}
          >
            Administradores Sede <span className="opacity-80">({totais.central})</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltro('ativo')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              filtro === 'ativo'
                ? 'bg-electric-cobalt text-white shadow-xs'
                : 'bg-white text-slate-gray border border-linha hover:text-ink-charcoal'
            }`}
          >
            Ativos <span className="opacity-80">({totais.ativos})</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltro('inativo')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              filtro === 'inativo'
                ? 'bg-electric-cobalt text-white shadow-xs'
                : 'bg-white text-slate-gray border border-linha hover:text-ink-charcoal'
            }`}
          >
            Inativos <span className="opacity-80">({totais.inativos})</span>
          </button>
        </div>

        {/* Busca e Alternador de Visão */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 lg:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-gray" aria-hidden />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar por nome, e-mail ou unidade..."
              aria-label="Buscar usuário"
              className="w-full rounded-full border border-linha bg-white pl-9.5 pr-4 py-2 text-xs text-ink-charcoal shadow-xs placeholder-slate-gray/70 focus:border-electric-cobalt focus:outline-none focus:ring-1 focus:ring-electric-cobalt"
            />
          </div>

          <div className="flex items-center rounded-xl border border-linha bg-white p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setModoVisualizacao('cards')}
              aria-label="Visualização em cards"
              className={`rounded-lg p-1.5 transition-colors ${
                modoVisualizacao === 'cards' ? 'bg-electric-cobalt text-white shadow-xs' : 'text-slate-gray hover:text-ink-charcoal'
              }`}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setModoVisualizacao('tabela')}
              aria-label="Visualização em tabela"
              className={`rounded-lg p-1.5 transition-colors ${
                modoVisualizacao === 'tabela' ? 'bg-electric-cobalt text-white shadow-xs' : 'text-slate-gray hover:text-ink-charcoal'
              }`}
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {erro && <Aviso>{erro}</Aviso>}
      {ok && <Aviso tom="info">{ok}</Aviso>}

      {/* Formulário de Novo Usuário */}
      {novo && (
        <div className="dock-card p-5 border-2 border-electric-cobalt/30 bg-powder-blue/10">
          <div className="flex items-center justify-between pb-3 border-b border-linha">
            <h3 className="text-sm font-bold text-ink-charcoal">Novo Usuário</h3>
            <span className="text-xs text-slate-gray">Preencha os dados de credencial inicial</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Campo rotulo="Nome completo *">
              <input
                value={novo.nome}
                onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                className={inputCls}
                placeholder="Nome do gestor"
              />
            </Campo>
            <Campo rotulo="E-mail de login *">
              <input
                type="email"
                value={novo.email}
                onChange={(e) => setNovo({ ...novo, email: e.target.value })}
                className={inputCls}
                placeholder="gestor@ensp.fspss.org.br"
              />
            </Campo>
            <Campo rotulo="Senha inicial *" dica="Mínimo 8 caracteres">
              <input
                value={novo.senha}
                onChange={(e) => setNovo({ ...novo, senha: e.target.value })}
                className={inputCls}
                autoComplete="new-password"
                placeholder="Senha temporária"
              />
            </Campo>
            <Campo rotulo="Perfil de acesso">
              <select
                value={novo.perfil}
                onChange={(e) => setNovo({ ...novo, perfil: e.target.value as NovoUsuario['perfil'] })}
                className={inputCls}
              >
                <option value="unidade">ADM Unidade</option>
                <option value="central">ADM Central (Sede)</option>
              </select>
            </Campo>
            {novo.perfil === 'unidade' && (
              <Campo rotulo="Unidade vinculada *">
                <select
                  value={novo.unidade_id ?? ''}
                  onChange={(e) => setNovo({ ...novo, unidade_id: e.target.value || null })}
                  className={inputCls}
                >
                  <option value="">Selecione a Unidade</option>
                  {unidadesAtivas.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>
          <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-linha">
            <Botao variante="discreto" onClick={() => setNovo(null)}>
              Cancelar
            </Botao>
            <Botao carregando={ocupado} onClick={salvarNovo}>
              Criar Login
            </Botao>
          </div>
        </div>
      )}

      {/* Lista de Usuários */}
      {!lista ? (
        <div className="dock-card p-12 text-center text-xs text-slate-gray">
          <RefreshCw className="size-5 animate-spin mx-auto text-electric-cobalt mb-2" />
          <span>Carregando usuários do sistema...</span>
        </div>
      ) : visiveis.length === 0 ? (
        <div className="dock-card p-12 text-center text-xs text-slate-gray">
          <span>Nenhum usuário encontrado para os critérios selecionados.</span>
        </div>
      ) : modoVisualizacao === 'cards' ? (
        /* Visualização em Cartões Flutuantes (Padrão SIGER APS) */
        <div className="space-y-3">
          {pag.visiveis.map((u) => {
            const ed = editando?.id === u.id ? editando : null;
            const sn = senha?.id === u.id ? senha : null;
            const iniciais = obterIniciais(u.nome);
            const unidadeNome = u.unidade?.nome ?? (u.perfil === 'central' ? 'Sede Central DAE' : 'Não vinculada');
            const perfilBadge = u.perfil === 'central' ? 'ADM CENTRAL' : 'GESTOR FREQUÊNCIA';

            return (
              <div
                key={u.id}
                className="dock-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-electric-cobalt/40 transition-all"
              >
                {/* Lado Esquerdo: Avatar e Detalhes */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="size-11 rounded-full bg-powder-blue/30 border border-electric-cobalt/25 text-electric-cobalt font-extrabold flex items-center justify-center shrink-0 text-sm shadow-xs">
                    {iniciais}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    {/* Linha 1: Nome e Badge de Perfil */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold uppercase tracking-tight text-ink-charcoal">
                        {u.nome}
                      </span>
                      {u.id === meuId && (
                        <span className="text-xs font-semibold text-slate-gray">(você)</span>
                      )}
                      <span className="rounded-full bg-sky-50 border border-sky-200/70 px-2.5 py-0.5 text-[10px] font-bold text-sky-700 uppercase tracking-wider">
                        {perfilBadge}
                      </span>
                    </div>

                    {/* Linha 2: Metadados (Identificador, E-mail, Unidade) */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-gray">
                      <span className="font-mono text-mid-graphite">#{u.id.slice(0, 6)}</span>
                      {u.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="size-3 text-slate-400" />
                          <span>{u.email}</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3 text-slate-400" />
                        <span>{u.perfil === 'central' ? 'Sede Central DAE' : 'Unidade de Atendimento'}</span>
                      </span>
                    </div>

                    {/* Linha 3: Tag de Lotação Titular */}
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-powder-blue/25 border border-electric-cobalt/20 px-3 py-0.5 text-[11px] font-semibold text-electric-cobalt">
                        <MapPin className="size-3 text-electric-cobalt" />
                        <span>Titular: {unidadeNome}</span>
                      </span>
                    </div>

                    {/* Bloco de Edição Rápida Integrada */}
                    {ed && (
                      <div className="mt-3 rounded-xl border border-electric-cobalt/30 bg-powder-blue/15 p-3.5 space-y-3">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-gray uppercase">Nome</label>
                            <input
                              value={ed.nome}
                              onChange={(e) => setEditando({ ...ed, nome: e.target.value })}
                              className={campoCls}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-gray uppercase">Acesso</label>
                            <select
                              value={ed.perfil}
                              onChange={(e) => setEditando({ ...ed, perfil: e.target.value as Usuario['perfil'] })}
                              className={campoCls}
                            >
                              <option value="unidade">ADM Unidade</option>
                              <option value="central">ADM Central</option>
                            </select>
                          </div>
                          {ed.perfil === 'unidade' && (
                            <div>
                              <label className="text-[10px] font-bold text-slate-gray uppercase">Unidade</label>
                              <select
                                value={ed.unidade_id ?? ''}
                                onChange={(e) => setEditando({ ...ed, unidade_id: e.target.value || null })}
                                className={campoCls}
                              >
                                <option value="">Selecione</option>
                                {unidadesAtivas.map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.nome}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Botao variante="discreto" className="px-3 py-1.5 text-xs" onClick={() => setEditando(null)}>
                            Cancelar
                          </Botao>
                          <Botao className="px-4 py-1.5 text-xs" carregando={ocupado} onClick={salvarEdicao}>
                            Salvar Alterações
                          </Botao>
                        </div>
                      </div>
                    )}

                    {/* Bloco de Redefinição de Senha */}
                    {sn && (
                      <div className="mt-3 rounded-xl border border-warning/40 bg-warning-light/30 p-3.5 flex flex-wrap items-center gap-2">
                        <input
                          value={sn.valor}
                          onChange={(e) => setSenha({ ...sn, valor: e.target.value })}
                          placeholder="Nova senha (8 ou mais caracteres)"
                          autoFocus
                          autoComplete="new-password"
                          className={`${campoCls} flex-1 min-w-48`}
                        />
                        <Botao className="px-3 py-1.5 text-xs" carregando={ocupado} onClick={trocarSenha}>
                          Salvar Senha
                        </Botao>
                        <Botao variante="discreto" className="px-3 py-1.5 text-xs" onClick={() => setSenha(null)}>
                          Cancelar
                        </Botao>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lado Direito: Situação e Ações */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-linha shrink-0">
                  {/* Indicador de Situação com Ponto Semântico */}
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      u.ativo ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    <span className={`size-2 rounded-full ${u.ativo ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span>{u.ativo ? 'Ativo' : 'Inativo'}</span>
                  </span>

                  {/* Botões de Ação */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSenha({ id: u.id, valor: '' });
                        setOk(null);
                      }}
                      className="dock-btn-ghost rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 text-slate-gray hover:text-ink-charcoal"
                      title="Redefinir senha de acesso"
                    >
                      <KeyRound className="size-3.5" />
                      <span>Senha</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditando(u);
                        setOk(null);
                      }}
                      className="dock-btn-primary rounded-xl px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                      title="Editar usuário"
                    >
                      <Pencil className="size-3.5" />
                      <span>Editar</span>
                    </button>

                    {u.id !== meuId && (
                      <button
                        type="button"
                        onClick={() => alternarAtivo(u)}
                        className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition-colors ${
                          u.ativo
                            ? 'border-transparent text-slate-gray hover:text-erro hover:bg-erro/10'
                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={u.ativo ? 'Desativar acesso' : 'Reativar acesso'}
                      >
                        {u.ativo ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Visualização em Tabela Clássica */
        <div className="dock-card overflow-hidden">
          <TabelaWrap>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={thCls}>Nome</th>
                  <th className={thCls}>E-mail</th>
                  <th className={thCls}>Acesso</th>
                  <th className={thCls}>Unidade</th>
                  <th className={thCls}>Situação</th>
                  <th className={thCls}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pag.visiveis.map((u) => {
                  const ed = editando?.id === u.id ? editando : null;
                  return (
                    <tr key={u.id} className="align-top hover:bg-papel/50">
                      <td className={`${tdCls} font-medium`}>
                        {ed ? (
                          <input
                            value={ed.nome}
                            onChange={(e) => setEditando({ ...ed, nome: e.target.value })}
                            aria-label="Nome"
                            className={campoCls}
                          />
                        ) : (
                          <>
                            {u.nome}
                            {u.id === meuId && <span className="ml-1 text-xs text-tinta-suave">(você)</span>}
                          </>
                        )}
                      </td>
                      <td className={tdCls}>{u.email}</td>
                      <td className={tdCls}>
                        {ed ? (
                          <select
                            value={ed.perfil}
                            onChange={(e) => setEditando({ ...ed, perfil: e.target.value as Usuario['perfil'] })}
                            aria-label="Acesso"
                            className={campoCls}
                          >
                            <option value="unidade">ADM Unidade</option>
                            <option value="central">ADM Central</option>
                          </select>
                        ) : u.perfil === 'central' ? (
                          'ADM Central'
                        ) : (
                          'ADM Unidade'
                        )}
                      </td>
                      <td className={tdCls}>
                        {ed ? (
                          ed.perfil === 'unidade' && (
                            <select
                              value={ed.unidade_id ?? ''}
                              onChange={(e) => setEditando({ ...ed, unidade_id: e.target.value || null })}
                              aria-label="Unidade"
                              className={campoCls}
                            >
                              <option value="">Selecione</option>
                              {unidadesAtivas.map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.nome}
                                </option>
                              ))}
                            </select>
                          )
                        ) : (
                          u.unidade?.nome ?? (u.perfil === 'central' ? 'Sede' : '—')
                        )}
                      </td>
                      <td className={tdCls}>
                        <Selo texto={u.ativo ? 'Ativo' : 'Inativo'} />
                      </td>
                      <td className={`${tdCls} whitespace-nowrap text-right`}>
                        {ed ? (
                          <div className="flex justify-end gap-1">
                            <Botao className="px-2.5 py-1.5 text-xs" carregando={ocupado} onClick={salvarEdicao}>
                              Salvar
                            </Botao>
                            <Botao variante="discreto" className="px-2.5 py-1.5 text-xs" onClick={() => setEditando(null)}>
                              Cancelar
                            </Botao>
                          </div>
                        ) : senha?.id === u.id ? (
                          <div className="flex justify-end gap-1">
                            <input
                              value={senha.valor}
                              onChange={(e) => setSenha({ ...senha, valor: e.target.value })}
                              placeholder="Nova senha (8+)"
                              aria-label="Nova senha"
                              autoFocus
                              autoComplete="new-password"
                              className={`${campoCls} w-40`}
                            />
                            <Botao className="px-2.5 py-1.5 text-xs" carregando={ocupado} onClick={trocarSenha}>
                              Salvar
                            </Botao>
                            <Botao variante="discreto" className="px-2.5 py-1.5 text-xs" onClick={() => setSenha(null)}>
                              Cancelar
                            </Botao>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Botao
                              variante="discreto"
                              className="px-2.5 py-1.5 text-xs"
                              onClick={() => {
                                setEditando(u);
                                setOk(null);
                              }}
                            >
                              Editar
                            </Botao>
                            <Botao
                              variante="discreto"
                              className="px-2.5 py-1.5 text-xs"
                              onClick={() => {
                                setSenha({ id: u.id, valor: '' });
                                setOk(null);
                              }}
                            >
                              <KeyRound className="size-3.5" aria-hidden /> Senha
                            </Botao>
                            {u.id !== meuId && (
                              <Botao
                                variante="discreto"
                                className="px-2.5 py-1.5 text-xs"
                                onClick={() => alternarAtivo(u)}
                              >
                                {u.ativo ? 'Desativar' : 'Reativar'}
                              </Botao>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TabelaWrap>
        </div>
      )}

      {/* Paginação */}
      <Paginacao p={pag} rotulo="usuários" />
    </div>
  );
}
