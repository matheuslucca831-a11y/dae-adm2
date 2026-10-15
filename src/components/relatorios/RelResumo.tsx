'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { mensagemErro } from '@/lib/formato';
import { CATEGORIAS, type Categoria } from '@/lib/lancamentos';
import { Aviso } from '@/components/ui';
import { buscarTudo } from '@/lib/buscarTudo';
import { FiltroPeriodo, FolhaRelatorio, Grupo, mesAtual, tabRel, tdRel, textoPeriodo, thRel } from './FolhaRelatorio';

type Linha = { categoria: Categoria; unidade_nome: string | null; situacao_rh: string };
const COLUNAS: [string, string][] = [
  ['Aguardando autorização', 'Aguardando assinatura'],
  ['Autorizado / Aguardando envio', 'Prontos, a enviar'],
  ['Enviado ao RH', 'Enviados ao RH'],
  ['Devolvido', 'Devolvidos'],
  ['Não autorizado', 'Não autorizados'],
];

/** Números do período: pedidos por categoria e etapa, por unidade, avisos e 1Doc */
export default function RelResumo() {
  const supabase = useMemo(() => createClient(), []);
  const [periodo, setPeriodo] = useState(mesAtual);
  const [dados, setDados] = useState<{ linhas: Linha[]; avisos: number; entregues: number; umDoc: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [la, av, ae, ud] = await Promise.all([
        buscarTudo((de, ate) => supabase.from('lancamentos').select('categoria, unidade_nome, situacao_rh')
          .gte('data_recebimento', periodo.de).lte('data_recebimento', periodo.ate).order('id').range(de, ate)),
        supabase.from('avisos_rh').select('id', { count: 'exact', head: true }).gte('data', periodo.de).lte('data', periodo.ate),
        supabase.from('avisos_rh').select('id', { count: 'exact', head: true }).gte('data', periodo.de).lte('data', periodo.ate).eq('situacao', 'Enviado'),
        supabase.from('comunicados_1doc').select('id', { count: 'exact', head: true }).eq('situacao', 'Pendente'),
      ]);
      if (!vivo) return;
      setDados({ linhas: (la.data as Linha[]) ?? [], avisos: av.count ?? 0, entregues: ae.count ?? 0, umDoc: ud.count ?? 0 });
      setErro(la.error ? mensagemErro(la.error) : null);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, periodo]);

  // "Concluído" (registros antigos) conta como enviado ao RH
  const conta = (ls: Linha[], s?: string) =>
    s ? ls.filter((l) => l.situacao_rh === s || (s === 'Enviado ao RH' && l.situacao_rh === 'Concluído')).length : ls.length;
  const linhas = useMemo(() => dados?.linhas ?? [], [dados]);
  const porUnidade = useMemo(() => {
    const m = new Map<string, Linha[]>();
    for (const l of linhas) {
      const u = l.unidade_nome ?? 'Sem unidade';
      if (!m.has(u)) m.set(u, []);
      m.get(u)!.push(l);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [linhas]);

  const cabecalho = (
    <tr>
      <th className={thRel}></th><th className={thRel}>Total</th>
      {COLUNAS.map(([, r]) => <th key={r} className={thRel}>{r}</th>)}
    </tr>
  );
  const linhaNumeros = (rotulo: string, ls: Linha[], forte = false) => (
    <tr key={rotulo} className={forte ? 'font-bold' : ''}>
      <td className={tdRel}>{rotulo}</td>
      <td className={`${tdRel} text-right`}>{conta(ls)}</td>
      {COLUNAS.map(([s]) => <td key={s} className={`${tdRel} text-right`}>{conta(ls, s) || ''}</td>)}
    </tr>
  );

  return (
    <>
      <div className="print:hidden"><FiltroPeriodo valor={periodo} onChange={(p) => { setDados(null); setPeriodo(p); }} /></div>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}

      <FolhaRelatorio titulo="Resumo administrativo" filtros={`${textoPeriodo(periodo)} (pedidos pela data de recebimento).`} carregando={!dados}>
        {dados && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Pedidos recebidos', linhas.length],
                ['Aguardando assinatura', conta(linhas, 'Aguardando autorização')],
                ['Avisos RH emitidos', `${dados.avisos} (${dados.entregues} entregues)`],
                ['1Doc pendentes (hoje)', dados.umDoc],
              ].map(([r, v]) => (
                <div key={r as string} className="rounded border border-black/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-black/60">{r}</p>
                  <p className="text-xl font-bold">{v}</p>
                </div>
              ))}
            </div>

            <Grupo titulo="Por categoria e etapa">
              <table className={tabRel}>
                <thead>{cabecalho}</thead>
                <tbody>
                  {(Object.keys(CATEGORIAS) as Categoria[]).map((c) => linhaNumeros(CATEGORIAS[c].titulo, linhas.filter((l) => l.categoria === c)))}
                  {linhaNumeros('Total', linhas, true)}
                </tbody>
              </table>
            </Grupo>

            <Grupo titulo="Por unidade">
              {porUnidade.length === 0 ? <p className="text-sm">Nenhum pedido no período.</p> : (
                <table className={tabRel}>
                  <thead>{cabecalho}</thead>
                  <tbody>
                    {porUnidade.map(([u, ls]) => linhaNumeros(u, ls))}
                    {linhaNumeros('Total', linhas, true)}
                  </tbody>
                </table>
              )}
            </Grupo>
          </>
        )}
      </FolhaRelatorio>
    </>
  );
}
