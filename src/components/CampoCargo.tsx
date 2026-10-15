'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { normalizar } from '@/lib/formato';
import { inputCls } from '@/components/ui';

export type CargoInfo = { nome: string; cbo: string | null };

/** Lista de cargos com o CBO (carregada uma vez por página) */
let cache: Promise<CargoInfo[]> | null = null;
export function carregarCargos(recarregar = false) {
  if (!cache || recarregar) {
    const sb = createClient();
    cache = Promise.resolve(sb.from('cargos').select('nome, cbo').eq('ativo', true).order('nome'))
      .then(async ({ data, error }) => {
        if (!error) return (data ?? []).map((c) => ({ nome: c.nome as string, cbo: (c.cbo as string | null) ?? null }));
        // banco ainda sem a coluna cbo (017 não rodado)
        const r = await sb.from('cargos').select('nome').eq('ativo', true).order('nome');
        return (r.data ?? []).map((c) => ({ nome: c.nome as string, cbo: null }));
      });
  }
  return cache;
}

export function useCargosInfo() {
  const [cargos, setCargos] = useState<CargoInfo[]>([]);
  useEffect(() => {
    let vivo = true;
    carregarCargos().then((c) => vivo && setCargos(c));
    return () => {
      vivo = false;
    };
  }, []);
  return cargos;
}

export function useCargos() {
  const info = useCargosInfo();
  return useMemo(() => info.map((c) => c.nome), [info]);
}

/** Busca sem acento: todas as palavras digitadas precisam aparecer */
function filtrar(cargos: string[], texto: string) {
  const palavras = normalizar(texto).split(/\s+/).filter(Boolean);
  if (!palavras.length) return cargos;
  return cargos.filter((c) => {
    const n = normalizar(c);
    return palavras.every((p) => n.includes(p));
  });
}

type Props = { value: string; onChange: (v: string) => void; id?: string };

export default function CampoCargo({ value, onChange, id }: Props) {
  const cargos = useCargos();
  const listaId = useId();
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);

  const opcoes = useMemo(() => filtrar(cargos, value).slice(0, 60), [cargos, value]);
  const naLista = cargos.find((c) => normalizar(c) === normalizar(value.trim()));
  const foraDaLista = value.trim() !== '' && cargos.length > 0 && !naLista;

  function escolher(c: string) {
    onChange(c);
    setAberto(false);
  }

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        placeholder="Digite para buscar (ex.: enfermeiro)"
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
          setAtivo(0);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => {
          setAberto(false);
          // mesma palavra com outro acento/maiúscula → usa a grafia da lista
          if (naLista && naLista !== value) onChange(naLista);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAberto(true);
            setAtivo((a) => Math.min(a + 1, opcoes.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setAtivo((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && aberto && opcoes[ativo]) {
            e.preventDefault();
            escolher(opcoes[ativo]);
          } else if (e.key === 'Escape') {
            setAberto(false);
          }
        }}
        className={`${inputCls} pr-8`}
      />
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-tinta-suave" aria-hidden />

      {aberto && opcoes.length > 0 && (
        <ul id={listaId} role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-linha bg-white py-1 text-sm shadow-lg">
          {opcoes.map((c, i) => (
            <li key={c} role="option" aria-selected={i === ativo}
              onMouseDown={(e) => {
                e.preventDefault();
                escolher(c);
              }}
              onMouseEnter={() => setAtivo(i)}
              className={`cursor-pointer px-3 py-1.5 ${i === ativo ? 'bg-acento/10 text-acento-escuro' : ''}`}>
              {c}
            </li>
          ))}
        </ul>
      )}

      {foraDaLista && !aberto && (
        <p className="mt-1 text-xs text-amber-700">
          Cargo fora da lista. Confira se não está com outro nome; se for mesmo um cargo novo, pode salvar assim.
        </p>
      )}
    </div>
  );
}
