'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { normalizar } from '@/lib/formato';
import { inputCls } from '@/components/ui';

export type OpcaoBusca = { valor: string; rotulo: string; detalhe?: string };

/**
 * Campo de escolha por digitação (no lugar de um select): vai digitando e as
 * opções aparecem embaixo, como na busca de funcionário.
 */
export default function CampoBusca({
  valor, opcoes, onEscolher, placeholder = 'Digite para buscar', textoVazio, disabled, id,
}: {
  valor: string;
  opcoes: OpcaoBusca[];
  onEscolher: (valor: string) => void;
  placeholder?: string;
  /** Rótulo da opção "nenhum" (ex.: "Sem unidade"); sem ele, não dá para deixar vazio */
  textoVazio?: string;
  disabled?: boolean;
  id?: string;
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
        className={`${inputCls} ${escolhida && textoVazio !== undefined ? 'pr-9' : ''}`}
      />
      {escolhida && textoVazio !== undefined && !disabled && (
        <button type="button" aria-label="Limpar" onMouseDown={(e) => e.preventDefault()} onClick={() => { escolher(''); ref.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-tinta-suave hover:bg-papel hover:text-tinta">
          <X className="size-4" aria-hidden />
        </button>
      )}
      {aberta && !disabled && (
        <ul id={idLista} role="listbox" className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-linha bg-white shadow-lg">
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
