'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { dataBR, mensagemErro } from '@/lib/formato';
import { CAMPOS_LANCAMENTO, CATEGORIAS, detalhe, textoAndamento, textoDecisao, type Categoria, type Lancamento } from '@/lib/lancamentos';
import { Aviso, campoCls } from '@/components/ui';
import { buscarTudo } from '@/lib/buscarTudo';
import { FiltroPeriodo, FolhaRelatorio, Grupo, mesAtual, tabRel, tdRel, textoPeriodo, thRel } from './FolhaRelatorio';

const ANDAMENTOS = ['Aguardando autorização', 'Autorizado / Aguardando envio', 'Enviado ao RH', 'Devolvido', 'Não autorizado'];

/** Todos os pedidos recebidos no período, por categoria */
export default function RelPedidos({ unidades }: { unidades: { id: string; nome: string }[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [periodo, setPeriodo] = useState(mesAtual);
  const [fCat, setFCat] = useState<Categoria | ''>('');
  const [fUnidade, setFUnidade] = useState('');
  const [fAndamento, setFAndamento] = useState('');
  const [lista, setLista] = useState<Lancamento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    buscarTudo((de, ate) => {
      let q = supabase.from('lancamentos').select(CAMPOS_LANCAMENTO)
        .gte('data_recebimento', periodo.de).lte('data_recebimento', periodo.ate);
      if (fCat) q = q.eq('categoria', fCat);
      if (fUnidade) q = q.eq('unidade_id', fUnidade);
      if (fAndamento) q = fAndamento === 'Enviado ao RH' ? q.in('situacao_rh', ['Enviado ao RH', 'Concluído']) : q.eq('situacao_rh', fAndamento);
      return q.order('protocolo_dae').range(de, ate);
    }).then(({ data, error }) => {
      if (!vivo) return;
      setLista((data as unknown as Lancamento[]) ?? []);
      setErro(error ? mensagemErro(error) : null);
    });
    return () => {
      vivo = false;
    };
  }, [supabase, periodo, fCat, fUnidade, fAndamento]);

  const grupos = useMemo(() => (Object.keys(CATEGORIAS) as Categoria[])
    .map((c) => [c, (lista ?? []).filter((l) => l.categoria === c)] as const)
    .filter(([, ls]) => ls.length > 0), [lista]);

  const recarregar = () => setLista(null);
  const filtros = [
    textoPeriodo(periodo) + ' (data de recebimento)',
    fCat ? CATEGORIAS[fCat].titulo : 'todas as categorias',
    fUnidade ? unidades.find((u) => u.id === fUnidade)?.nome : 'todas as unidades',
    fAndamento ? textoAndamento({ situacao_rh: fAndamento, destino_rh: null }) : 'qualquer andamento',
  ].join(', ');

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <FiltroPeriodo valor={periodo} onChange={(p) => { recarregar(); setPeriodo(p); }} />
        <select value={fCat} onChange={(e) => { recarregar(); setFCat(e.target.value as Categoria | ''); }} aria-label="Categoria" className={campoCls}>
          <option value="">Todas as categorias</option>
          {(Object.keys(CATEGORIAS) as Categoria[]).map((c) => <option key={c} value={c}>{CATEGORIAS[c].titulo}</option>)}
        </select>
        <select value={fUnidade} onChange={(e) => { recarregar(); setFUnidade(e.target.value); }} aria-label="Unidade" className={campoCls}>
          <option value="">Todas as unidades</option>
          {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <select value={fAndamento} onChange={(e) => { recarregar(); setFAndamento(e.target.value); }} aria-label="Andamento" className={campoCls}>
          <option value="">Qualquer andamento</option>
          {ANDAMENTOS.map((a) => <option key={a} value={a}>{textoAndamento({ situacao_rh: a, destino_rh: null })}</option>)}
        </select>
      </div>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}

      <FolhaRelatorio titulo="Pedidos por período" filtros={`${filtros}. Total: ${lista?.length ?? 0}.`} carregando={!lista}>
        {grupos.length === 0 && <p className="text-sm">Nenhum pedido no período.</p>}
        {grupos.map(([c, ls]) => (
          <Grupo key={c} titulo={CATEGORIAS[c].titulo} total={ls.length}>
            <table className={tabRel}>
              <thead>
                <tr>
                  <th className={thRel}>Protocolo</th><th className={thRel}>Recebido</th><th className={thRel}>Funcionário</th>
                  <th className={thRel}>Unidade</th><th className={thRel}>Tipo</th><th className={thRel}>Período / Detalhe</th>
                  <th className={thRel}>Diretoria</th><th className={thRel}>Andamento</th>
                </tr>
              </thead>
              <tbody>
                {ls.map((l) => (
                  <tr key={l.id}>
                    <td className={`${tdRel} whitespace-nowrap font-mono`}>{l.protocolo_dae}</td>
                    <td className={tdRel}>{dataBR(l.data_recebimento)}</td>
                    <td className={tdRel}>{l.funcionario_nome}</td>
                    <td className={tdRel}>{l.unidade_nome}</td>
                    <td className={tdRel}>{l.tipo}{l.motivo_ocorrencia && <span className="block text-[10px] text-black/60">{l.motivo_ocorrencia}</span>}</td>
                    <td className={tdRel}>{detalhe(l)}</td>
                    <td className={tdRel}>
                      {textoDecisao(l.diretora)}
                      {l.diretor_nome && <span className="block text-[10px] text-black/60">{l.diretor_nome}{l.data_assinatura && `, ${dataBR(l.data_assinatura)}`}</span>}
                    </td>
                    <td className={tdRel}>{textoAndamento(l)}</td>
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
