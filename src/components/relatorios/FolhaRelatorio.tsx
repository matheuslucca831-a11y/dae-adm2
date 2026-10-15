'use client';

import type { ReactNode } from 'react';
import { Printer } from 'lucide-react';
import { competenciaAtual, dataBR, dataHoraBR, deslocarCompetencia, fimDoMes } from '@/lib/formato';
import { Botao, campoCls } from '@/components/ui';

/** Folha do relatório: cabeçalho da Fundação, filtros usados e conteúdo. Sai limpa na impressão. */
export function FolhaRelatorio({ titulo, filtros, carregando, children }: {
  titulo: string; filtros: string; carregando: boolean; children: ReactNode;
}) {
  return (
    <article className="mt-4 rounded-lg border border-linha bg-white p-6 text-black print:mt-0 print:border-0 print:p-0">
      <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-wide">Fundação de Saúde Pública de São Sebastião</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider">Diretoria de Atenção Especializada</p>
          <h2 className="mt-2 text-lg font-bold">{titulo}</h2>
          <p className="text-[12px] text-black/70">{filtros}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Botao variante="secundario" className="print:hidden" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Imprimir / PDF
          </Botao>
          <span className="text-[10px] text-black/60">Emitido em {dataHoraBR(new Date().toISOString())}</span>
        </div>
      </div>
      {carregando ? <p className="mt-6 text-sm text-tinta-suave" role="status">Carregando…</p> : <div className="mt-4">{children}</div>}
    </article>
  );
}

/** Bloco com título e tabela; não quebra no meio na impressão quando cabe na página */
export function Grupo({ titulo, total, children }: { titulo: string; total?: number; children: ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid-page">
      <h3 className="mb-1.5 flex items-baseline justify-between border-b border-black/40 pb-1 text-[12px] font-bold uppercase tracking-wide">
        {titulo}
        {total !== undefined && <span className="text-[11px] font-semibold normal-case">{total} {total === 1 ? 'registro' : 'registros'}</span>}
      </h3>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

export const tabRel = 'w-full border-collapse text-[11.5px]';
export const thRel = 'border border-black/30 bg-black/5 px-2 py-1 text-left font-semibold whitespace-nowrap';
export const tdRel = 'border border-black/30 px-2 py-1 align-top';

export const mesAtual = () => ({ de: competenciaAtual(), ate: fimDoMes(competenciaAtual()) });
export const textoPeriodo = (p: { de: string; ate: string }) => `Período: ${dataBR(p.de)} a ${dataBR(p.ate)}`;

/** De/até com atalhos de mês */
export function FiltroPeriodo({ valor, onChange }: { valor: { de: string; ate: string }; onChange: (p: { de: string; ate: string }) => void }) {
  const anterior = deslocarCompetencia(competenciaAtual(), -1);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>De</span>
      <input type="date" value={valor.de} onChange={(e) => onChange({ ...valor, de: e.target.value })} aria-label="De" className={campoCls} />
      <span>até</span>
      <input type="date" value={valor.ate} onChange={(e) => onChange({ ...valor, ate: e.target.value })} aria-label="Até" className={campoCls} />
      <Botao variante="discreto" onClick={() => onChange(mesAtual())}>Este mês</Botao>
      <Botao variante="discreto" onClick={() => onChange({ de: anterior, ate: fimDoMes(anterior) })}>Mês anterior</Botao>
    </div>
  );
}
