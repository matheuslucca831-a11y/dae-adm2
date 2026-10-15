'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Check, CornerDownLeft, FileText, Pencil, Plus, Search, Send, Trash2, Undo2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { competenciaAtual, dataBR, fimDoMes, hojeISO, mensagemErro, normalizar } from '@/lib/formato';
import {
  CAMPOS_TABELA, CATEGORIAS, DESTINOS_RH, SITUACOES_ANDAMENTO, TIPO_PROMOCAO, detalhe, podeEditar, primeiro, resumoHorarios, textoDecisao,
  type Categoria, type Decisao, type Lancamento,
} from '@/lib/lancamentos';
import type { Perfil } from '@/lib/types';
import { buscarTudo } from '@/lib/buscarTudo';
import { gravarCache, lerCache } from '@/lib/cacheTela';
import { Paginacao, usePaginacao } from '@/components/Paginacao';
import { Aviso, Botao, Selo, TabelaWrap, campoCls, inputCls, tdCls, thCls } from '@/components/ui';
import FormLancamento from './FormLancamento';
import Painel1Doc from './Painel1Doc';
import Etapas from './Etapas';

/** Filas de trabalho da DAE e visões da unidade */
type Modo = 'receber' | 'unidade' | 'assinatura' | 'enviar' | 'andamento' | 'periodo';
/** Pedidos: assinatura → envio ao RH (o pedido termina quando vai ao RH) */
const MODOS_PEDIDOS: [Modo, string][] = [['assinatura', 'Aguardando assinatura'], ['enviar', 'Enviar ao RH'], ['periodo', 'Todos (por período)']];
/** Avaliações: recebida do RH → unidade → devolvida → assinatura → envio ao RH */
const MODOS_AVALIACOES: [Modo, string][] = [
  ['receber', 'Recebidas do RH'], ['unidade', 'Com a unidade'], ['assinatura', 'Devolvidas pela unidade'],
  ['enviar', 'Enviar ao RH'], ['periodo', 'Todos (por período)'],
];
const MODOS_UNIDADE: [Modo, string][] = [['andamento', 'Em andamento'], ['periodo', 'Todos (por período)']];

/** Filtros (coluna = valor) de cada fila */
function filtrosDaFila(modo: Modo, soAvaliacoes: boolean): [string, string][] {
  switch (modo) {
    case 'receber': return [['avaliacao_etapa', 'Na DAE'], ['diretora', 'Aguardando']];
    case 'unidade': return [['avaliacao_etapa', 'Na unidade'], ['diretora', 'Aguardando']];
    case 'assinatura': return soAvaliacoes ? [['avaliacao_etapa', 'Devolvida'], ['diretora', 'Aguardando']] : [['diretora', 'Aguardando']];
    case 'enviar': return [['situacao_rh', 'Autorizado / Aguardando envio']];
    default: return [];
  }
}

type Ordem = { chave: keyof Lancamento; dir: 1 | -1 };
type Diretor = { id: string; nome: string; cargo: string | null };
type Decidindo = { id: string; decisao: Decisao; obs: string; diretor_id: string; data: string };
type FiltroCategoria = Categoria | 'todas';

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
  const temUmDoc = cats.some((c) => CATEGORIAS[c].temUmDoc);
  const tipos = [...new Set(cats.flatMap((c) => CATEGORIAS[c].tipos))];
  const soAvaliacoes = categorias.length === 1 && categorias[0] === 'avaliacoes';
  const modos = central ? (soAvaliacoes ? MODOS_AVALIACOES : MODOS_PEDIDOS) : MODOS_UNIDADE;
  const decisoes: Decisao[] = ['Aguardando', 'Autorizado', 'Devolvido', 'Não autorizado', ...(soAvaliacoes ? ['Dispensado' as Decisao] : [])];

  const mesAtual = { de: competenciaAtual(), ate: fimDoMes(competenciaAtual()) };
  const [modo, setModo] = useState<Modo>(modos[0][0]);
  const [periodo, setPeriodo] = useState({ campo: dataPadrao as string, ...mesAtual });
  const [versao, setVersao] = useState(0);
  const [lista, setLista] = useState<Lancamento[]>([]);
  const [contagem, setContagem] = useState<Partial<Record<Modo, number>>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const filtrosVazios = { busca: '', unidade: '', vinculo: '', tipo: '', decisao: '' };
  const [fil, setFil] = useState(filtrosVazios);
  const [ordem, setOrdem] = useState<Ordem>({ chave: dataPadrao, dir: 1 });

  const [form, setForm] = useState<{ aberto: boolean; item: Lancamento | null }>({ aberto: false, item: null });
  const [umDoc, setUmDoc] = useState<Lancamento | null>(null);
  const [decidindo, setDecidindo] = useState<Decidindo | null>(null);
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
        if (f.length) f.forEach(([col, val]) => { q = q.eq(col, val); });
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
        filtrosDaFila(m, soAvaliacoes).forEach(([col, val]) => { c = c.eq(col, val); });
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
      (!fil.decisao || l.diretora === fil.decisao) &&
      (!t || normalizar(`${l.funcionario_nome} ${l.protocolo_dae} ${l.obs ?? ''}`).includes(t)));
    return arr.sort((a, b) => {
      const va = a[ordem.chave] ?? '', vb = b[ordem.chave] ?? '';
      const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR');
      return r * ordem.dir || a.protocolo_dae.localeCompare(b.protocolo_dae);
    });
  }, [lista, fil, ordem]);
  const pag = usePaginacao(visiveis);

  const temFiltro = Object.values(fil).some(Boolean);
  const pendentes1Doc = lista.filter((l) => primeiro(l.comunicados_1doc)?.situacao === 'Pendente').length;

  function trocarModo(m: Modo) {
    setCarregando(true);
    setDecidindo(null);
    setModo(m);
  }
  function trocarCategoria(c: FiltroCategoria) {
    const campo = c === 'todas' ? 'data_recebimento' : CATEGORIAS[c].dataPrincipal;
    setCarregando(true);
    setDecidindo(null);
    setCat(c);
    setFil(filtrosVazios);
    setPeriodo((x) => ({ ...x, campo }));
    setOrdem({ chave: campo, dir: 1 });
  }
  function mudarPeriodo(p: Partial<typeof periodo>) {
    setCarregando(true);
    setPeriodo((x) => ({ ...x, ...p }));
  }

  // ---------- Ações ----------
  async function atualizar(l: Lancamento, patch: Record<string, unknown>) {
    setOcupado(l.id);
    const { error } = await supabase.from('lancamentos').update(patch).eq('id', l.id);
    setOcupado(null);
    if (error) return setErro(mensagemErro(error));
    setErro(null);
    setDecidindo(null);
    setVersao((v) => v + 1);
  }

  function abrirDecisao(l: Lancamento, decisao: Decisao) {
    const padrao = ultimoDiretor || (diretores.length === 1 ? diretores[0].id : '');
    setDecidindo({ id: l.id, decisao, obs: '', diretor_id: padrao, data: hojeISO() });
  }

  function confirmarDecisao(l: Lancamento, d: Decidindo) {
    if (!d.diretor_id) return setErro('Escolha qual diretor(a) assinou.');
    if (d.decisao !== 'Autorizado' && !d.obs.trim()) return setErro('Escreva a justificativa.');
    setUltimoDiretor(d.diretor_id);
    atualizar(l, { diretora: d.decisao, diretora_obs: d.obs.trim() || null, diretor_id: d.diretor_id, data_assinatura: d.data || null });
  }

  function desfazerDecisao(l: Lancamento) {
    if (!window.confirm(`Desfazer a decisão do pedido ${l.protocolo_dae}? Ele volta para "Aguardando assinatura".`)) return;
    atualizar(l, { diretora: 'Aguardando', diretora_obs: null });
  }

  async function excluir(l: Lancamento) {
    if (!window.confirm(`Excluir o lançamento ${l.protocolo_dae} de ${l.funcionario_nome}?`)) return;
    const { error } = await supabase.from('lancamentos').delete().eq('id', l.id);
    if (error) return setErro(mensagemErro(error));
    setVersao((v) => v + 1);
  }

  // ---------- Peças da tabela ----------
  const btnIcone = 'rounded p-1.5 disabled:opacity-50';

  const ord = { ordem, onOrdenar: setOrdem };

  function acaoEtapa(l: Lancamento) {
    const ocup = ocupado === l.id;
    const voltarEtapa = (para: 'Na DAE' | 'Na unidade', texto: string) => (
      <button type="button" title={texto} disabled={ocup} onClick={() => {
        if (window.confirm(`${texto}?`)) atualizar(l, { avaliacao_etapa: para });
      }} className={`${btnIcone} text-tinta-suave hover:bg-papel hover:text-tinta`}><CornerDownLeft className="size-4" /></button>
    );
    // Avaliação: etapas antes da assinatura
    if (l.categoria === 'avaliacoes' && l.diretora === 'Aguardando') {
      if (l.avaliacao_etapa === 'Na DAE') {
        return (
          <Botao variante="secundario" className="px-2.5 py-1.5 text-xs" carregando={ocup}
            onClick={() => atualizar(l, { avaliacao_etapa: 'Na unidade' })}>
            <Send className="size-3.5" aria-hidden /> Enviar à unidade
          </Botao>
        );
      }
      if (l.avaliacao_etapa === 'Na unidade') {
        return (
          <div className="flex items-center gap-1">
            <Botao variante="secundario" className="px-2.5 py-1.5 text-xs" carregando={ocup}
              onClick={() => atualizar(l, { avaliacao_etapa: 'Devolvida' })}>
              <CornerDownLeft className="size-3.5" aria-hidden /> Unidade devolveu
            </Botao>
            {voltarEtapa('Na DAE', 'Desfazer o envio à unidade')}
          </div>
        );
      }
      if (l.tipo === TIPO_PROMOCAO) {
        return (
          <div className="flex items-center gap-1">
            <Botao className="px-2.5 py-1.5 text-xs" carregando={ocup} onClick={() => atualizar(l, { diretora: 'Dispensado' })}>
              <Check className="size-3.5" aria-hidden /> Pronta para o RH
            </Botao>
            {voltarEtapa('Na unidade', 'Desfazer a devolução da unidade')}
          </div>
        );
      }
    }
    if (l.diretora === 'Aguardando') {
      return (
        <div className="flex gap-1">
          <button type="button" title="Registrar assinatura (autorizado)" disabled={ocup} onClick={() => abrirDecisao(l, 'Autorizado')}
            className={`${btnIcone} bg-pinho-claro text-pinho-escuro hover:bg-pinho hover:text-white`}><Check className="size-4" /></button>
          <button type="button" title="Devolver" onClick={() => abrirDecisao(l, 'Devolvido')}
            className={`${btnIcone} bg-ocre-claro text-ocre-escuro hover:bg-ocre hover:text-white`}><Undo2 className="size-4" /></button>
          <button type="button" title="Não autorizar" onClick={() => abrirDecisao(l, 'Não autorizado')}
            className={`${btnIcone} bg-erro-claro text-erro hover:bg-erro hover:text-white`}><X className="size-4" /></button>
          {l.categoria === 'avaliacoes' && voltarEtapa('Na unidade', 'Desfazer a devolução da unidade')}
        </div>
      );
    }
    if (l.situacao_rh === 'Autorizado / Aguardando envio') {
      if (primeiro(l.aviso_rh_itens)?.aviso) return <span className="text-xs text-tinta-suave">no aviso, aguardando entrega</span>;
      if (!l.destino_rh) {
        return (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-tinta-suave">Vai para:</span>
            {DESTINOS_RH.map((d) => (
              <Botao key={d} variante="secundario" className="px-2 py-1 text-xs" carregando={ocup} onClick={() => atualizar(l, { destino_rh: d })}>{d}</Botao>
            ))}
          </div>
        );
      }
      return (
        <button type="button" disabled={ocup} onClick={() => {
          if (window.confirm(`Marcar ${l.protocolo_dae} como enviado ao ${l.destino_rh} sem gerar aviso?`)) atualizar(l, { situacao_rh: 'Enviado ao RH' });
        }} className="text-xs font-medium text-tinta-suave underline hover:text-tinta disabled:opacity-50">
          enviar sem aviso
        </button>
      );
    }
    return null;
  }

  // ---------- Gerar aviso direto da fila "Enviar ao RH" ----------
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

  const colunas = (filaEnvio ? 1 : 0) + 8 + (central ? 2 : 0) + (unica ? (tem('periodo') ? 3 : 0) + (tem('referencia') ? 1 : 0) + (tem('quantidade') ? 1 : 0) : 1) +
    (temUmDoc ? 1 : 0);

  return (
    <div className="w-full">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{titulo}</h1>
          <p className="mt-1 text-tinta-suave">
            {podeLancar ? descricao : 'Acompanhe os pedidos da sua unidade: assinatura da Diretoria, envio ao RH e arquivamento.'}
          </p>
        </div>
        {podeLancar && <Botao onClick={() => setForm({ aberto: true, item: null })}><Plus className="size-4" aria-hidden /> {soAvaliacoes ? 'Registrar avaliação recebida do RH' : 'Registrar pedido'}</Botao>}
      </div>

      {/* Categorias */}
      {categorias.length > 1 && (
        <div role="tablist" aria-label="Tipo de pedido" className="mt-6 flex flex-wrap gap-x-1 border-b border-linha">
          {(['todas', ...categorias] as FiltroCategoria[]).map((c) => (
            <button key={c} role="tab" type="button" aria-selected={cat === c} onClick={() => trocarCategoria(c)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                cat === c ? 'border-acento text-acento-escuro' : 'border-transparent text-tinta-suave hover:text-tinta'}`}>
              {c === 'todas' ? 'Todos os pedidos' : CATEGORIAS[c].titulo}
            </button>
          ))}
        </div>
      )}

      {/* Filas */}
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
        {modo === 'periodo' && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select value={periodo.campo} onChange={(e) => mudarPeriodo({ campo: e.target.value })} aria-label="Data usada" className={campoCls}>
              {tem('periodo') && <option value="data_inicio">{unica?.periodoOpcional ? 'Data da ocorrência' : 'Data de saída'}</option>}
              <option value="data_recebimento">Data de recebimento</option>
            </select>
            <span>de</span>
            <input type="date" value={periodo.de} onChange={(e) => mudarPeriodo({ de: e.target.value })} aria-label="De" className={campoCls} />
            <span>até</span>
            <input type="date" value={periodo.ate} onChange={(e) => mudarPeriodo({ ate: e.target.value })} aria-label="Até" className={campoCls} />
            <Botao variante="discreto" onClick={() => mudarPeriodo(mesAtual)}>Este mês</Botao>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-suave" aria-hidden />
          <input value={fil.busca} onChange={(e) => setFil({ ...fil, busca: e.target.value })} placeholder="Funcionário, protocolo ou observação"
            aria-label="Buscar" className={`${inputCls} pl-9`} />
        </div>
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
        <select value={fil.decisao} onChange={(e) => setFil({ ...fil, decisao: e.target.value })} aria-label="Diretoria" className={campoCls}>
          <option value="">Diretoria: todas</option>
          {decisoes.map((d) => <option key={d} value={d}>{textoDecisao(d)}</option>)}
        </select>
        {temFiltro && <Botao variante="discreto" onClick={() => setFil(filtrosVazios)}>Limpar filtros</Botao>}
      </div>

      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}

      {filaEnvio && !carregando && livres.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-acento/30 bg-acento-claro/40 px-4 py-3">
          <p className="mr-auto text-sm">
            Marque os pedidos e gere o <strong>Aviso numerado</strong>, que já sai pronto para imprimir.
            {sel.size === 0 && <span className="text-tinta-suave"> Nenhum marcado.</span>}
          </p>
          {DESTINOS_RH.map((d) => {
            const n = livres.filter((l) => sel.has(l.id) && l.destino_rh === d).length;
            return (
              <Botao key={d} disabled={n === 0} carregando={ocupado === d} onClick={() => gerarAviso(d)}>
                <Send className="size-4" aria-hidden /> Gerar aviso ao {d} ({n})
              </Botao>
            );
          })}
        </div>
      )}
      <p className="mt-4 mb-2 text-sm text-tinta-suave" aria-live="polite">
        {carregando ? 'Carregando…' : `${visiveis.length} de ${lista.length} pedidos`}
        {!carregando && central && temUmDoc && pendentes1Doc > 0 && `, ${pendentes1Doc} com 1Doc pendente`}
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
              <Th {...ord} chave="protocolo_dae">Protocolo</Th>
              <Th {...ord} chave="funcionario_nome">Funcionário</Th>
              {central && <Th {...ord} chave="unidade_nome">Unidade</Th>}
              <Th {...ord} chave="vinculo">Vínculo</Th>
              <Th {...ord} chave="tipo">Tipo</Th>
              <Th {...ord} chave="data_recebimento">Recebido</Th>
              {!unica && <Th {...ord} chave="data_inicio">Período / Detalhe</Th>}
              {tem('periodo') && <><Th {...ord} chave="data_inicio">{unica?.periodoOpcional ? 'Data' : 'Saída'}</Th><Th {...ord} chave="qtd_dias">Dias</Th><Th {...ord} chave="data_retorno">Retorno</Th></>}
              {tem('referencia') && <Th {...ord} chave="referencia">Referência</Th>}
              {tem('quantidade') && <Th {...ord}>Qtd.</Th>}
              <Th {...ord}>Obs.</Th>
              <Th {...ord} chave="diretora">Diretoria</Th>
              <Th {...ord} chave="situacao_rh">Andamento</Th>
              {temUmDoc && <Th {...ord}>1Doc</Th>}
              {central && <Th {...ord}>Próximo passo</Th>}
            </tr>
          </thead>
          <tbody>
            {!carregando && visiveis.length === 0 && (
              <tr><td colSpan={colunas} className={`${tdCls} py-8 text-center text-tinta-suave`}>
                {temFiltro ? 'Nenhum pedido com esses filtros.' : 'Nenhum pedido aqui.'}
              </td></tr>
            )}
            {pag.visiveis.map((l) => {
              const cfgL = CATEGORIAS[l.categoria];
              const lancaL = central || cfgL.unidadeLanca;
              const editavel = lancaL && podeEditar(l) && (central || l.unidade_id === perfil.unidade_id);
              const excluivel = central ? !['Enviado ao RH', 'Concluído'].includes(l.situacao_rh) : lancaL && l.diretora === 'Aguardando';
              const aviso = primeiro(l.aviso_rh_itens)?.aviso;
              const doc = primeiro(l.comunicados_1doc);
              return (
                <Fragment key={l.id}>
                  <tr className="align-top hover:bg-papel/50">
                    {filaEnvio && (
                      <td className={tdCls}>
                        {selecionavel(l) && (
                          <input type="checkbox" checked={sel.has(l.id)} aria-label={`Marcar ${l.protocolo_dae}`}
                            onChange={(e) => marcar([l.id], e.target.checked)} className="size-4 accent-[var(--acento)]" />
                        )}
                      </td>
                    )}
                    <td className={`${tdCls} whitespace-nowrap font-mono text-xs`}>{l.protocolo_dae}</td>
                    <td className={`${tdCls} font-medium`}>{l.funcionario_nome}</td>
                    {central && <td className={tdCls}>{l.unidade_nome}</td>}
                    <td className={`${tdCls} whitespace-nowrap`}>{l.vinculo}</td>
                    <td className={tdCls}>
                      {l.tipo}
                      {!unica && <span className="block text-xs text-tinta-suave">{cfgL.titulo}</span>}
                      {l.venda_terco && <span className="block text-xs text-tinta-suave">com venda de 1/3</span>}
                      {l.motivo_ocorrencia && <span className="block text-xs font-medium">{l.motivo_ocorrencia}</span>}
                      {resumoHorarios(l) && <span className="block text-xs text-tinta-suave">{resumoHorarios(l)}</span>}
                      {l.testemunha && <span className="block text-xs text-tinta-suave">Testemunha: {l.testemunha}</span>}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>{dataBR(l.data_recebimento)}</td>
                    {!unica && <td className={`${tdCls} whitespace-nowrap`}>{detalhe(l)}</td>}
                    {tem('periodo') && (
                      <>
                        <td className={`${tdCls} whitespace-nowrap`}>{dataBR(l.data_inicio)}</td>
                        <td className={tdCls}>{l.qtd_dias}</td>
                        <td className={`${tdCls} whitespace-nowrap`}>{dataBR(l.data_retorno)}</td>
                      </>
                    )}
                    {tem('referencia') && <td className={tdCls}>{l.referencia}</td>}
                    {tem('quantidade') && <td className={tdCls}>{l.quantidade}</td>}
                    <td className={`${tdCls} max-w-56`}><span className="line-clamp-2 text-xs" title={l.obs ?? ''}>{l.obs}</span></td>
                    <td className={tdCls}>
                      <Selo texto={textoDecisao(l.diretora)} />
                      {l.diretor_nome && (
                        <span className="mt-1 block text-xs">
                          por <strong>{l.diretor_nome}</strong>
                          {l.data_assinatura && <span className="text-tinta-suave"> em {dataBR(l.data_assinatura)}</span>}
                        </span>
                      )}
                      {l.diretora_obs && <span className="mt-1 block max-w-48 text-xs text-tinta-suave">{l.diretora_obs}</span>}
                      {central && l.diretora !== 'Aguardando' && !['Enviado ao RH', 'Concluído'].includes(l.situacao_rh) && (
                        <button type="button" onClick={() => desfazerDecisao(l)} className="mt-1 block text-xs font-medium text-tinta-suave underline hover:text-tinta">
                          desfazer
                        </button>
                      )}
                    </td>
                    <td className={tdCls}>
                      <Etapas l={l} />
                      {aviso && central && (
                        <Link href={`/avisos-rh?aviso=${aviso.id}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-azul hover:underline">
                          <FileText className="size-3" aria-hidden /> Aviso {aviso.numero}
                        </Link>
                      )}
                    </td>
                    {temUmDoc && (
                      <td className={tdCls}>
                        {cfgL.temUmDoc && doc ? (
                          <button type="button" onClick={() => setUmDoc(l)}
                            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                              doc.situacao === 'Pendente' ? 'bg-ocre-claro text-ocre-escuro ring-ocre/20' : 'bg-pinho-claro text-pinho-escuro ring-pinho/20'}`}>
                            <FileText className="size-3" aria-hidden /> {doc.situacao === 'Pendente' ? 'Pendente' : 'Enviado'}
                          </button>
                        ) : <span className="text-xs text-tinta-suave">—</span>}
                      </td>
                    )}
                    {central && (
                      <td className={tdCls}>
                        <div className="flex items-start gap-1">
                          {acaoEtapa(l)}
                          {editavel && (
                            <button type="button" title="Editar" onClick={() => setForm({ aberto: true, item: l })}
                              className={`${btnIcone} text-tinta-suave hover:bg-papel hover:text-tinta`}><Pencil className="size-4" /></button>
                          )}
                          {excluivel && (
                            <button type="button" title="Excluir" onClick={() => excluir(l)}
                              className={`${btnIcone} text-tinta-suave hover:bg-erro-claro hover:text-erro`}><Trash2 className="size-4" /></button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  {decidindo?.id === l.id && (
                    <tr className="bg-acento-claro/40">
                      <td colSpan={colunas} className={tdCls}>
                        <div className="flex flex-wrap items-end gap-3 py-1">
                          <span className="self-center text-sm font-semibold">
                            {{ Autorizado: 'Registrar assinatura', Devolvido: 'Devolver', 'Não autorizado': 'Não autorizar', Aguardando: '', Dispensado: '' }[decidindo.decisao]}
                          </span>
                          {diretores.length === 0 ? (
                            <span className="self-center text-sm text-erro">Nenhum diretor cadastrado. Cadastre no Supabase (tabela diretores).</span>
                          ) : (
                            <label className="text-xs font-semibold text-tinta-suave">
                              Quem assinou *
                              <select value={decidindo.diretor_id} onChange={(e) => setDecidindo({ ...decidindo, diretor_id: e.target.value })}
                                className={`${campoCls} mt-1 block min-w-56 text-tinta`}>
                                <option value="">Selecione</option>
                                {diretores.map((d) => <option key={d.id} value={d.id}>{d.nome}{d.cargo ? ` (${d.cargo})` : ''}</option>)}
                              </select>
                            </label>
                          )}
                          <label className="text-xs font-semibold text-tinta-suave">
                            Data da assinatura
                            <input type="date" value={decidindo.data} onChange={(e) => setDecidindo({ ...decidindo, data: e.target.value })}
                              className={`${campoCls} mt-1 block text-tinta`} />
                          </label>
                          {decidindo.decisao !== 'Autorizado' && (
                            <label className="min-w-64 flex-1 text-xs font-semibold text-tinta-suave">
                              Justificativa *
                              <input autoFocus value={decidindo.obs} onChange={(e) => setDecidindo({ ...decidindo, obs: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && confirmarDecisao(l, decidindo)}
                                className={`${inputCls} mt-1 text-tinta`} />
                            </label>
                          )}
                          <Botao variante={decidindo.decisao === 'Não autorizado' ? 'perigo' : 'primario'} carregando={ocupado === l.id}
                            onClick={() => confirmarDecisao(l, decidindo)}>Confirmar</Botao>
                          <Botao variante="discreto" onClick={() => setDecidindo(null)}>Cancelar</Botao>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </TabelaWrap>
      <Paginacao p={pag} rotulo="pedidos" />

      {form.aberto && (
        <FormLancamento categoria={form.item?.categoria ?? (unica ? (cat as Categoria) : cats[0])}
          opcoesCategoria={unica ? [] : cats.filter((c) => central || CATEGORIAS[c].unidadeLanca)}
          perfil={perfil} lancamento={form.item}
          onFechar={() => setForm({ aberto: false, item: null })}
          onSalvo={() => { setForm({ aberto: false, item: null }); setVersao((v) => v + 1); }} />
      )}
      {umDoc && (
        <Painel1Doc lancamento={umDoc} podeEditar={central} onFechar={() => setUmDoc(null)}
          onSalvo={() => { setUmDoc(null); setVersao((v) => v + 1); }} />
      )}
    </div>
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
