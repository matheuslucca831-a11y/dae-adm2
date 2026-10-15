'use client';

import { Plus, Trash2 } from 'lucide-react';
import { DIAS_SEMANA, FREQUENCIAS } from '@/lib/constantes';
import { Botao, campoCls } from '@/components/ui';
import AtalhosHorario, { SeletorAtalho, juntarLinhas } from '@/components/AtalhosHorario';

export type HorarioSugestao = { frequencia: string; dia_semana: string; data_referencia: string; entrada: string; saida: string };
export const novoHorario = (): HorarioSugestao => ({ frequencia: 'Semanal', dia_semana: 'Segunda-feira', data_referencia: '', entrada: '', saida: '' });

/** Linhas de dia/horário de trabalho na unidade */
export default function EditorHorarios({ valor, onChange }: { valor: HorarioSugestao[]; onChange: (v: HorarioSugestao[]) => void }) {
  const muda = (i: number, p: Partial<HorarioSugestao>) => onChange(valor.map((h, k) => (k === i ? { ...h, ...p } : h)));
  return (
    <div className="space-y-2">
      <AtalhosHorario onAplicar={(novas) => onChange(juntarLinhas(valor, novas, (l) => ({ ...novoHorario(), ...l })))} />
      {valor.map((h, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-md bg-papel/60 p-2">
          <select value={h.frequencia} onChange={(e) => muda(i, { frequencia: e.target.value })} aria-label="Frequência" className={campoCls}>
            {FREQUENCIAS.map((f) => <option key={f}>{f}</option>)}
          </select>
          {h.frequencia === 'Datas específicas' ? (
            <input type="date" value={h.data_referencia} onChange={(e) => muda(i, { data_referencia: e.target.value })} aria-label="Data" className={campoCls} />
          ) : (
            <select value={h.dia_semana} onChange={(e) => muda(i, { dia_semana: e.target.value })} aria-label="Dia da semana" className={campoCls}>
              {DIAS_SEMANA.map((d) => <option key={d}>{d}</option>)}
            </select>
          )}
          <span className="text-sm text-tinta-suave">das</span>
          <input type="time" value={h.entrada} onChange={(e) => muda(i, { entrada: e.target.value })} aria-label="Entrada" className={campoCls} />
          <span className="text-sm text-tinta-suave">às</span>
          <input type="time" value={h.saida} onChange={(e) => muda(i, { saida: e.target.value })} aria-label="Saída" className={campoCls} />
          <SeletorAtalho onEscolher={(a) => muda(i, { entrada: a.entrada, saida: a.saida })} />
          <button type="button" aria-label="Remover dia" onClick={() => onChange(valor.filter((_, k) => k !== i))}
            className="rounded p-1.5 text-tinta-suave hover:bg-erro-claro hover:text-erro"><Trash2 className="size-4" /></button>
        </div>
      ))}
      <Botao variante="secundario" onClick={() => onChange([...valor, novoHorario()])}><Plus className="size-4" aria-hidden /> Adicionar dia</Botao>
    </div>
  );
}
