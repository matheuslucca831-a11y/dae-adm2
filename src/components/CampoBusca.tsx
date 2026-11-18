'use client';

import { Children, Fragment, isValidElement, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { normalizar } from '@/lib/formato';
import { inputCls } from '@/components/ui';

export type OpcaoBusca = { valor: string; rotulo: string; detalhe?: string };

/**
 * Campo de escolha por digitação (no lugar de um select): vai digitando e as
 * opções aparecem embaixo, como na busca de funcionário.
 */
export default function CampoBusca({
  valor, opcoes, onEscolher, placeholder = 'Digite para buscar', textoVazio, disabled, id, ariaLabel, className, tamanho,
}: {
  valor: string;
  opcoes: OpcaoBusca[];
  onEscolher: (valor: string) => void;
  placeholder?: string;
  /** Rótulo da opção "nenhum" (ex.: "Sem unidade"); sem ele, não dá para deixar vazio */
  textoVazio?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  /** Classes do campo (padrão: inputCls, largura total) */
  className?: string;
  /** Largura em letras, para campos compactos (filtros) */
  tamanho?: number;
}) {
  const idLista = useId();
  const escolhida = opcoes.find((o) => o.valor === valor) ?? null;
  const [texto, setTexto] = useState<string | null>(null); // null = mostra a escolhida
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  const lista = useMemo(() => {
    const t = normalizar((texto ?? '').trim());
    const achadas = t ? opcoes.filter((o) => normalizar(`${o.rotulo} ${o.detalhe ?? ''}`).includes(t)) : opcoes;
    return textoVazio && !t ? [{ valor: '', rotulo: textoVazio }, ...achadas] : achadas;
  }, [opcoes, texto, textoVazio]);

  function escolher(v: string) {
    onEscolher(v);
    setTexto(null);
    setAberta(false);
  }

  function tecla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAberta(true); setAtivo((a) => Math.min(a + 1, lista.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && aberta && lista[ativo]) { e.preventDefault(); escolher(lista[ativo].valor); }
    else if (e.key === 'Escape') { setAberta(false); setTexto(null); }
  }

  return (
    <div className="relative">
      <input
        aria-label={ariaLabel}
        size={tamanho}
        ref={ref}
        id={id}
        role="combobox"
        aria-expanded={aberta}
        aria-controls={idLista}
        aria-autocomplete="list"
        value={texto ?? escolhida?.rotulo ?? ''}
        placeholder={escolhida ? undefined : textoVazio ?? placeholder}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => { setTexto(e.target.value); setAberta(true); setAtivo(0); }}
        onFocus={(e) => { setAberta(true); setAtivo(0); e.target.select(); }}
        onBlur={() => setTimeout(() => { setAberta(false); setTexto(null); }, 150)}
        onKeyDown={tecla}
        className={`${className ?? inputCls} pr-8 ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      />
      {escolhida && textoVazio !== undefined && !disabled ? (
        <button type="button" aria-label="Limpar" onMouseDown={(e) => e.preventDefault()} onClick={() => { escolher(''); ref.current?.focus(); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-tinta-suave hover:bg-papel hover:text-tinta">
          <X className="size-4" aria-hidden />
        </button>
      ) : (
        // seta, para mostrar que é uma lista de escolha
        <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-tinta-suave" />
      )}
      {aberta && !disabled && (
        <ul id={idLista} role="listbox" className="absolute left-0 z-30 mt-1 max-h-64 w-max min-w-full max-w-[min(26rem,90vw)] overflow-y-auto rounded-md border border-linha bg-white text-tinta shadow-lg">
          {lista.length === 0 && <li className="px-3 py-2 text-sm text-tinta-suave">Nada encontrado.</li>}
          {lista.map((o, i) => (
            <li key={o.valor || '__vazio'} role="option" aria-selected={o.valor === valor}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(o.valor)} onMouseEnter={() => setAtivo(i)}
                className={`w-full px-3 py-2 text-left text-sm ${i === ativo ? 'bg-acento-claro' : ''} ${o.valor === '' ? 'italic text-tinta-suave' : ''} ${o.valor === valor ? 'font-semibold' : ''}`}>
                {o.rotulo}
                {o.detalhe && <span className="block text-xs text-tinta-suave">{o.detalhe}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selecao: troca direta do <select> nativo. Recebe as mesmas <option> como
// filhos e chama onChange com { target: { value } }, então os handlers que já
// existiam continuam iguais. Por dentro é o CampoBusca (digita e filtra).
// ---------------------------------------------------------------------------

type EventoSelecao = { target: { value: string } };

function textoDe(n: React.ReactNode): string {
  if (n === null || n === undefined || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(textoDe).join('');
  if (isValidElement<{ children?: React.ReactNode }>(n)) return textoDe(n.props.children);
  return '';
}

function opcoesDe(children: React.ReactNode): OpcaoBusca[] {
  const out: OpcaoBusca[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement<{ value?: string | number; children?: React.ReactNode }>(c)) return;
    if (c.type === Fragment) { out.push(...opcoesDe(c.props.children)); return; }
    const rotulo = textoDe(c.props.children);
    out.push({ valor: c.props.value !== undefined ? String(c.props.value) : rotulo, rotulo });
  });
  return out;
}

export function Selecao({
  value, defaultValue, onChange, children, className = '', disabled, id, 'aria-label': ariaLabel,
}: {
  value?: string | number | null;
  defaultValue?: string;
  onChange?: (e: EventoSelecao) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}) {
  const [interno, setInterno] = useState(defaultValue ?? '');
  const atual = value !== undefined ? String(value ?? '') : interno;
  const todas = useMemo(() => opcoesDe(children), [children]);
  // a opção de valor "" ("Todas as unidades", "Selecione"...) vira o texto do campo vazio
  const vazia = todas.find((o) => o.valor === '');
  const opcoes = todas.filter((o) => o.valor !== '');
  const largura = Math.min(34, Math.max(8, ...todas.map((o) => o.rotulo.length + 2)));
  const cheio = /\bw-full\b/.test(className);
  return (
    <div className={cheio ? 'w-full' : 'inline-block align-middle'}>
      <CampoBusca
        id={id}
        valor={atual}
        opcoes={opcoes}
        textoVazio={vazia?.rotulo}
        placeholder={vazia?.rotulo}
        disabled={disabled}
        ariaLabel={ariaLabel}
        className={className}
        tamanho={cheio ? undefined : largura}
        onEscolher={(v) => {
          if (value === undefined) setInterno(v);
          onChange?.({ target: { value: v } });
        }}
      />
    </div>
  );
}
