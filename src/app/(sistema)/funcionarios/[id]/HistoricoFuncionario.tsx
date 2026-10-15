'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { dataBR, mensagemErro } from '@/lib/formato';
import { CAMPOS_TABELA, CATEGORIAS, detalhe, primeiro, textoDecisao, type Lancamento } from '@/lib/lancamentos';
import { Aviso, Selo } from '@/components/ui';
import Etapas from '@/components/lancamentos/Etapas';
import { Paginacao, usePaginacao } from '@/components/Paginacao';

type Lot = {
  id: string; situacao: string; data_inicio: string; data_encerramento: string | null; carga_horaria: number | null;
  encerramento_motivo: string | null; encerramento_justificativa: string | null; unidade: { nome: string } | null;
};
const SEM_EVENTOS: never[] = [];

type Evento =
  | { tipo: 'pedido'; data: string; l: Lancamento }
  | { tipo: 'lotacao'; data: string; lot: Lot; encerramento: boolean };

/** Linha do tempo: pedidos (com 1Doc e Aviso) e entradas/saídas de lotação */
export default function HistoricoFuncionario({ funcionarioId }: { funcionarioId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [la, lo] = await Promise.all([
        supabase.from('lancamentos').select(CAMPOS_TABELA).eq('funcionario_id', funcionarioId),
        supabase.from('lotacoes').select('id, situacao, data_inicio, data_encerramento, carga_horaria, encerramento_motivo, encerramento_justificativa, unidade:unidades(nome)')
          .eq('funcionario_id', funcionarioId),
      ]);
      if (!vivo) return;
      const ev: Evento[] = [];
      for (const l of (la.data as unknown as Lancamento[]) ?? []) ev.push({ tipo: 'pedido', data: l.data_recebimento, l });
      for (const lot of (lo.data as unknown as Lot[]) ?? []) {
        ev.push({ tipo: 'lotacao', data: lot.data_inicio, lot, encerramento: false });
        if (lot.data_encerramento) ev.push({ tipo: 'lotacao', data: lot.data_encerramento, lot, encerramento: true });
      }
      ev.sort((a, b) => b.data.localeCompare(a.data));
      setEventos(ev);
      setErro(la.error || lo.error ? mensagemErro(la.error || lo.error) : null);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, funcionarioId]);

  const pag = usePaginacao(eventos ?? SEM_EVENTOS, 25);

  if (!eventos) return <p className="text-sm text-tinta-suave" role="status">Carregando histórico…</p>;

  return (
    <div>
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      {eventos.length === 0 && <p className="text-sm text-tinta-suave">Nenhum registro administrativo ainda.</p>}
      <ol className="relative space-y-3 border-l-2 border-linha pl-5">
        {pag.visiveis.map((e, i) => (
          <li key={i} className="relative">
            <span className={`absolute -left-[27px] top-3 size-3 rounded-full ring-4 ring-papel ${e.tipo === 'pedido' ? 'bg-acento' : 'bg-tinta-suave'}`} aria-hidden />
            <p className="mb-1 text-xs font-semibold text-tinta-suave">{dataBR(e.data)}</p>
            {e.tipo === 'pedido' ? <CartaoPedido l={e.l} /> : (
              <div className="rounded-lg border border-linha bg-papel/60 px-4 py-3 text-sm">
                <p><strong>{e.encerramento ? 'Saiu de' : 'Lotado em'} {e.lot.unidade?.nome}</strong></p>
                <p className="text-xs text-tinta-suave">
                  {e.encerramento
                    ? `${e.lot.encerramento_motivo}: ${e.lot.encerramento_justificativa}`
                    : `Início da lotação${e.lot.carga_horaria ? `, ${e.lot.carga_horaria}h semanais` : ''}`}
                </p>
              </div>
            )}
          </li>
        ))}
      </ol>
      <Paginacao p={pag} rotulo="registros" />
    </div>
  );
}

function CartaoPedido({ l }: { l: Lancamento }) {
  const aviso = primeiro(l.aviso_rh_itens)?.aviso;
  const doc = primeiro(l.comunicados_1doc);
  return (
    <div className="rounded-lg border border-linha bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-acento-claro px-2 py-0.5 text-xs font-semibold text-acento-escuro">{CATEGORIAS[l.categoria].titulo}</span>
        <span className="font-mono text-xs">{l.protocolo_dae}</span>
        <span className="text-sm font-semibold">{l.tipo}</span>
        {l.motivo_ocorrencia && <span className="text-xs text-tinta-suave">({l.motivo_ocorrencia})</span>}
      </div>
      {detalhe(l) && <p className="mt-1 text-sm">{detalhe(l)}</p>}
      <div className="mt-2 flex flex-wrap items-start gap-x-6 gap-y-2 text-xs">
        <div>
          <Selo texto={textoDecisao(l.diretora)} />
          {l.diretor_nome && <span className="ml-1">por {l.diretor_nome}{l.data_assinatura && ` em ${dataBR(l.data_assinatura)}`}</span>}
          {l.diretora_obs && <span className="block text-tinta-suave">{l.diretora_obs}</span>}
        </div>
        <Etapas l={l} />
        {aviso && <Link href={`/avisos-rh?aviso=${aviso.id}`} className="font-semibold text-azul hover:underline">Aviso {aviso.numero}</Link>}
        {doc && <span>1Doc: <strong>{doc.situacao === 'Enviado' ? 'enviado' : 'pendente'}</strong></span>}
      </div>
      {l.obs && <p className="mt-2 text-xs text-tinta-suave">{l.obs}</p>}
    </div>
  );
}
