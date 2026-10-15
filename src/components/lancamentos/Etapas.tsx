import { dataBR } from '@/lib/formato';
import { linhaDoTempo, type Lancamento } from '@/lib/lancamentos';
import { Selo } from '@/components/ui';

/** Barra de etapas do pedido (3 etapas) ou da avaliação (5 etapas) */
export default function Etapas({ l }: { l: Lancamento }) {
  const { passos, atual, parado, fim } = linhaDoTempo(l);
  if (parado) return <Selo texto={parado} />;
  const p = passos[atual];

  return (
    <div className="min-w-32" title={passos.map((e, k) => `${k <= atual ? '[OK]' : '[ ]'} ${e.titulo}`).join('\n')}>
      <div className="flex gap-1" aria-hidden>
        {passos.map((e, k) => (
          <span key={k} className={`h-1.5 flex-1 rounded-full ${k <= atual ? (fim ? 'bg-pinho' : 'bg-acento') : 'bg-linha'}`} />
        ))}
      </div>
      <span className="mt-1 block text-xs font-semibold">
        {fim ? `Concluído: ${p.titulo}` : `Etapa ${atual + 1} de ${passos.length}: ${p.titulo}`}
      </span>
      {p.data && <span className="block text-xs text-tinta-suave">{fim ? 'em' : 'desde'} {dataBR(p.data)}</span>}
    </div>
  );
}
