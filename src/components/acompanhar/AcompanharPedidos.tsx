'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, CornerDownLeft, FileSignature, Inbox, Search, Send, Undo2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { dataBR, mensagemErro, normalizar } from '@/lib/formato';
import {
  CAMPOS_LANCAMENTO, CATEGORIAS, SITUACOES_ANDAMENTO, SITUACOES_CONCLUIDO, detalhe, linhaDoTempo, type Categoria, type Lancamento,
} from '@/lib/lancamentos';
import { Aviso, inputCls } from '@/components/ui';
import { buscarTudo } from '@/lib/buscarTudo';
import { Paginacao, usePaginacao } from '@/components/Paginacao';

type Visao = 'andamento' | 'atencao' | 'concluidos';
const VISOES: [Visao, string][] = [['andamento', 'Em andamento'], ['atencao', 'Devolvidos / não autorizados'], ['concluidos', 'Concluídos']];
const CATS: Categoria[] = ['folgas_abonos', 'ferias_lp', 'he_bh', 'ponto_ausencias', 'avaliacoes'];

/** Etapas explicadas no topo da tela */
const PASSOS_PEDIDO = [
  { titulo: 'Recebido na DAE', texto: 'O pedido chegou à DAE e foi registrado.', icone: Inbox },
  { titulo: 'Assinado', texto: 'A Diretoria analisou e assinou.', icone: FileSignature },
  { titulo: 'Enviado ao RH', texto: 'A DAE encaminhou ao RH (SESAU ou FSPSS). O pedido termina aqui.', icone: Send },
];
const PASSOS_AVALIACAO = [
  { titulo: 'Recebida do RH', texto: 'A avaliação chegou à DAE.', icone: Inbox },
  { titulo: 'Na unidade', texto: 'A DAE enviou para a unidade preencher.', icone: Building2 },
  { titulo: 'Devolvida', texto: 'A chefia preencheu e devolveu à DAE.', icone: CornerDownLeft },
  { titulo: 'Assinada', texto: 'A Diretoria assinou (a de promoção não precisa).', icone: FileSignature },
  { titulo: 'Enviada ao RH', texto: 'A DAE encaminhou ao RH.', icone: Send },
];

/** Frase simples sobre a situação do pedido */
function frase(l: Lancamento) {
  const quem = l.diretor_nome ? ` por ${l.diretor_nome}` : '';
  const quando = l.data_assinatura ? ` em ${dataBR(l.data_assinatura)}` : '';
  const rh = l.destino_rh ?? 'RH';
  if (l.categoria === 'avaliacoes' && l.diretora === 'Aguardando') {
    if (l.avaliacao_etapa === 'Na DAE') return `A DAE recebeu esta avaliação do RH em ${dataBR(l.data_recebimento)} e vai enviá-la para a unidade.`;
    if (l.avaliacao_etapa === 'Na unidade') {
      return `A avaliação está com a unidade desde ${dataBR(l.avaliacao_unidade_em)}. A chefia deve preencher, assinar e devolver à DAE.`;
    }
    return `A unidade devolveu em ${dataBR(l.avaliacao_devolvida_em)}. Aguardando a assinatura da Diretoria.`;
  }
  switch (l.situacao_rh) {
    case 'Aguardando autorização': return `Recebido na DAE em ${dataBR(l.data_recebimento)}. Aguardando a assinatura da Diretoria.`;
    case 'Autorizado / Aguardando envio':
      return l.diretora === 'Dispensado'
        ? `Avaliação conferida pela DAE. Será encaminhada ao ${rh}.`
        : `Aprovado${quem}${quando}. A DAE vai encaminhar ao ${rh}.`;
    case 'Enviado ao RH':
    case 'Concluído':
      return `${l.diretora === 'Dispensado' ? 'Conferido pela DAE' : `Aprovado${quem}${quando}`} e enviado ao ${rh}` +
        `${l.enviado_rh_em ? ` em ${dataBR(l.enviado_rh_em)}` : ''}. Concluído na DAE; o RH só entra em contato se houver algum problema.`;
    case 'Devolvido': return `Devolvido pela Diretoria${quando}. Motivo: ${l.diretora_obs ?? 'não informado'}. Procure a DAE para corrigir.`;
    case 'Não autorizado': return `Não autorizado pela Diretoria${quando}. Motivo: ${l.diretora_obs ?? 'não informado'}.`;
    default: return l.situacao_rh;
  }
}

export default function AcompanharPedidos({ unidadeNome }: { unidadeNome: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [cat, setCat] = useState<Categoria>('folgas_abonos');
  const [visao, setVisao] = useState<Visao>('andamento');
  const [lista, setLista] = useState<Lancamento[] | null>(null);
  const [contagem, setContagem] = useState<Record<Visao, number>>({ andamento: 0, atencao: 0, concluidos: 0 });
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const base = () => supabase.from('lancamentos').select(CAMPOS_LANCAMENTO).eq('categoria', cat);
      const conta = () => supabase.from('lancamentos').select('id', { count: 'exact', head: true }).eq('categoria', cat);
      const consulta = (de: number, ate: number) => (visao === 'andamento' ? base().in('situacao_rh', SITUACOES_ANDAMENTO).order('data_recebimento')
        : visao === 'atencao' ? base().in('diretora', ['Devolvido', 'Não autorizado']).order('diretora_em', { ascending: false })
        : base().in('situacao_rh', SITUACOES_CONCLUIDO).order('enviado_rh_em', { ascending: false })).order('id').range(de, ate);
      const [res, c1, c2, c3] = await Promise.all([
        buscarTudo(consulta),
        conta().in('situacao_rh', SITUACOES_ANDAMENTO),
        conta().in('diretora', ['Devolvido', 'Não autorizado']),
        conta().in('situacao_rh', SITUACOES_CONCLUIDO),
      ]);
      if (!vivo) return;
      setLista((res.data as unknown as Lancamento[]) ?? []);
      setContagem({ andamento: c1.count ?? 0, atencao: c2.count ?? 0, concluidos: c3.count ?? 0 });
      setErro(res.error ? mensagemErro(res.error) : null);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, cat, visao]);

  const visiveis = useMemo(() => {
    const t = normalizar(busca);
    return (lista ?? []).filter((l) => !t || normalizar(`${l.funcionario_nome} ${l.protocolo_dae}`).includes(t));
  }, [lista, busca]);

  // Quantos pedidos em andamento estão em cada etapa
  const pag = usePaginacao(visiveis, 25);
  const PASSOS = cat === 'avaliacoes' ? PASSOS_AVALIACAO : PASSOS_PEDIDO;
  const porEtapa = PASSOS.map((_, i) =>
    visao === 'andamento' && i < PASSOS.length - 1 ? visiveis.filter((l) => linhaDoTempo(l).atual === i).length : null);

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold">Acompanhar pedidos</h1>
      <p className="mt-1 text-tinta-suave">Pedidos dos funcionários de {unidadeNome}. Veja em que etapa cada um está.</p>

      {/* Explicação das etapas */}
      <ol className={`mt-6 grid gap-3 dock-card p-5 ${PASSOS.length === 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-3'}`}>
        {PASSOS.map((p, i) => (
          <li key={p.titulo} className="flex items-start gap-3 sm:flex-col sm:gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lavender-mist text-electric-cobalt">
              <p.icone className="size-4" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold">{i + 1}. {p.titulo}</span>
              <span className="block text-xs text-tinta-suave">{p.texto}</span>
              {porEtapa[i] !== null && porEtapa[i] !== undefined && (
                <span className="mt-1 inline-block rounded-full bg-papel px-2 py-0.5 text-xs font-semibold">
                  {porEtapa[i]} {porEtapa[i] === 1 ? 'pedido' : 'pedidos'} aqui
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>

      {/* Tipo de pedido */}
      <div role="tablist" aria-label="Tipo de pedido" className="mt-6 flex flex-wrap gap-x-1 border-b border-linha">
        {CATS.map((c) => (
          <button key={c} role="tab" type="button" aria-selected={cat === c} onClick={() => { setLista(null); setCat(c); }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${cat === c ? 'border-acento text-acento-escuro' : 'border-transparent text-tinta-suave hover:text-tinta'}`}>
            {CATEGORIAS[c].titulo}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Situação" className="inline-flex flex-wrap rounded-md border border-linha bg-white p-1">
          {VISOES.map(([v, r]) => (
            <button key={v} role="tab" type="button" aria-selected={visao === v} onClick={() => { setLista(null); setVisao(v); }}
              className={`rounded px-3 py-1.5 text-sm font-semibold ${visao === v ? 'bg-acento text-white' : 'text-tinta-suave hover:text-tinta'}`}>
              {r}
              {contagem[v] > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 text-xs ${visao === v ? 'bg-white/25' : v === 'atencao' ? 'bg-erro-claro text-erro' : 'bg-acento-claro text-acento-escuro'}`}>
                  {contagem[v]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-suave" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar funcionário ou protocolo" aria-label="Buscar" className={`${inputCls} pl-9`} />
        </div>
      </div>

      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}

      <div className="mt-4 space-y-3">
        {!lista && <p className="text-sm text-tinta-suave" role="status">Carregando…</p>}
        {lista && visiveis.length === 0 && (
          <p className="rounded-lg border border-dashed border-linha bg-white p-6 text-sm text-tinta-suave">
            {visao === 'andamento' ? 'Nenhum pedido em andamento.' : visao === 'atencao' ? 'Nenhum pedido devolvido ou negado.' : 'Nenhum pedido concluído ainda.'}
          </p>
        )}
        {pag.visiveis.map((l) => <CartaoPedido key={l.id} l={l} />)}
        <Paginacao p={pag} rotulo="pedidos" />
      </div>
    </div>
  );
}

function CartaoPedido({ l }: { l: Lancamento }) {
  const { passos, atual, parado, fim } = linhaDoTempo(l);
  const travada = parado ? atual + 1 : -1; // etapa em que a Diretoria devolveu ou negou

  return (
    <article className={`dock-card p-5 ${parado ? 'border-erro/40' : 'border-linha'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-bold">{l.funcionario_nome}</h2>
          <p className="text-sm">
            <span className="font-medium">{l.tipo}</span>
            {detalhe(l) && <span className="text-tinta-suave">, {detalhe(l)}</span>}
            {l.data_retorno && <span className="text-tinta-suave">. Volta em {dataBR(l.data_retorno)}</span>}
          </p>
        </div>
        <span className="font-mono text-xs text-tinta-suave">{l.protocolo_dae}</span>
      </div>

      {/* Linha das etapas */}
      <ol className="mt-4 grid" style={{ gridTemplateColumns: `repeat(${passos.length}, minmax(0, 1fr))` }} aria-label="Andamento do pedido">
        {passos.map((p, k) => {
          const feito = k <= atual;
          const daVez = !parado && !fim && k === atual + 1; // próxima etapa
          const travouAqui = k === travada;
          return (
            <li key={k} className="relative flex flex-col items-center text-center">
              {k > 0 && (
                <span className={`absolute right-1/2 top-3.5 h-0.5 w-full ${feito ? 'bg-acento' : travouAqui ? 'bg-erro/50' : 'bg-linha'}`} aria-hidden />
              )}
              <span className={`relative z-10 flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                travouAqui ? 'bg-erro text-white'
                  : feito ? (fim ? 'bg-forest text-white' : 'bg-electric-cobalt text-white')
                  : daVez ? 'bg-white text-deep-cobalt ring-2 ring-electric-cobalt'
                  : 'bg-papel text-tinta-suave ring-1 ring-linha'}`}>
                {travouAqui ? (l.diretora === 'Devolvido' ? <Undo2 className="size-3.5" /> : <X className="size-3.5" />)
                  : feito ? <Check className="size-3.5" /> : k + 1}
              </span>
              <span className={`mt-1 text-[11px] leading-tight ${k === atual || travouAqui ? 'font-bold' : 'text-tinta-suave'}`}>
                {travouAqui ? l.diretora : p.titulo}
              </span>
              {feito && p.data && <span className="text-[10px] text-tinta-suave">{dataBR(p.data)}</span>}
            </li>
          );
        })}
      </ol>

      <p className={`mt-4 rounded-xl px-4 py-2.5 text-sm ${parado ? 'bg-[#fde8e8] text-[#c94a4a]' : fim ? 'bg-[#e6f4ea] text-[#046645]' : 'bg-faint-gray text-ink-charcoal'}`}>
        {frase(l)}
      </p>
    </article>
  );
}
