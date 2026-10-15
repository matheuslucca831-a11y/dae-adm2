import { ROTAS } from '@/lib/rotas';

export default function EmConstrucao({ rota }: { rota: string }) {
  const r = ROTAS.find((x) => x.path === rota);
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">{r?.titulo}</h1>
      <p className="mt-1 text-tinta-suave">{r?.descricao}</p>
      <div className="mt-8 rounded-lg border border-dashed border-linha bg-white p-6 text-sm text-tinta-suave">
        Esta tela será montada nas próximas etapas.
      </div>
    </div>
  );
}
