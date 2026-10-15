import { dataBR, formatarCNS, formatarCPF } from '@/lib/formato';

export type FuncionarioFicha = {
  matricula: string | null; cpf: string | null; cns?: string | null; data_nascimento: string | null;
  rg?: string | null; sexo?: string | null; cargo: string | null; cbo?: string | null; vinculo: string | null;
  forma_contratacao?: string | null; carga_horaria_semanal?: number | null;
  conselho?: string | null; numero_conselho?: string | null; conselho_uf?: string | null;
  exige_1doc?: boolean; destino_1doc?: string | null; obs?: string | null;
};

/** Dados da ficha em modo leitura (perfil da Sede e "Meus funcionários" da unidade) */
export default function DadosFicha({ f, mostrar1Doc = true, className = '' }: { f: FuncionarioFicha; mostrar1Doc?: boolean; className?: string }) {
  const itens: [string, string | null | undefined][] = [
    ['Matrícula', f.matricula],
    ['CPF', formatarCPF(f.cpf)],
    ['Cartão SUS', formatarCNS(f.cns)],
    ['Nascimento', dataBR(f.data_nascimento)],
    ['RG', f.rg],
    ['Sexo', f.sexo],
    ['Cargo', f.cargo],
    ['CBO', f.cbo],
    ['Vínculo', f.vinculo],
    ['Forma de contratação', f.forma_contratacao],
    ['CH semanal', f.carga_horaria_semanal ? `${f.carga_horaria_semanal}h` : null],
    ['Conselho de classe', [f.conselho, f.numero_conselho, f.conselho_uf].filter(Boolean).join(' ')],
    ...(mostrar1Doc ? [['1Doc', f.exige_1doc ? `Sim, ${f.destino_1doc}` : 'Não'] as [string, string]] : []),
  ];
  return (
    <dl className={`grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-linha bg-white p-4 sm:grid-cols-3 lg:grid-cols-6 ${className}`}>
      {itens.map(([r, v]) => (
        <div key={r}>
          <dt className="text-xs font-semibold text-tinta-suave">{r}</dt>
          <dd className="text-sm">{v || '—'}</dd>
        </div>
      ))}
      {f.obs && (
        <div className="col-span-full">
          <dt className="text-xs font-semibold text-tinta-suave">Observações</dt>
          <dd className="text-sm">{f.obs}</dd>
        </div>
      )}
    </dl>
  );
}
