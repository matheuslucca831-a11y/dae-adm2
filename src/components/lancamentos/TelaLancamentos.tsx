'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRight, Check, FileText, History, MoreHorizontal, Pencil, PenLine, Plus, Search, Send, SlidersHorizontal, Trash2, Undo2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { competenciaAtual, dataBR, fimDoMes, hojeISO, mensagemErro, normalizar } from '@/lib/formato';
import {
  CAMPOS_TABELA, CATEGORIAS, DESTINOS_RH, SITUACOES_ANDAMENTO, TIPO_PROMOCAO, detalhe, podeEditar, primeiro, resumoHorarios, textoDecisao, textoRodada,
  type Categoria, type Decisao, type Lancamento,
} from '@/lib/lancamentos';
import type { Perfil } from '@/lib/types';
import { buscarTudo } from '@/lib/buscarTudo';
import { gravarCache, lerCache } from '@/lib/cacheTela';
import { Paginacao, usePaginacao } from '@/components/Paginacao';
import { Aviso, Botao, Selo, TabelaWrap, campoCls, inputCls, tdCls, thCls } from '@/components/ui';
import FormLancamento from './FormLancamento';
import Painel1Doc from './Painel1Doc';

/** Filas de trabalho da DAE e visões da unidade */
type Modo = 'dae' | 'unidade' | 'assinatura' | 'enviar' | 'andamento' | 'periodo';
const MODOS_PEDIDOS: [Modo, string][] = [['assinatura', 'Aguardando assinatura'], ['enviar', 'Prontos para o RH'], ['periodo', 'Todos (por período)']];
/** Avaliações: sem ordem fixa; a fila diz onde o papel está */
const MODOS_AVALIACOES: [Modo, string][] = [['dae', 'Na DAE'], ['unidade', 'Com a unidade'], ['enviar', 'Prontas para o RH'], ['periodo', 'Todas (por período)']];
const MODOS_UNIDADE: [Modo, string][] = [['andamento', 'Em andamento'], ['periodo', 'Todos (por período)']];

type Filtro = [coluna: string, valor: string | string[]];
/** Filtros de cada fila (lista = "um destes") */
function filtrosDaFila(modo: Modo, soAvaliacoes: boolean): Filtro[] {
  switch (modo) {
    case 'dae': return [['avaliacao_etapa', 'Na DAE'], ['situacao_rh', 'Aguardando autorização']];
    case 'unidade': return [['avaliacao_etapa', 'Na unidade'], ['situacao_rh', [...SITUACOES_ANDAMENTO]]];
    case 'assinatura': return [['diretora', 'Aguardando']];
    case 'enviar': return soAvaliacoes
      ? [['situacao_rh', 'Autorizado / Aguardando envio'], ['avaliacao_etapa', 'Na DAE']]
      : [['situacao_rh', 'Autorizado / Aguardando envio']];
    default: return [];
  }
}

const ENVIADO = ['Enviado ao RH', 'Concluído'];
const assinado = (l: Lancamento) => l.diretora === 'Autorizado' || l.diretora === 'Dispensado';

type Ordem = { chave: keyof Lancamento; dir: 1 | -1 };
type Diretor = { id: string; nome: string; cargo: string | null };
type FiltroCategoria = Categoria | 'todas';
/** Destinos do "Encaminhar" (avaliações) */
type Destino = 'unidade' | 'dae' | 'assinatura' | 'sem' | 'rh' | 'proxima';
/** Painel aberto embaixo de uma linha */
type Painel =
  | { id: string; tipo: 'assinar'; decisao: Decisao; obs: string; diretor_id: string; data: string }
  | { id: string; tipo: 'encaminhar'; destino: Destino | null; diretor_id: string; data: string; anotacao: string }
  | { id: string; tipo: 'rh'; anotacao?: string }
  | { id: string; tipo: 'caminho' };

/** Anotação que vai para o caminho da avaliação (só manda o campo quando há texto) */
const comAnotacao = (patch: Record<string, unknown>, anotacao?: string) =>
  anotacao?.trim() ? { ...patch, movimento_obs: anotacao.trim() } : patch;

export default function TelaLancamentos({ categorias, inicial, titulo, descricao, perfil }: {
  categorias: Categoria[]; inicial?: FiltroCategoria; titulo: string; descricao: string; perfil: Perfil;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [cat, setCat] = useState<FiltroCategoria>(inicial ?? (categorias.length === 1 ? categorias[0] : 'todas'));
  const cats = cat === 'todas' ? categorias : [cat];
  const chaveCats = cats.join(',');
  const unica = cat === 'todas' ? null : CATEGORIAS[cat];
  const central = perfil.perfil === 'central';
  const podeLancar = central || cats.some((c) => CATEGORIAS[c].unidadeLanca);
  const tem = (c: string) => !!unica && unica.campos.includes(c as never);
  const dataPadrao = unica?.dataPrincipal ?? 'data_recebimento';
  const tipos = [...new Set(cats.flatMap((c) => CATEGORIAS[c].tipos))];
  const soAvaliacoes = categorias.length === 1 && categorias[0] === 'avaliacoes';
  const modos = central ? (soAvaliacoes ? MODOS_AVALIACOES : MODOS_PEDIDOS) : MODOS_UNIDADE;
  const nome = soAvaliacoes ? { um: 'avaliação', muitos: 'avaliações' } : { um: 'pedido', muitos: 'pedidos' };

  const mesAtual = { de: competenciaAtual(), ate: fimDoMes(competenciaAtual()) };
  const [modo, setModo] = useState<Modo>(modos[0][0]);
  const [periodo, setPeriodo] = useState({ campo: dataPadrao as string, ...mesAtual });
  const [versao, setVersao] = useState(0);
  const [lista, setLista] = useState<Lancamento[]>([]);
  const [contagem, setContagem] = useState<Partial<Record<Modo, number>>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const filtrosVazios = { busca: '', unidade: '', vinculo: '', tipo: '' };
  const [fil, setFil] = useState(filtrosVazios);
  const [maisFiltros, setMaisFiltros] = useState(false);
  const [ordem, setOrdem] = useState<Ordem>({ chave: 'data_recebimento', dir: 1 });

  const [form, setForm] = useState<{ aberto: boolean; item: Lancamento | null }>({ aberto: false, item: null });
  const [umDoc, setUmDoc] = useState<Lancamento | null>(null);
  const [painel, setPainel] = useState<Painel | null>(null);
  const [diretores, setDiretores] = useState<Diretor[]>([]);
  const [ultimoDiretor, setUltimoDiretor] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const router = useRouter();
  const caminho = usePathname();

  // ---------- Carregamento ----------
  useEffect(() => {
    if (!central) return;
    supabase.from('diretores').select('id, nome, cargo').eq('ativo', true).order('nome')
      .then(({ data }) => setDiretores((data as Diretor[]) ?? []));
  }, [supabase, central]);

  useEffect(() => {
    let vivo = true;
    // memória da tela: mostra na hora o que já tinha desta fila e atualiza por trás
    const chaveCache = `lanc:${chaveCats}:${central}:${modo}:${periodo.campo}:${periodo.de}:${periodo.ate}`;
    const guardado = lerCache<{ lista: Lancamento[]; contagem: Partial<Record<Modo, number>> }>(chaveCache);
    if (guardado) {
      setLista(guardado.lista);
      setContagem(guardado.contagem);
      setCarregando(false);
    }
    (async () => {
      const listaCats = chaveCats.split(',');
      const consulta = (de: number, ate: number) => {
        let q = supabase.from('lancamentos').select(CAMPOS_TABELA).in('categoria', listaCats);
        const f = filtrosDaFila(modo, soAvaliacoes);
        if (f.length) f.forEach(([col, val]) => { q = Array.isArray(val) ? q.in(col, val) : q.eq(col, val); });
        else if (modo === 'andamento') q = q.in('situacao_rh', [...SITUACOES_ANDAMENTO, 'Devolvido']);
        else {
          if (periodo.de) q = q.gte(periodo.campo, periodo.de);
          if (periodo.ate) q = q.lte(periodo.campo, periodo.ate);
        }
        return q.order('protocolo_dae').range(de, ate);
      };
      const filas = central ? modos.map(([m]) => m).filter((m) => filtrosDaFila(m, soAvaliacoes).length) : [];
      const contar = (m: Modo) => {
        let c = supabase.from('lancamentos').select('id', { count: 'exact', head: true }).in('categoria', listaCats);
        filtrosDaFila(m, soAvaliacoes).forEach(([col, val]) => { c = Array.isArray(val) ? c.in(col, val) : c.eq(col, val); });
        return c;
      };
      const [res, ...cs] = await Promise.all([buscarTudo(consulta), ...filas.map(contar)]);
      if (!vivo) return;
      const novaLista = (res.data as unknown as Lancamento[]) ?? [];
      const novaContagem = Object.fromEntries(filas.map((m, i) => [m, cs[i].count ?? 0])) as Partial<Record<Modo, number>>;
      if (!res.error) gravarCache(chaveCache, { lista: novaLista, contagem: novaContagem });
      setLista(novaLista);
      setSel((s) => new Set([...s].filter((id) => novaLista.some((l) => l.id === id))));
      setContagem(novaContagem);
      setErro(res.error ? mensagemErro(res.error) : null);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, chaveCats, central, modo, periodo, versao, soAvaliacoes, modos]);

  // ---------- Filtros e ordenação (na tela) ----------
  const opcoesUnidade = useMemo(() => [...new Set(lista.map((l) => l.unidade_nome).filter(Boolean))].sort() as string[], [lista]);
  const opcoesVinculo = useMemo(() => [...new Set(lista.map((l) => l.vinculo).filter(Boolean))].sort() as string[], [lista]);

  const visiveis = useMemo(() => {
    const t = normalizar(fil.busca);
    const arr = lista.filter((l) =>
      (!fil.unidade || l.unidade_nome === fil.unidade) &&
      (!fil.vinculo || l.vinculo === fil.vinculo) &&
      (!fil.tipo || l.tipo === fil.tipo) &&
      (!t || normalizar(`${l.funcionario_nome} ${l.protocolo_dae} ${l.obs ?? ''} ${l.unidade_nome ?? ''}`).includes(t)));
    return arr.sort((a, b) => {
      const va = a[ordem.chave] ?? '', vb = b[ordem.chave] ?? '';
      const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR');
      return r * ordem.dir || a.protocolo_dae.localeCompare(b.protocolo_dae);
    });
  }, [lista, fil, ordem]);
  const pag = usePaginacao(visiveis);

  const nFiltrosExtras = [fil.unidade, fil.vinculo, fil.tipo].filter(Boolean).length;
  const temFiltro = !!fil.busca || nFiltrosExtras > 0;

  function trocarModo(m: Modo) {
    setCarregando(true);
    setPainel(null);
    setOk(null);
    setModo(m);
  }
  function trocarCategoria(c: FiltroCategoria) {
    const campo = c === 'todas' ? 'data_recebimento' : CATEGORIAS[c].dataPrincipal;
    setCarregando(true);
    setPainel(null);
    setCat(c);
    setFil(filtrosVazios);
    setPeriodo((x) => ({ ...x, campo }));
  }
  function mudarPeriodo(p: Partial<typeof periodo>) {
    setCarregando(true);
    setPeriodo((x) => ({ ...x, ...p }));
  }

  // ---------- Ações ----------
  function concluir(msg?: string) {
    setErro(null);
    setOk(msg ?? null);
    setPainel(null);
    setVersao((v) => v + 1);
  }

  async function atualizar(l: Lancamento, patch: Record<string, unknown>, msg?: string) {
    setOcupado(l.id);
    const { error } = await supabase.from('lancamentos').update(patch).eq('id', l.id);
    setOcupado(null);
    if (error) return setErro(mensagemErro(error));
    concluir(msg);
  }

  const diretorPadrao = () => ultimoDiretor || (diretores.length === 1 ? diretores[0].id : '');

  function assinar(l: Lancamento, decisao: Decisao, diretor_id: string, data: string, obs = '', anotacao = '') {
    if (!diretor_id) return setErro('Escolha qual diretor(a) assinou.');
    if (decisao !== 'Autorizado' && !obs.trim()) return setErro('Escreva a justificativa; quem acompanha vai ver.');
    setUltimoDiretor(diretor_id);
    atualizar(l, comAnotacao({ diretora: decisao, diretora_obs: obs.trim() || null, diretor_id, data_assinatura: data || null }, anotacao),
      decisao === 'Autorizado' ? `${l.protocolo_dae}: assinatura registrada.` : `${l.protocolo_dae}: ${textoDecisao(decisao).toLowerCase()}.`);
  }

  function desfazerDecisao(l: Lancamento) {
    const o = soAvaliacoes ? 'a avaliação volta a ficar sem assinatura' : 'o pedido volta para "Aguardando assinatura"';
    if (!window.confirm(`Desfazer a ${l.diretora === 'Autorizado' || l.diretora === 'Dispensado' ? 'assinatura' : 'decisão'} de ${l.protocolo_dae}? ${o[0].toUpperCase()}${o.slice(1)}.`)) return;
    atualizar(l, { diretora: 'Aguardando', diretora_obs: null }, `${l.protocolo_dae}: decisão desfeita.`);
  }

  async function excluir(l: Lancamento) {
    if (!window.confirm(`Excluir ${l.protocolo_dae} de ${l.funcionario_nome}? Não dá para desfazer.`)) return;
    const { error } = await supabase.from('lancamentos').delete().eq('id', l.id);
    if (error) return setErro(mensagemErro(error));
    concluir(`${l.protocolo_dae} excluído.`);
  }

  async function avisoDeUm(l: Lancamento) {
    setOcupado(l.id);
    const { data, error } = await supabase.rpc('gerar_aviso_rh', { p_lancamentos: [l.id] });
    setOcupado(null);
    if (error) return setErro(mensagemErro(error));
    router.push(`/avisos-rh?aviso=${data}&voltar=${encodeURIComponent(caminho)}`);
  }

  async function proximaAvaliacao(l: Lancamento) {
    setOcupado(l.id);
    const { error } = await supabase.rpc('proxima_avaliacao', { p_lancamento: l.id });
    setOcupado(null);
    if (error) return setErro(mensagemErro(error));
    concluir(`${l.funcionario_nome}: ${l.avaliacao_rodada + 1}ª avaliação registrada como recebida do RH. Ela está na fila "Na DAE".`);
  }

  /** Executa o destino escolhido no "Encaminhar" */
  function encaminhar(l: Lancamento, p: Extract<Painel, { tipo: 'encaminhar' }>) {
    const a = p.anotacao;
    switch (p.destino) {
      case 'unidade': return atualizar(l, comAnotacao({ avaliacao_etapa: 'Na unidade' }, a), `${l.funcionario_nome}: avaliação enviada à unidade.`);
      case 'dae': return atualizar(l, comAnotacao({ avaliacao_etapa: 'Na DAE' }, a), `${l.funcionario_nome}: avaliação de volta na DAE.`);
      case 'assinatura': return assinar(l, 'Autorizado', p.diretor_id, p.data, '', a);
      case 'sem': return atualizar(l, comAnotacao({ diretora: 'Dispensado' }, a), `${l.funcionario_nome}: liberada sem assinatura, pronta para o RH.`);
      case 'proxima': return proximaAvaliacao(l);
      case 'rh':
        if (l.avaliacao_etapa === 'Na unidade') {
          return atualizar(l, comAnotacao({ situacao_rh: 'Enviado ao RH' }, a), `${l.funcionario_nome}: registrado que a unidade enviou ao RH.`);
        }
        return setPainel({ id: l.id, tipo: 'rh', anotacao: a });
      default: return setErro('Escolha para onde a avaliação vai.');
    }
  }

  // ---------- Gerar aviso direto da fila "Prontos para o RH" ----------
  const filaEnvio = central && modo === 'enviar';
  const selecionavel = (l: Lancamento) => filaEnvio && !!l.destino_rh && !primeiro(l.aviso_rh_itens)?.aviso;
  const livres = visiveis.filter(selecionavel);
  const todosMarcados = livres.length > 0 && livres.every((l) => sel.has(l.id));
  const marcar = (ids: string[], sim: boolean) => setSel((s) => {
    const n = new Set(s);
    ids.forEach((id) => (sim ? n.add(id) : n.delete(id)));
    return n;
  });

  async function gerarAviso(destino: string) {
    const ids = livres.filter((l) => sel.has(l.id) && l.destino_rh === destino).map((l) => l.id);
    if (!ids.length) return;
    setOcupado(destino);
    const { data, error } = await supabase.rpc('gerar_aviso_rh', { p_lancamentos: ids });
    setOcupado(null);
    if (error) return setErro(mensagemErro(error));
    router.push(`/avisos-rh?aviso=${data}&voltar=${encodeURIComponent(caminho)}`);
  }

  const colunas = (filaEnvio ? 1 : 0) + 4 + (central ? 1 : 0);
  const ord = { ordem, onOrdenar: setOrdem };

  // ---------- Ação principal + menu de cada linha ----------
  function acoes(l: Lancamento) {
    const ocup = ocupado === l.id;
    const aviso = primeiro(l.aviso_rh_itens)?.aviso;
    const enviado = ENVIADO.includes(l.situacao_rh);
    const editavel = podeEditar(l);
    const pequeno = 'px-3 py-1.5 text-xs';

    let principal: React.ReactNode = null;
    // avaliação enviada cuja próxima já foi registrada: nada mais a fazer
    const temProxima = enviado && lista.some((x) => x.avaliacao_anterior === l.id);
    if (l.categoria === 'avaliacoes') {
      if (!temProxima) {
        principal = (
          <Botao variante="secundario" className={pequeno} carregando={ocup}
            onClick={() => setPainel(painel?.id === l.id && painel.tipo === 'encaminhar' ? null
              : { id: l.id, tipo: 'encaminhar', destino: null, diretor_id: diretorPadrao(), data: hojeISO(), anotacao: '' })}>
            <ArrowRight className="size-3.5" aria-hidden /> {enviado ? 'Voltou do RH?' : 'Encaminhar'}
          </Botao>
        );
      }
    } else if (l.diretora === 'Aguardando') {
      principal = (
        <Botao variante="secundario" className={pequeno} carregando={ocup}
          onClick={() => setPainel(painel?.id === l.id ? null : { id: l.id, tipo: 'assinar', decisao: 'Autorizado', obs: '', diretor_id: diretorPadrao(), data: hojeISO() })}>
          <PenLine className="size-3.5" aria-hidden /> Assinatura
        </Botao>
      );
    } else if (l.diretora === 'Devolvido') {
      principal = (
        <Botao variante="secundario" className={pequeno} onClick={() => setForm({ aberto: true, item: l })}>
          <Pencil className="size-3.5" aria-hidden /> Corrigir
        </Botao>
      );
    } else if (l.situacao_rh === 'Autorizado / Aguardando envio' && !aviso) {
      principal = l.destino_rh ? (
        <Botao variante="secundario" className={pequeno} carregando={ocup} onClick={() => setPainel({ id: l.id, tipo: 'rh' })}>
          <Send className="size-3.5" aria-hidden /> Enviar ao RH
        </Botao>
      ) : (
        <select defaultValue="" aria-label="Para qual RH" className={`${campoCls} py-1 text-xs`}
          onChange={(e) => e.target.value && atualizar(l, { destino_rh: e.target.value })}>
          <option value="">Escolher o RH…</option>
          {DESTINOS_RH.map((d) => <option key={d}>{d}</option>)}
        </select>
      );
    }

    const itens: ItemMenu[] = [];
    if (l.categoria === 'avaliacoes') itens.push({ rotulo: 'Ver o caminho', icone: History, onClick: () => setPainel({ id: l.id, tipo: 'caminho' }) });
    if (editavel) itens.push({ rotulo: 'Editar', icone: Pencil, onClick: () => setForm({ aberto: true, item: l }) });
    if (CATEGORIAS[l.categoria].temUmDoc && primeiro(l.comunicados_1doc)) itens.push({ rotulo: 'Comunicação 1Doc', icone: FileText, onClick: () => setUmDoc(l) });
    if (aviso) itens.push({ rotulo: `Abrir Aviso ${aviso.numero}`, icone: FileText, onClick: () => router.push(`/avisos-rh?aviso=${aviso.id}&voltar=${encodeURIComponent(caminho)}`) });
    if (l.diretora !== 'Aguardando' && !enviado && !aviso) {
      itens.push({ rotulo: assinado(l) ? 'Desfazer assinatura' : 'Desfazer decisão', icone: Undo2, onClick: () => desfazerDecisao(l) });
    }
    if (!enviado && !aviso) itens.push({ rotulo: 'Excluir', icone: Trash2, perigo: true, onClick: () => excluir(l) });

    return (
      <div className="flex items-center justify-end gap-1">
        {principal}
        {itens.length > 0 && <MenuAcoes itens={itens} rotulo={`Mais ações de ${l.protocolo_dae}`} />}
      </div>
    );
  }

  // ---------- Painéis embaixo da linha ----------
  function painelDaLinha(l: Lancamento) {
    if (!painel || painel.id !== l.id) return null;
    const fechar = <Botao variante="discreto" onClick={() => setPainel(null)}>Cancelar</Botao>;
    const seletorDiretor = (valor: string, onChange: (v: string) => void) => (diretores.length === 0 ? (
      <span className="self-center text-sm text-erro">Nenhum diretor cadastrado (Administração &gt; Diretores).</span>
    ) : (
      <label className="text-xs font-semibold text-tinta-suave">
        Quem assinou *
        <select value={valor} onChange={(e) => onChange(e.target.value)} className={`${campoCls} mt-1 block min-w-56 text-tinta`}>
          <option value="">Selecione</option>
          {diretores.map((d) => <option key={d.id} value={d.id}>{d.nome}{d.cargo ? ` (${d.cargo})` : ''}</option>)}
        </select>
      </label>
    ));
    const campoData = (valor: string, onChange: (v: string) => void) => (
      <label className="text-xs font-semibold text-tinta-suave">
        Data da assinatura
        <input type="date" value={valor} onChange={(e) => onChange(e.target.value)} className={`${campoCls} mt-1 block text-tinta`} />
      </label>
    );

    let conteudo: React.ReactNode = null;
    if (painel.tipo === 'assinar') {
      const p = painel;
      conteudo = (
        <div className="space-y-3">
          <Escolhas valor={p.decisao} onChange={(d) => setPainel({ ...p, decisao: d })} opcoes={[
            { valor: 'Autorizado', titulo: 'Assinado', ajuda: 'segue para o RH' },
            { valor: 'Devolvido', titulo: 'Devolver', ajuda: 'precisa de correção' },
            { valor: 'Não autorizado', titulo: 'Não autorizar', ajuda: 'encerra o pedido' },
          ]} />
          <div className="flex flex-wrap items-end gap-3">
            {seletorDiretor(p.diretor_id, (v) => setPainel({ ...p, diretor_id: v }))}
            {campoData(p.data, (v) => setPainel({ ...p, data: v }))}
            {p.decisao !== 'Autorizado' && (
              <label className="min-w-64 flex-1 text-xs font-semibold text-tinta-suave">
                Justificativa *
                <input autoFocus value={p.obs} onChange={(e) => setPainel({ ...p, obs: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && assinar(l, p.decisao, p.diretor_id, p.data, p.obs)} className={`${inputCls} mt-1 text-tinta`} />
              </label>
            )}
            <Botao variante={p.decisao === 'Não autorizado' ? 'perigo' : 'primario'} carregando={ocupado === l.id}
              onClick={() => assinar(l, p.decisao, p.diretor_id, p.data, p.obs)}>Confirmar</Botao>
            {fechar}
          </div>
        </div>
      );
    } else if (painel.tipo === 'encaminhar') {
      const p = painel;
      const enviado = ENVIADO.includes(l.situacao_rh);
      const naUnidade = l.avaliacao_etapa === 'Na unidade';
      const promo = l.tipo === TIPO_PROMOCAO;
      const opcoes: OpcaoEscolha<Destino>[] = enviado
        ? [{ valor: 'proxima', titulo: `Voltou do RH para a ${l.avaliacao_rodada + 1}ª avaliação`, ajuda: 'abre a próxima avaliação do mesmo papel, na DAE' }]
        : naUnidade
          ? [
              { valor: 'dae', titulo: 'Voltou para a DAE', ajuda: 'a unidade devolveu' },
              { valor: 'rh', titulo: 'A unidade enviou direto ao RH', ajuda: assinado(l) ? 'registra o envio' : 'precisa estar assinada', desativada: !assinado(l) },
            ]
          : [
              { valor: 'unidade', titulo: 'Para a unidade', ajuda: 'a chefia preenche' },
              ...(!assinado(l) ? [{ valor: 'assinatura' as Destino, titulo: 'Assinatura da Diretoria', ajuda: 'registrar quem assinou' }] : []),
              ...(!assinado(l) && promo ? [{ valor: 'sem' as Destino, titulo: 'Sem assinatura', ajuda: 'promoção: vai direto ao RH' }] : []),
              { valor: 'rh', titulo: 'Para o RH', ajuda: assinado(l) ? 'gerar Aviso ou marcar entregue' : 'falta a assinatura', desativada: !assinado(l) },
            ];
      conteudo = (
        <div className="space-y-3">
          <p className="text-sm font-semibold">{enviado ? 'O papel voltou do RH?' : 'Encaminhar para:'}</p>
          <Escolhas valor={p.destino} onChange={(d) => setPainel({ ...p, destino: d })} opcoes={opcoes} />
          <div className="flex flex-wrap items-end gap-3">
            {p.destino === 'assinatura' && (
              <>
                {seletorDiretor(p.diretor_id, (v) => setPainel({ ...p, diretor_id: v }))}
                {campoData(p.data, (v) => setPainel({ ...p, data: v }))}
              </>
            )}
            {p.destino && p.destino !== 'proxima' && (
              <label className="min-w-64 flex-1 text-sm font-semibold text-tinta-suave">
                Anotação <span className="font-normal">(opcional, fica no caminho)</span>
                <input value={p.anotacao} maxLength={200} onChange={(e) => setPainel({ ...p, anotacao: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && encaminhar(l, p)}
                  placeholder="ex.: guia de remessa nº 1234" className={`${inputCls} mt-1 text-tinta`} />
              </label>
            )}
            <Botao disabled={!p.destino} carregando={ocupado === l.id} onClick={() => encaminhar(l, p)}>Confirmar</Botao>
            {fechar}
          </div>
        </div>
      );
    } else if (painel.tipo === 'rh') {
      conteudo = (
        <div className="flex flex-wrap items-center gap-3">
          <p className="mr-auto text-sm">Enviar <strong>{l.protocolo_dae}</strong> ao <strong>{l.destino_rh ?? 'RH'}</strong>:</p>
          <Botao carregando={ocupado === l.id} onClick={() => avisoDeUm(l)}><FileText className="size-4" aria-hidden /> Gerar Aviso só com este</Botao>
          <Botao variante="secundario" disabled={ocupado === l.id}
            onClick={() => atualizar(l, comAnotacao({ situacao_rh: 'Enviado ao RH' }, painel.anotacao), `${l.protocolo_dae}: marcado como entregue ao RH.`)}>
            <Check className="size-4" aria-hidden /> Já entreguei, sem Aviso
          </Botao>
          {fechar}
        </div>
      );
    } else if (painel.tipo === 'caminho') {
      const trilha = l.avaliacao_trilha ?? [];
      conteudo = (
        <div>
          <p className="text-sm font-semibold">Caminho de {l.protocolo_dae}{textoRodada(l) && ` (${textoRodada(l)})`}</p>
          {trilha.length === 0 ? <p className="mt-1 text-sm text-tinta-suave">Sem movimentos registrados.</p> : (
            <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
              {trilha.map((e, i) => (
                <li key={i} className="flex items-center gap-2">
                  {i > 0 && <ArrowRight className="size-3.5 text-tinta-suave" aria-hidden />}
                  <span className="rounded-md bg-white px-2 py-1 ring-1 ring-linha" title={e.por ? `registrado por ${e.por}` : undefined}>
                    <strong>{e.evento}</strong> <span className="text-tinta-suave">{dataBR(e.em)}</span>
                    {e.obs && <span className="block max-w-72 text-xs italic text-tinta">{e.obs}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-2"><Botao variante="discreto" onClick={() => setPainel(null)}>Fechar</Botao></div>
        </div>
      );
    }
    return (
      <tr className="bg-acento-claro/40">
        <td colSpan={colunas} className={tdCls}>{conteudo}</td>
      </tr>
    );
  }

  return (
    <div className="w-full">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{titulo}</h1>
          <p className="mt-1 text-tinta-suave">
            {podeLancar ? descricao : 'Acompanhe os pedidos da sua unidade: assinatura da Diretoria e envio ao RH.'}
          </p>
        </div>
        {podeLancar && <Botao onClick={() => setForm({ aberto: true, item: null })}><Plus className="size-4" aria-hidden /> {soAvaliacoes ? 'Registrar avaliação recebida' : 'Registrar pedido'}</Botao>}
      </div>

      {/* Categorias */}
      {categorias.length > 1 && (
        <div role="tablist" aria-label="Tipo de pedido" className="mt-6 flex flex-wrap gap-x-1 border-b border-linha">
          {(['todas', ...categorias] as FiltroCategoria[]).map((c) => (
            <button key={c} role="tab" type="button" aria-selected={cat === c} onClick={() => trocarCategoria(c)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                cat === c ? 'border-acento text-acento-escuro' : 'border-transparent text-tinta-suave hover:text-tinta'}`}>
              {c === 'todas' ? 'Todos' : CATEGORIAS[c].titulo}
            </button>
          ))}
        </div>
      )}

      {/* Filas + busca */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Filas" className="inline-flex flex-wrap rounded-md border border-linha bg-white p-1">
          {modos.map(([v, r]) => (
            <button key={v} role="tab" type="button" aria-selected={modo === v} onClick={() => trocarModo(v)}
              className={`rounded px-3 py-1.5 text-sm font-semibold ${modo === v ? 'bg-acento text-white' : 'text-tinta-suave hover:text-tinta'}`}>
              {r}
              {contagem[v] ? <span className={`ml-1.5 rounded-full px-1.5 text-xs ${modo === v ? 'bg-white/25' : 'bg-acento-claro text-acento-escuro'}`}>{contagem[v]}</span> : null}
            </button>
          ))}
        </div>
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-suave" aria-hidden />
          <input value={fil.busca} onChange={(e) => setFil({ ...fil, busca: e.target.value })} placeholder="Buscar funcionário, protocolo, unidade…"
            aria-label="Buscar" className={`${inputCls} pl-9`} />
        </div>
        <Botao variante="secundario" aria-expanded={maisFiltros} onClick={() => setMaisFiltros((m) => !m)}>
          <SlidersHorizontal className="size-4" aria-hidden /> Filtros{nFiltrosExtras ? ` (${nFiltrosExtras})` : ''}
        </Botao>
      </div>

      {(maisFiltros || modo === 'periodo') && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-linha bg-white p-3 text-sm">
          {modo === 'periodo' && (
            <>
              <select value={periodo.campo} onChange={(e) => mudarPeriodo({ campo: e.target.value })} aria-label="Data usada" className={campoCls}>
                {tem('periodo') && <option value="data_inicio">{unica?.periodoOpcional ? 'Data da ocorrência' : 'Data de saída'}</option>}
                <option value="data_recebimento">Data de recebimento</option>
              </select>
              <span>de</span>
              <input type="date" value={periodo.de} onChange={(e) => mudarPeriodo({ de: e.target.value })} aria-label="De" className={campoCls} />
              <span>até</span>
              <input type="date" value={periodo.ate} onChange={(e) => mudarPeriodo({ ate: e.target.value })} aria-label="Até" className={campoCls} />
              <Botao variante="discreto" onClick={() => mudarPeriodo(mesAtual)}>Este mês</Botao>
              {maisFiltros && <span className="mx-1 h-6 w-px bg-linha" aria-hidden />}
            </>
          )}
          {maisFiltros && (
            <>
              {central && (
                <select value={fil.unidade} onChange={(e) => setFil({ ...fil, unidade: e.target.value })} aria-label="Unidade" className={campoCls}>
                  <option value="">Todas as unidades</option>
                  {opcoesUnidade.map((u) => <option key={u}>{u}</option>)}
                </select>
              )}
              <select value={fil.vinculo} onChange={(e) => setFil({ ...fil, vinculo: e.target.value })} aria-label="Vínculo" className={campoCls}>
                <option value="">Todos os vínculos</option>
                {opcoesVinculo.map((v) => <option key={v}>{v}</option>)}
              </select>
              <select value={fil.tipo} onChange={(e) => setFil({ ...fil, tipo: e.target.value })} aria-label="Tipo" className={campoCls}>
                <option value="">Todos os tipos</option>
                {tipos.map((t) => <option key={t}>{t}</option>)}
              </select>
              {temFiltro && <Botao variante="discreto" onClick={() => setFil(filtrosVazios)}>Limpar</Botao>}
            </>
          )}
        </div>
      )}

      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}
      {ok && <div className="mt-4"><Aviso tom="info">{ok}</Aviso></div>}

      {filaEnvio && !carregando && (
        <p className="mt-4 text-sm text-tinta-suave">
          Para mandar pedidos, ponto e avaliações juntos no mesmo Aviso, use{' '}
          <Link href="/envios-rh" className="font-semibold text-azul hover:underline">Envios RH</Link>: lá aparece tudo o que está pronto para o RH.
        </p>
      )}
      {filaEnvio && !carregando && livres.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-acento/30 bg-acento-claro/40 px-4 py-3">
          <p className="mr-auto text-sm">
            Marque e gere o <strong>Aviso</strong> numerado, pronto para imprimir.
            {sel.size === 0 && <span className="text-tinta-suave"> Nenhum marcado.</span>}
          </p>
          {DESTINOS_RH.map((d) => {
            const n = livres.filter((l) => sel.has(l.id) && l.destino_rh === d).length;
            return (
              <Botao key={d} disabled={n === 0} carregando={ocupado === d} onClick={() => gerarAviso(d)}>
                <Send className="size-4" aria-hidden /> Aviso ao {d} ({n})
              </Botao>
            );
          })}
        </div>
      )}
      <p className="mt-4 mb-2 text-sm text-tinta-suave" aria-live="polite">
        {carregando ? 'Carregando…' : `${visiveis.length} de ${lista.length} ${nome.muitos}`}
      </p>

      {/* Tabela */}
      <TabelaWrap>
        <table className="w-full text-sm">
          <thead>
            <tr>
              {filaEnvio && (
                <th className={`${thCls} w-10`}>
                  {livres.length > 0 && (
                    <input type="checkbox" checked={todosMarcados} aria-label="Marcar todos"
                      onChange={(e) => marcar(livres.map((l) => l.id), e.target.checked)} className="size-4 accent-[var(--acento)]" />
                  )}
                </th>
              )}
              <Th {...ord} chave="funcionario_nome">Funcionário</Th>
              <Th {...ord} chave="tipo">{soAvaliacoes ? 'Avaliação' : 'Pedido'}</Th>
              <Th {...ord} chave="data_recebimento">Recebido</Th>
              <Th {...ord} chave="situacao_rh">Situação</Th>
              {central && <th className={`${thCls} text-right`}><span className="sr-only">Ações</span></th>}
            </tr>
          </thead>
          <tbody>
            {!carregando && visiveis.length === 0 && (
              <tr><td colSpan={colunas} className={`${tdCls} py-8 text-center text-tinta-suave`}>
                {temFiltro ? `Nenhum(a) ${nome.um} com esses filtros.` : 'Nada aqui por enquanto.'}
              </td></tr>
            )}
            {pag.visiveis.map((l) => {
              const cfgL = CATEGORIAS[l.categoria];
              const s = situacao(l);
              const doc = primeiro(l.comunicados_1doc);
              const aviso = primeiro(l.aviso_rh_itens)?.aviso;
              const extras = [resumoHorarios(l), l.testemunha && `Testemunha: ${l.testemunha}`, l.venda_terco && 'com venda de 1/3'].filter(Boolean);
              return (
                <Fragment key={l.id}>
                  <tr className={`align-top hover:bg-papel/50 ${painel?.id === l.id ? 'bg-acento-claro/30' : ''}`}>
                    {filaEnvio && (
                      <td className={tdCls}>
                        {selecionavel(l) && (
                          <input type="checkbox" checked={sel.has(l.id)} aria-label={`Marcar ${l.protocolo_dae}`}
                            onChange={(e) => marcar([l.id], e.target.checked)} className="size-4 accent-[var(--acento)]" />
                        )}
                      </td>
                    )}
                    <td className={tdCls}>
                      <span className="font-medium">{l.funcionario_nome}</span>
                      <span className="block text-xs text-tinta-suave">
                        {[l.protocolo_dae, central && l.unidade_nome, l.segundo_vinculo ? `${l.vinculo} (2º vínculo)` : l.vinculo].filter(Boolean).join(' · ')}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <span>{l.tipo}</span>
                      {!unica && <span className="text-xs text-tinta-suave"> · {cfgL.titulo}</span>}
                      <span className="block text-xs text-tinta-suave">
                        {[textoRodada(l), l.motivo_ocorrencia, detalhe(l)].filter(Boolean).join(' · ')}
                      </span>
                      {extras.length > 0 && <span className="block text-xs text-tinta-suave">{extras.join(' · ')}</span>}
                      {l.obs && <span className="block max-w-80 truncate text-xs italic text-tinta-suave" title={l.obs}>{l.obs}</span>}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>{dataBR(l.data_recebimento)}</td>
                    <td className={tdCls}>
                      <Selo texto={s.selo} />
                      {s.linhas.map((t, i) => <span key={i} className="mt-1 block max-w-64 text-xs text-tinta-suave">{t}</span>)}
                      <span className="mt-1 flex flex-wrap gap-x-3 text-xs">
                        {aviso && central && (
                          <Link href={`/avisos-rh?aviso=${aviso.id}`} className="inline-flex items-center gap-1 font-semibold text-azul hover:underline">
                            <FileText className="size-3" aria-hidden /> Aviso {aviso.numero}
                          </Link>
                        )}
                        {cfgL.temUmDoc && doc?.situacao === 'Pendente' && (
                          <button type="button" onClick={() => setUmDoc(l)} className="font-semibold text-ocre-escuro hover:underline">1Doc pendente</button>
                        )}
                      </span>
                    </td>
                    {central && <td className={`${tdCls} whitespace-nowrap`}>{acoes(l)}</td>}
                  </tr>
                  {painelDaLinha(l)}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </TabelaWrap>
      <Paginacao p={pag} rotulo={nome.muitos} />

      {form.aberto && (
        <FormLancamento categoria={form.item?.categoria ?? (unica ? (cat as Categoria) : cats[0])}
          opcoesCategoria={unica ? [] : cats.filter((c) => central || CATEGORIAS[c].unidadeLanca)}
          perfil={perfil} lancamento={form.item}
          onFechar={() => setForm({ aberto: false, item: null })}
          onSalvo={() => { setForm({ aberto: false, item: null }); concluir(); }} />
      )}
      {umDoc && (
        <Painel1Doc lancamento={umDoc} podeEditar={central} onFechar={() => setUmDoc(null)}
          onSalvo={() => { setUmDoc(null); concluir(); }} />
      )}
    </div>
  );
}

/** Situação resumida: um selo + no máximo duas linhas */
function situacao(l: Lancamento): { selo: string; linhas: string[] } {
  const quem = l.diretor_nome ? `por ${l.diretor_nome}${l.data_assinatura ? ` em ${dataBR(l.data_assinatura)}` : ''}` : '';
  const enviado = ENVIADO.includes(l.situacao_rh);
  const envio = `${l.destino_rh ?? 'RH'}${l.enviado_rh_em ? ` em ${dataBR(l.enviado_rh_em.slice(0, 10))}` : ''}`;
  if (l.diretora === 'Devolvido' || l.diretora === 'Não autorizado') {
    return { selo: l.diretora, linhas: [l.diretora_obs ?? '', quem].filter(Boolean) };
  }
  if (l.categoria === 'avaliacoes') {
    const ultimo = l.avaliacao_trilha?.at(-1);
    const assinatura = l.diretora === 'Dispensado' ? 'Sem assinatura (promoção)' : l.diretora === 'Autorizado' ? `Assinada ${quem}` : 'Falta a assinatura';
    const nota = ultimo?.obs ? `“${ultimo.obs}”` : '';
    if (enviado) return { selo: 'Enviado ao RH', linhas: [envio, nota].filter(Boolean) };
    if (l.avaliacao_etapa === 'Na unidade') {
      return { selo: 'Na unidade', linhas: [`desde ${dataBR(l.avaliacao_unidade_em)}`, nota, assinatura].filter(Boolean) };
    }
    return {
      selo: assinado(l) ? 'Pronto para o RH' : 'Na DAE',
      linhas: [assinatura, ultimo && !assinado(l) ? `${ultimo.evento} em ${dataBR(ultimo.em)}` : ''].filter(Boolean),
    };
  }
  if (enviado) return { selo: 'Enviado ao RH', linhas: [envio] };
  if (assinado(l)) return { selo: 'Pronto para o RH', linhas: [`Assinado ${quem}`, l.destino_rh ? '' : 'falta escolher o RH'].filter(Boolean) };
  return { selo: 'Aguardando assinatura', linhas: [] };
}

// ---------- Peças ----------

type OpcaoEscolha<T extends string> = { valor: T; titulo: string; ajuda?: string; desativada?: boolean };
/** Opções grandes, uma ao lado da outra (escolha única) */
function Escolhas<T extends string>({ valor, onChange, opcoes }: { valor: T | null; onChange: (v: T) => void; opcoes: OpcaoEscolha<T>[] }) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {opcoes.map((o) => (
        <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor} disabled={o.desativada}
          onClick={() => onChange(o.valor)}
          className={`min-w-40 rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            valor === o.valor ? 'border-acento bg-white ring-2 ring-acento/30' : 'border-linha bg-white hover:border-acento/60'}`}>
          <span className="block font-semibold">{o.titulo}</span>
          {o.ajuda && <span className="block text-xs text-tinta-suave">{o.ajuda}</span>}
        </button>
      ))}
    </div>
  );
}

type ItemMenu = { rotulo: string; icone: typeof Pencil; onClick: () => void; perigo?: boolean };
/** Botão "⋯" com as ações menos usadas (fica por cima da tabela, sem ser cortado) */
function MenuAcoes({ itens, rotulo }: { itens: ItemMenu[]; rotulo: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pos) return;
    const fechar = (e: Event) => {
      if (e instanceof MouseEvent && (menu.current?.contains(e.target as Node) || botao.current?.contains(e.target as Node))) return;
      setPos(null);
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setPos(null);
    document.addEventListener('mousedown', fechar);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    document.addEventListener('keydown', tecla);
    menu.current?.querySelector('button')?.focus();
    return () => {
      document.removeEventListener('mousedown', fechar);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
      document.removeEventListener('keydown', tecla);
    };
  }, [pos]);

  function abrir() {
    if (pos) return setPos(null);
    const r = botao.current!.getBoundingClientRect();
    const largura = 224, altura = itens.length * 36 + 12;
    const top = r.bottom + altura + 8 > window.innerHeight ? r.top - altura - 4 : r.bottom + 4;
    setPos({ top, left: Math.max(8, r.right - largura) });
  }

  return (
    <>
      <button ref={botao} type="button" aria-label={rotulo} aria-haspopup="menu" aria-expanded={!!pos} onClick={abrir}
        className="rounded-md p-1.5 text-tinta-suave hover:bg-papel hover:text-tinta">
        <MoreHorizontal className="size-4" />
      </button>
      {pos && (
        <div ref={menu} role="menu" style={{ position: 'fixed', top: pos.top, left: pos.left, width: 224 }}
          className="z-50 rounded-md border border-linha bg-white py-1.5 shadow-lg">
          {itens.map(({ rotulo: r, icone: Icone, onClick, perigo }) => (
            <button key={r} type="button" role="menuitem" onClick={() => { setPos(null); onClick(); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-papel focus:bg-papel focus:outline-none ${perigo ? 'text-erro' : 'text-tinta'}`}>
              <Icone className="size-4 shrink-0" aria-hidden /> {r}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** Título de coluna que ordena ao clicar */
function Th({ chave, ordem, onOrdenar, children }: {
  chave?: keyof Lancamento; ordem: Ordem; onOrdenar: (o: Ordem) => void; children: React.ReactNode;
}) {
  if (!chave) return <th className={thCls}>{children}</th>;
  const ativa = ordem.chave === chave;
  return (
    <th className={thCls} aria-sort={ativa ? (ordem.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-tinta"
        onClick={() => onOrdenar({ chave, dir: ativa ? (ordem.dir === 1 ? -1 : 1) : 1 })}>
        {children}<span className="text-[10px]">{ativa ? (ordem.dir === 1 ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );
}
