'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { mensagemErro } from '@/lib/formato';
import { carregarAtalhos, rotuloAtalho, type Atalho } from '@/components/AtalhosHorario';
import { Aviso, Botao, campoCls } from '@/components/ui';

export default function AdminAtalhos() {
  const supabase = useMemo(() => createClient(), []);
  const [lista, setLista] = useState<Atalho[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [novo, setNovo] = useState({ entrada: '', saida: '' });

  useEffect(() => {
    let vivo = true;
    supabase.from('atalhos_horario').select('id, entrada, saida').order('entrada').order('saida').then(({ data, error }) => {
      if (!vivo) return;
      setLista((data ?? []).map((a) => ({ id: a.id, entrada: String(a.entrada).slice(0, 5), saida: String(a.saida).slice(0, 5) })));
      setErro(error ? mensagemErro(error) : null);
    });
    return () => {
      vivo = false;
    };
  }, [supabase, versao]);

  async function executar(q: PromiseLike<{ error: { message?: string; code?: string } | null }>, depois?: () => void) {
    const { error } = await q;
    if (error) {
      return setErro(error.code === '23505' ? 'Esse horário já está nos atalhos.'
        : error.code === '23514' ? 'A entrada e a saída precisam ser diferentes.' : mensagemErro(error));
    }
    setErro(null);
    depois?.();
    carregarAtalhos(true);
    setVersao((v) => v + 1);
  }

  return (
    <>
      <p className="text-sm text-tinta-suave">
        Horários que aparecem como botões no &quot;Preencher rápido&quot; das escalas (cadastro, perfil e sugestões das unidades).
        Horário noturno, como 19h às 7h, pode ser cadastrado normalmente.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-linha bg-white p-3 text-sm">
        <span className="text-tinta-suave">das</span>
        <input type="time" value={novo.entrada} onChange={(e) => setNovo({ ...novo, entrada: e.target.value })} aria-label="Entrada" className={campoCls} />
        <span className="text-tinta-suave">às</span>
        <input type="time" value={novo.saida} onChange={(e) => setNovo({ ...novo, saida: e.target.value })} aria-label="Saída" className={campoCls} />
        <Botao onClick={() => {
          if (!novo.entrada || !novo.saida) return setErro('Preencha a entrada e a saída.');
          executar(supabase.from('atalhos_horario').insert(novo), () => setNovo({ entrada: '', saida: '' }));
        }}>
          <Plus className="size-4" aria-hidden /> Adicionar atalho
        </Botao>
      </div>
      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}

      <ul className="mt-4 flex flex-wrap gap-2">
        {!lista && <li className="text-sm text-tinta-suave">Carregando…</li>}
        {lista?.length === 0 && <li className="text-sm text-tinta-suave">Nenhum atalho cadastrado.</li>}
        {lista?.map((a) => (
          <li key={a.id} className="inline-flex items-center gap-1 rounded-full border border-linha bg-white py-1 pl-3 pr-1 text-sm font-semibold">
            {rotuloAtalho(a)}
            <button type="button" aria-label={`Excluir ${rotuloAtalho(a)}`}
              onClick={() => executar(supabase.from('atalhos_horario').delete().eq('id', a.id!))}
              className="rounded-full p-1 text-tinta-suave hover:bg-erro-claro hover:text-erro"><X className="size-3.5" /></button>
          </li>
        ))}
      </ul>
    </>
  );
}
