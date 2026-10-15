'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { dataBR, mensagemErro } from '@/lib/formato';
import { CAMPOS_LANCAMENTO, CATEGORIAS, type Lancamento } from '@/lib/lancamentos';
import { Aviso, campoCls } from '@/components/ui';
import { buscarTudo } from '@/lib/buscarTudo';
import { normalizar } from '@/lib/formato';

type Ausencia = Lancamento & { funcionario: { cargo: string | null } | null };
const cargoDe = (l: Ausencia) => l.funcionario?.cargo?.trim() || 'Sem cargo';
import { FiltroPeriodo, FolhaRelatorio, Grupo, mesAtual, tabRel, tdRel, textoPeriodo, thRel } from './FolhaRelatorio';

/** Quem está fora no período: férias, folgas, abonos, atestados… */
export default function RelAusencias({ unidades }: { unidades: { id: string; nome: string }[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [periodo, setPeriodo] = useState(mesAtual);
  const [fUnidade, setFUnidade] = useState('');
  const [soAssinados, setSoAssinados] = useState(false);
  const [fCargo, setFCargo] = useState('');
  const [lista, setLista] = useState<Ausencia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    // começa até o fim do período e termina (retorno) depois do início
    buscarTudo((de, ate) => {
      let q = supabase.from('lancamentos').select(`${CAMPOS_LANCAMENTO}, funcionario:funcionarios(cargo)`)
        .in('categoria', ['ferias_lp', 'folgas_abonos', 'ponto_ausencias'])
        .neq('diretora', 'Não autorizado')
        .neq('tipo', 'Ocorrência de ponto') // ocorrência é falta de registro, não ausência
        .not('data_inicio', 'is', null)
        .lte('data_inicio', periodo.ate)
        .or(`data_retorno.gt.${periodo.de},and(data_retorno.is.null,data_inicio.gte.${periodo.de})`);
      if (fUnidade) q = q.eq('unidade_id', fUnidade);
      if (soAssinados) q = q.eq('diretora', 'Autorizado');
      return q.order('data_inicio').order('id').range(de, ate);
    }).then(({ data, error }) => {
      if (!vivo) return;
      setLista((data as unknown as Ausencia[]) ?? []);
      setErro(error ? mensagemErro(error) : null);
    });
    return () => {
      vivo = false;
    };
  }, [supabase, periodo, fUnidade, soAssinados]);

  // Cargos que aparecem no período (o filtro de cargo é feito na tela, sem recarregar)
  const cargos = useMemo(() => [...new Set((lista ?? []).map(cargoDe))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [lista]);

  const grupos = useMemo(() => {
    const g = new Map<string, Ausencia[]>();
    for (const l of lista ?? []) {
      if (fCargo && normalizar(cargoDe(l)) !== normalizar(fCargo)) continue;
      const u = l.unidade_nome ?? 'Sem unidade';
      if (!g.has(u)) g.set(u, []);
      g.get(u)!.push(l);
    }
    return [...g.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [lista, fCargo]);

  const filtros = [textoPeriodo(periodo), fUnidade ? unidades.find((u) => u.id === fUnidade)?.nome : 'todas as unidades',
    fCargo ? `cargo ${fCargo}` : 'todos os cargos',
    soAssinados ? 'só pedidos assinados' : 'inclui pedidos aguardando assinatura'].join(', ');
  const total = grupos.reduce((n, [, ls]) => n + ls.length, 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <FiltroPeriodo valor={periodo} onChange={(p) => { setLista(null); setPeriodo(p); }} />
        <select value={fUnidade} onChange={(e) => { setLista(null); setFUnidade(e.target.value); }} aria-label="Unidade" className={campoCls}>
          <option value="">Todas as unidades</option>
          {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <select value={fCargo} onChange={(e) => setFCargo(e.target.value)} aria-label="Cargo" className={campoCls}>
          <option value="">Todos os cargos</option>
          {cargos.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soAssinados} onChange={(e) => { setLista(null); setSoAssinados(e.target.checked); }} className="size-4 accent-[var(--acento)]" />
          Só assinados
        </label>
      </div>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}

      <FolhaRelatorio titulo="Ausências no período" filtros={`${filtros}. Total: ${total}.`} carregando={!lista}>
        {grupos.length === 0 && <p className="text-sm">Nenhuma ausência no período.</p>}
        {grupos.map(([unidade, ls]) => (
          <Grupo key={unidade} titulo={unidade} total={ls.length}>
            <table className={tabRel}>
              <thead>
                <tr><th className={thRel}>Funcionário</th><th className={thRel}>Cargo</th><th className={thRel}>Tipo</th><th className={thRel}>Saída</th><th className={thRel}>Retorno</th><th className={thRel}>Dias</th><th className={thRel}>Diretoria</th></tr>
              </thead>
              <tbody>
                {ls.map((l) => (
                  <tr key={l.id}>
                    <td className={tdRel}>{l.funcionario_nome}</td>
                    <td className={tdRel}>{l.funcionario?.cargo}</td>
                    <td className={tdRel}>{l.tipo}<span className="block text-[10px] text-black/60">{CATEGORIAS[l.categoria].titulo}</span></td>
                    <td className={tdRel}>{dataBR(l.data_inicio)}</td>
                    <td className={tdRel}>{dataBR(l.data_retorno)}</td>
                    <td className={tdRel}>{l.qtd_dias}</td>
                    <td className={tdRel}>{l.diretora === 'Autorizado' ? `Assinado${l.diretor_nome ? ` (${l.diretor_nome})` : ''}` : l.diretora}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Grupo>
        ))}
      </FolhaRelatorio>
    </>
  );
}
