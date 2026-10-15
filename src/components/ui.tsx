import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { nomeCompetencia, deslocarCompetencia } from '@/lib/formato';

/** Estilo base dos campos, sem largura definida */
export const campoCls =
  'rounded-xl border border-linha bg-white px-3.5 py-2.5 text-sm text-ink-charcoal outline-none ' +
  'transition-all duration-150 focus:border-electric-cobalt focus:ring-2 focus:ring-electric-cobalt/20 disabled:bg-faint-gray disabled:text-steel-gray';
export const inputCls = `w-full ${campoCls}`;

type Variante = 'primario' | 'secundario' | 'perigo' | 'discreto';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-electric-cobalt text-white hover:bg-deep-cobalt shadow-xs',
  secundario: 'border border-linha bg-white text-ink-charcoal hover:bg-faint-gray',
  perigo: 'bg-erro text-white hover:opacity-90 shadow-xs',
  discreto: 'text-slate-gray hover:bg-faint-gray hover:text-ink-charcoal',
};

export function Botao({
  variante = 'primario',
  carregando = false,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || carregando}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium
                  transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
    >
      {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Campo({ rotulo, children, className = '', dica }: { rotulo: string; children: ReactNode; className?: string; dica?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-gray">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-slate-gray">{dica}</span>}
    </label>
  );
}

const SELOS: Record<string, string> = {
  'Em preparação': 'bg-faint-gray text-slate-gray ring-linha',
  Enviada: 'bg-[#edf3fc] text-[#004aad] ring-[#004aad]/20',
  Conferida: 'bg-[#e6f4ea] text-[#046645] ring-[#046645]/20',
  Devolvida: 'bg-[#fde8e8] text-[#c94a4a] ring-[#c94a4a]/20',
  'Não iniciada': 'bg-white text-slate-gray ring-linha',
  Ativo: 'bg-[#e6f4ea] text-[#046645] ring-[#046645]/20',
  Inativo: 'bg-faint-gray text-slate-gray ring-linha',
  // Diretora
  Aguardando: 'bg-[#fef3c7] text-[#b7791f] ring-[#b7791f]/20',
  Autorizado: 'bg-[#e6f4ea] text-[#046645] ring-[#046645]/20',
  Devolvido: 'bg-[#fde8e8] text-[#c94a4a] ring-[#c94a4a]/20',
  'Não autorizado': 'bg-[#c94a4a] text-white ring-[#c94a4a]',
  // Aviso RH
  'Aguardando entrega': 'bg-[#fef3c7] text-[#b7791f] ring-[#b7791f]/20',
  Entregue: 'bg-[#e6f4ea] text-[#046645] ring-[#046645]/20',
  // Situação RH
  'Aguardando autorização': 'bg-faint-gray text-slate-gray ring-linha',
  'Autorizado / Aguardando envio': 'bg-[#edf3fc] text-[#004aad] ring-[#004aad]/20',
  'Enviado ao RH': 'bg-[#e6f4ea] text-[#046645] ring-[#046645]/20',
  'Concluído': 'bg-[#046645] text-white ring-[#046645]',
  'Sem assinatura': 'bg-faint-gray text-slate-gray ring-linha',
  // Sugestões de cadastro
  'Aguardando a DAE': 'bg-[#fef3c7] text-[#b7791f] ring-[#b7791f]/20',
  Aceita: 'bg-[#e6f4ea] text-[#046645] ring-[#046645]/20',
  Recusada: 'bg-[#fde8e8] text-[#c94a4a] ring-[#c94a4a]/20',
};

export function Selo({ texto }: { texto: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${SELOS[texto] ?? SELOS['Em preparação']}`}>
      {texto}
    </span>
  );
}

export function Aviso({ tom = 'erro', children }: { tom?: 'erro' | 'info'; children: ReactNode }) {
  const cls = tom === 'erro' ? 'bg-[#fde8e8] text-[#c94a4a]' : 'bg-[#edf3fc] text-[#004aad]';
  return <p role={tom === 'erro' ? 'alert' : 'status'} className={`rounded-xl px-4 py-2.5 text-sm font-medium ${cls}`}>{children}</p>;
}

export function SeletorMes({ valor, onChange }: { valor: string; onChange: (c: string) => void }) {
  return (
    <div className="inline-flex min-h-[44px] items-center rounded-full border border-linha bg-white shadow-xs">
      <button type="button" aria-label="Mês anterior" onClick={() => onChange(deslocarCompetencia(valor, -1))}
        className="flex size-11 items-center justify-center rounded-l-full text-slate-gray transition-colors hover:text-ink-charcoal">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-36 px-2 text-center text-sm font-semibold text-ink-charcoal" aria-live="polite">{nomeCompetencia(valor)}</span>
      <button type="button" aria-label="Próximo mês" onClick={() => onChange(deslocarCompetencia(valor, 1))}
        className="flex size-11 items-center justify-center rounded-r-full text-slate-gray transition-colors hover:text-ink-charcoal">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

/** Tabela com rolagem horizontal própria */
export function TabelaWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-2xl border border-linha bg-white shadow-subtle">{children}</div>;
}
export const thCls = 'whitespace-nowrap border-b border-linha bg-faint-gray/70 px-4 py-3 text-left text-xs font-semibold text-slate-gray';
export const tdCls = 'border-b border-linha/70 px-4 py-3.5 align-middle text-sm text-ink-charcoal';
