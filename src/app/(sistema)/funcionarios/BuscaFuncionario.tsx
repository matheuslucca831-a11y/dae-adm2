'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { inputCls } from '@/components/ui';

export type ResultadoBusca = {
  id: string; nome: string; matricula: string | null; cargo: string | null; funcao: string | null; vinculo: string | null;
};

/** Busca no cadastro geral feito pela sede (nome, matrícula ou CPF) */
export default function BuscaFuncionario({
  jaNaLista,
  onAdicionar,
}: {
  jaNaLista: Set<string>;
  onAdicionar: (f: ResultadoBusca) => Promise<void>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusca[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [adicionando, setAdicionando] = useState<string | null>(null);

  useEffect(() => {
    const t = termo.trim();
    const timer = setTimeout(async () => {
      if (t.length < 3) {
        setResultados(null);
        return;
      }
      setBuscando(true);
      const { data } = await supabase.rpc('buscar_funcionarios', { p_termo: t });
      setResultados((data as ResultadoBusca[]) ?? []);
      setBuscando(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [termo, supabase]);

  async function adicionar(f: ResultadoBusca) {
    setAdicionando(f.id);
    await onAdicionar(f);
    setAdicionando(null);
  }

  return (
    <div className="rounded-lg border border-linha bg-white p-4">
      <label htmlFor="busca-cadastro" className="text-sm font-semibold">Adicionar funcionário à relação</label>
      <p className="text-xs text-tinta-suave">Procure no cadastro da sede por nome, matrícula ou CPF.</p>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-suave" aria-hidden />
        <input
          id="busca-cadastro"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Digite ao menos 3 letras"
          autoComplete="off"
          className={`${inputCls} pl-9`}
        />
        {buscando && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-tinta-suave" aria-hidden />}
      </div>

      {resultados && (
        <ul className="mt-3 divide-y divide-linha/70 rounded-md border border-linha" aria-live="polite">
          {resultados.length === 0 && (
            <li className="px-3 py-3 text-sm text-tinta-suave">
              Ninguém encontrado. Se o funcionário ainda não foi cadastrado, peça o cadastro à sede.
            </li>
          )}
          {resultados.map((f) => {
            const presente = jaNaLista.has(f.id);
            return (
              <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{f.nome}</p>
                  <p className="truncate text-xs text-tinta-suave">
                    {[f.matricula && `Matrícula ${f.matricula}`, f.cargo, f.vinculo].filter(Boolean).join(', ')}
                  </p>
                </div>
                {presente ? (
                  <span className="shrink-0 text-xs font-medium text-tinta-suave">Já está na relação</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => adicionar(f)}
                    disabled={adicionando === f.id}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-acento-claro px-2.5 py-1.5 text-xs font-semibold text-acento-escuro hover:brightness-95 disabled:opacity-50"
                  >
                    {adicionando === f.id ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                    Adicionar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
