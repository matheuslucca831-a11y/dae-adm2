'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Search, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { dataBR, mensagemErro, normalizar } from '@/lib/formato';
import { CAMPOS_TABELA, CATEGORIAS, DESTINOS_RH, detalhe, primeiro, type Categoria, type Lancamento } from '@/lib/lancamentos';
import { buscarTudo } from '@/lib/buscarTudo';
import { Paginacao, usePaginacao } from '@/components/Paginacao';
import { Aviso, Botao, TabelaWrap, campoCls, inputCls, tdCls, thCls } from '@/components/ui';

const SEM_DESTINO = 'Sem destino';

type Situacao = 'livres' | 'aviso' | 'todos';
const SITUACOES: [Situacao, string][] = [['livres', 'Ainda sem Aviso'], ['aviso', 'Já em Aviso'], ['todos', 'Todos']];
type Filtros = { situacao: Situacao; busca: string; categoria: '' | Categoria; unidade: string; rh: string };
const FILTROS_INICIAIS: Filtros = { situacao: 'livres', busca: '', categoria: '', unidade: '', rh: '' };

const avisoDe = (l: Lancamento) => primeiro(l.aviso_rh_itens)?.aviso ?? null;

/** Tudo o que está pronto para o RH (pedidos, ponto e avaliações), agrupado por RH, para gerar um Aviso só */
export default function EnviosRH() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [lista, setLista] = useState<Lancamento[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [fil, setFil] = useState<Filtros>(FILTROS_INICIAIS);

  useEffect(() => {
    let vivo = true;
    buscarTudo<Lancamento>((de, ate) => supabase.from('lancamentos').select(CAMPOS_TABELA)
      .eq('situacao_rh', 'Autorizado / Aguardando envio')
      .order('funcionario_nome').order('id').range(de, ate) as unknown as PromiseLike<{ data: Lancamento[] | null; error: null }>)
      .then(({ data, error }) => {
        if (!vivo) return;
        // avaliação que está com a unidade ainda não está na mão da DAE
        const ls = (data ?? []).filter((l) => l.avaliacao_etapa !== 'Na unidade');
        setLista(ls);
        // já marca todos que ainda não estão em nenhum aviso
        setSelecionados(new Set(ls.filter((l) => !avisoDe(l)).map((l) => l.id)));
        setErro(error ? mensagemErro(error) : null);
        setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [supabase, versao]);

  const nLivres = useMemo(() => lista.filter((l) => !avisoDe(l)).length, [lista]);
  const contagem: Record<Situacao, number> = { livres: nLivres, aviso: lista.length - nLivres, todos: lista.length };
  const unidades = useMemo(() => [...new Set(lista.map((l) => l.unidade_nome).filter(Boolean))].sort() as string[], [lista]);
  const categorias = useMemo(() => [...new Set(lista.map((l) => l.categoria))], [lista]);

  const filtrada = useMemo(() => {
    const t = normalizar(fil.busca.trim());
    return lista.filter((l) =>
      (fil.situacao === 'todos' || (fil.situacao === 'aviso') === !!avisoDe(l)) &&
      (!fil.categoria || l.categoria === fil.categoria) &&
      (!fil.unidade || l.unidade_nome === fil.unidade) &&
      (!fil.rh || (l.destino_rh ?? SEM_DESTINO) === fil.rh) &&
      (!t || normalizar(`${l.funcionario_nome} ${l.protocolo_dae} ${l.tipo} ${avisoDe(l)?.numero ?? ''}`).includes(t)));
  }, [lista, fil]);

  const grupos = useMemo(() => {
    const g = new Map<string, Lancamento[]>();
    for (const d of [...DESTINOS_RH, SEM_DESTINO]) g.set(d, []);
    for (const l of filtrada) {
      const d = l.destino_rh ?? SEM_DESTINO;
      if (!g.has(d)) g.set(d, []);
      g.get(d)!.push(l);
    }
    return [...g.entries()].filter(([, ls]) => ls.length > 0);
  }, [filtrada]);

  const porCategoria = useMemo(() => {
    const c = new Map<Categoria, number>();
    for (const l of lista.filter((x) => !avisoDe(x))) c.set(l.categoria, (c.get(l.categoria) ?? 0) + 1);
    return [...c.entries()];
  }, [lista]);

  const temFiltro = fil.busca || fil.categoria || fil.unidade || fil.rh;

  function alternar(ids: string[], marcar: boolean) {
    setSelecionados((s) => {
      const n = new Set(s);
      ids.forEach((id) => (marcar ? n.add(id) : n.delete(id)));
      return n;
    });
  }

  async function definirDestino(l: Lancamento, destino: string) {
    setOcupado(l.id);
    const { error } = await supabase.from('lancamentos').update({ destino_rh: destino }).eq('id', l.id);
    setOcupado(null);
    if (error) return setErro(mensagemErro(error));
    setVersao((v) => v + 1);
  }

  async function gerar(destino: string, ids: string[]) {
    setOcupado(destino);
    const { data, error } = await supabase.rpc('gerar_aviso_rh', { p_lancamentos: ids });
    setOcupado(null);
    if (error) return setErro(mensagemErro(error));
    router.push(`/avisos-rh?aviso=${data}&voltar=%2Fenvios-rh`);
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold">Envios RH</h1>
      <p className="mt-1 text-tinta-suave">
        Tudo o que está pronto para o RH num lugar só: pedidos, ponto e avaliações já assinados, separados por RH.
        Marque o que vai junto e gere um Aviso numerado para imprimir.
      </p>
      {porCategoria.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-tinta-suave">Ainda sem Aviso:</span>
          {porCategoria.map(([c, n]) => {
            const ativo = fil.categoria === c;
            return (
              <button key={c} type="button" aria-pressed={ativo}
                onClick={() => setFil({ ...fil, situacao: 'livres', categoria: ativo ? '' : c })}
                className={`rounded-full px-2.5 py-0.5 font-semibold transition-colors ${
                  ativo ? 'bg-acento text-white' : 'bg-acento-claro text-acento-escuro hover:bg-acento/20'}`}>
                {CATEGORIAS[c].titulo}: {n}
              </button>
            );
          })}
        </div>
      )}

      {/* Filtros */}
      {!carregando && lista.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Situação" className="inline-flex flex-wrap rounded-md border border-linha bg-white p-1">
            {SITUACOES.map(([v, r]) => (
              <button key={v} role="tab" type="button" aria-selected={fil.situacao === v} onClick={() => setFil({ ...fil, situacao: v })}
                className={`rounded px-3 py-1.5 text-sm font-semibold ${fil.situacao === v ? 'bg-acento text-white' : 'text-tinta-suave hover:text-tinta'}`}>
                {r}
                <span className={`ml-1.5 rounded-full px-1.5 text-xs ${fil.situacao === v ? 'bg-white/25' : 'bg-acento-claro text-acento-escuro'}`}>{contagem[v]}</span>
              </button>
            ))}
          </div>
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-suave" aria-hidden />
            <input value={fil.busca} onChange={(e) => setFil({ ...fil, busca: e.target.value })}
              placeholder="Buscar funcionário, protocolo, nº do Aviso…" aria-label="Buscar" className={`${inputCls} pl-9`} />
          </div>
          <select value={fil.categoria} onChange={(e) => setFil({ ...fil, categoria: e.target.value as Filtros['categoria'] })}
            aria-label="Tipo" className={campoCls}>
            <option value="">Todos os tipos</option>
            {categorias.map((c) => <option key={c} value={c}>{CATEGORIAS[c].titulo}</option>)}
          </select>
          <select value={fil.unidade} onChange={(e) => setFil({ ...fil, unidade: e.target.value })} aria-label="Unidade" className={campoCls}>
            <option value="">Todas as unidades</option>
            {unidades.map((u) => <option key={u}>{u}</option>)}
          </select>
          <select value={fil.rh} onChange={(e) => setFil({ ...fil, rh: e.target.value })} aria-label="RH" className={campoCls}>
            <option value="">Todos os RH</option>
            {[...DESTINOS_RH, SEM_DESTINO].map((d) => <option key={d}>{d}</option>)}
          </select>
          {temFiltro && <Botao variante="discreto" onClick={() => setFil({ ...FILTROS_INICIAIS, situacao: fil.situacao })}>Limpar</Botao>}
        </div>
      )}

      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}
      {carregando && <p className="mt-6 text-sm text-tinta-suave" role="status">Carregando…</p>}
      {!carregando && lista.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-linha bg-white p-8 text-sm text-tinta-suave">
          Nada aguardando envio. Pedidos e avaliações aparecem aqui depois de assinados (avaliações, quando estão na DAE).
        </div>
      )}
      {!carregando && lista.length > 0 && filtrada.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-linha bg-white p-8 text-sm text-tinta-suave">
          {fil.situacao === 'livres' && !temFiltro
            ? <>Tudo o que está pronto já entrou em algum Aviso. Para entregar, abra o Aviso em <Link href="/avisos-rh" className="font-semibold text-azul hover:underline">Avisos RH</Link> e confirme o envio.</>
            : 'Nada encontrado com esses filtros.'}
        </div>
      )}

      {grupos.map(([destino, ls]) => (
        <GrupoRH key={destino} destino={destino} itens={ls} selecionados={selecionados} ocupado={ocupado}
          onAlternar={alternar} onGerar={gerar} onDestino={definirDestino} />
      ))}
    </div>
  );
}

/** Um RH: lista paginada, marcação e botão de gerar o Aviso */
function GrupoRH({ destino, itens, selecionados, ocupado, onAlternar, onGerar, onDestino }: {
  destino: string; itens: Lancamento[]; selecionados: Set<string>; ocupado: string | null;
  onAlternar: (ids: string[], marcar: boolean) => void;
  onGerar: (destino: string, ids: string[]) => void;
  onDestino: (l: Lancamento, destino: string) => void;
}) {
  const pag = usePaginacao(itens, 25);
  const semDestino = destino === SEM_DESTINO;
  // marcar e gerar valem para todos os itens filtrados deste RH, não só para a página aberta
  const livres = itens.filter((l) => !avisoDe(l));
  const marcados = livres.filter((l) => selecionados.has(l.id)).map((l) => l.id);
  const todos = livres.length > 0 && marcados.length === livres.length;
  return (
    <section className="mt-8">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{semDestino ? 'Sem destino definido' : destino}</h2>
          <p className="text-sm text-tinta-suave">
            {semDestino
              ? 'Vínculo sem RH definido. Escolha para onde cada um vai.'
              : `${itens.length} ${itens.length === 1 ? 'item' : 'itens'}${livres.length ? `, ${marcados.length} ${marcados.length === 1 ? 'marcado' : 'marcados'}` : ''}`}
          </p>
        </div>
        {!semDestino && livres.length > 0 && (
          <Botao disabled={marcados.length === 0} carregando={ocupado === destino} onClick={() => onGerar(destino, marcados)}>
            <Send className="size-4" aria-hidden /> Gerar aviso ao {destino} ({marcados.length})
          </Botao>
        )}
      </div>
      <TabelaWrap>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={`${thCls} w-10`}>
                {!semDestino && livres.length > 0 && (
                  <input type="checkbox" checked={todos} aria-label="Marcar todos" onChange={(e) => onAlternar(livres.map((l) => l.id), e.target.checked)}
                    className="size-4 accent-[var(--acento)]" />
                )}
              </th>
              <th className={thCls}>Protocolo</th>
              <th className={thCls}>Funcionário</th>
              <th className={thCls}>Unidade</th>
              <th className={thCls}>Pedido</th>
              <th className={thCls}>Período / Detalhe</th>
              <th className={thCls}>Assinado por</th>
              {semDestino && <th className={thCls}>Enviar para</th>}
            </tr>
          </thead>
          <tbody>
            {pag.visiveis.map((l) => {
              const aviso = avisoDe(l);
              return (
                <tr key={l.id} className="align-top hover:bg-papel/50">
                  <td className={tdCls}>
                    {!semDestino && !aviso && (
                      <input type="checkbox" checked={selecionados.has(l.id)} aria-label={`Marcar ${l.protocolo_dae}`}
                        onChange={(e) => onAlternar([l.id], e.target.checked)} className="size-4 accent-[var(--acento)]" />
                    )}
                  </td>
                  <td className={`${tdCls} whitespace-nowrap font-mono text-xs`}>{l.protocolo_dae}</td>
                  <td className={`${tdCls} font-medium`}>
                    {l.funcionario_nome}
                    {aviso && (
                      <Link href={`/avisos-rh?aviso=${aviso.id}`} className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-azul hover:underline">
                        <FileText className="size-3" aria-hidden /> já está no Aviso {aviso.numero}
                      </Link>
                    )}
                  </td>
                  <td className={tdCls}>{l.unidade_nome}</td>
                  <td className={tdCls}>{l.tipo}<span className="block text-xs text-tinta-suave">{CATEGORIAS[l.categoria].titulo}</span></td>
                  <td className={`${tdCls} whitespace-nowrap`}>{detalhe(l)}</td>
                  <td className={tdCls}>
                    {l.diretora === 'Dispensado' ? 'Sem assinatura (promoção)' : l.diretor_nome}
                    {l.data_assinatura && <span className="block text-xs text-tinta-suave">em {dataBR(l.data_assinatura)}</span>}
                  </td>
                  {semDestino && (
                    <td className={tdCls}>
                      <select defaultValue="" disabled={ocupado === l.id} onChange={(e) => e.target.value && onDestino(l, e.target.value)}
                        aria-label="Enviar para" className={campoCls}>
                        <option value="">Escolher…</option>
                        {DESTINOS_RH.map((d) => <option key={d}>{d}</option>)}
                      </select>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </TabelaWrap>
      <Paginacao p={pag} rotulo="itens" />
    </section>
  );
}
