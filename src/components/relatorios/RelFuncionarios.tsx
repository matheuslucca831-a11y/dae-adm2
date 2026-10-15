'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { dataBR, mensagemErro } from '@/lib/formato';
import { Aviso, campoCls } from '@/components/ui';
import { buscarTudo } from '@/lib/buscarTudo';
import { FolhaRelatorio, Grupo, tabRel, tdRel, thRel } from './FolhaRelatorio';

type Horario = { dia_semana: string | null; frequencia: string; entrada: string | null; saida: string | null; data_referencia: string | null };
type Func = {
  id: string; nome: string; matricula: string | null; cargo: string | null; vinculo: string | null; situacao: string;
  lotacoes: { situacao: string; carga_horaria: number | null; unidade: { id: string; nome: string } | null; horarios: Horario[] }[];
};
type Linha = { f: Func; ch: number | null; horarios: Horario[] };

/** "Seg 07:00–16:00; Qua 07:00–13:00 (quinzenal)" */
function escala(hs: Horario[]) {
  return hs.map((h) => {
    const dia = h.dia_semana ? h.dia_semana.slice(0, 3) : dataBR(h.data_referencia);
    const hora = h.entrada || h.saida ? ` ${h.entrada?.slice(0, 5) ?? '?'}–${h.saida?.slice(0, 5) ?? '?'}` : '';
    const freq = h.frequencia !== 'Semanal' && h.frequencia !== 'Datas específicas' ? ` (${h.frequencia.toLowerCase()})` : '';
    return `${dia}${hora}${freq}`;
  }).join('; ');
}

export default function RelFuncionarios({ unidades }: { unidades: { id: string; nome: string }[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [lista, setLista] = useState<Func[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [fUnidade, setFUnidade] = useState('');
  const [fVinculo, setFVinculo] = useState('');
  const [fSituacao, setFSituacao] = useState('Ativo');

  useEffect(() => {
    let vivo = true;
    buscarTudo((de, ate) => supabase.from('funcionarios')
      .select('id, nome, matricula, cargo, vinculo, situacao, lotacoes(situacao, carga_horaria, unidade:unidades(id, nome), horarios(dia_semana, frequencia, entrada, saida, data_referencia))')
      .order('nome').order('id').range(de, ate))
      .then(({ data, error }) => {
        if (!vivo) return;
        setLista((data as unknown as Func[]) ?? []);
        setErro(error ? mensagemErro(error) : null);
      });
    return () => {
      vivo = false;
    };
  }, [supabase]);

  const vinculos = useMemo(() => [...new Set((lista ?? []).map((f) => f.vinculo).filter(Boolean))].sort() as string[], [lista]);

  // Agrupa por unidade de lotação ativa (quem tem duas lotações aparece nas duas)
  const grupos = useMemo(() => {
    const g = new Map<string, Linha[]>();
    for (const f of lista ?? []) {
      if (fSituacao && f.situacao !== fSituacao) continue;
      if (fVinculo && f.vinculo !== fVinculo) continue;
      const ativas = f.lotacoes.filter((l) => l.situacao === 'Ativa');
      if (ativas.length === 0 && !fUnidade) {
        if (!g.has('Sem lotação ativa')) g.set('Sem lotação ativa', []);
        g.get('Sem lotação ativa')!.push({ f, ch: null, horarios: [] });
      }
      for (const l of ativas) {
        if (fUnidade && l.unidade?.id !== fUnidade) continue;
        const nome = l.unidade?.nome ?? '—';
        if (!g.has(nome)) g.set(nome, []);
        g.get(nome)!.push({ f, ch: l.carga_horaria, horarios: l.horarios });
      }
    }
    return [...g.entries()].sort(([a], [b]) => (a === 'Sem lotação ativa' ? 1 : b === 'Sem lotação ativa' ? -1 : a.localeCompare(b, 'pt-BR')));
  }, [lista, fUnidade, fVinculo, fSituacao]);

  const pessoas = new Set(grupos.flatMap(([, ls]) => ls.map((x) => x.f.id))).size;
  const filtros = [
    fUnidade ? unidades.find((u) => u.id === fUnidade)?.nome : 'Todas as unidades',
    fVinculo || 'todos os vínculos',
    fSituacao ? `situação ${fSituacao.toLowerCase()}` : 'ativos e inativos',
  ].join(', ');

  return (
    <>
      <div className="flex flex-wrap gap-2 print:hidden">
        <select value={fUnidade} onChange={(e) => setFUnidade(e.target.value)} aria-label="Unidade" className={campoCls}>
          <option value="">Todas as unidades</option>
          {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <select value={fVinculo} onChange={(e) => setFVinculo(e.target.value)} aria-label="Vínculo" className={campoCls}>
          <option value="">Todos os vínculos</option>
          {vinculos.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select value={fSituacao} onChange={(e) => setFSituacao(e.target.value)} aria-label="Situação" className={campoCls}>
          <option value="Ativo">Ativos</option>
          <option value="Inativo">Inativos</option>
          <option value="">Todos</option>
        </select>
      </div>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}

      <FolhaRelatorio titulo="Funcionários por unidade" filtros={`${filtros}. Total: ${pessoas} ${pessoas === 1 ? 'funcionário' : 'funcionários'}.`} carregando={!lista}>
        {grupos.length === 0 && <p className="text-sm">Nenhum funcionário com esses filtros.</p>}
        {grupos.map(([unidade, ls]) => (
          <Grupo key={unidade} titulo={unidade} total={ls.length}>
            <table className={tabRel}>
              <thead>
                <tr><th className={thRel}>Nome</th><th className={thRel}>Matrícula</th><th className={thRel}>Cargo</th><th className={thRel}>Vínculo</th><th className={thRel}>CH</th><th className={thRel}>Escala</th></tr>
              </thead>
              <tbody>
                {ls.map(({ f, ch, horarios }) => (
                  <tr key={f.id + unidade}>
                    <td className={tdRel}>{f.nome}{f.situacao === 'Inativo' && ' (inativo)'}</td>
                    <td className={tdRel}>{f.matricula}</td>
                    <td className={tdRel}>{f.cargo}</td>
                    <td className={tdRel}>{f.vinculo}</td>
                    <td className={tdRel}>{ch ? `${ch}h` : ''}</td>
                    <td className={tdRel}>{escala(horarios)}</td>
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
