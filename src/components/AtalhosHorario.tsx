'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DIAS_SEMANA } from '@/lib/constantes';
import { Botao, campoCls } from '@/components/ui';

export type Atalho = { id?: string; entrada: string; saida: string };
export type LinhaRapida = { dia_semana: string; entrada: string; saida: string };

/** Usados enquanto a lista do banco não chega (ou se o 016 não foi rodado) */
const PADRAO: Atalho[] = [
  { entrada: '07:00', saida: '16:00' }, { entrada: '08:00', saida: '16:00' },
  { entrada: '07:00', saida: '17:00' }, { entrada: '08:00', saida: '17:00' },
  { entrada: '07:00', saida: '13:00' }, { entrada: '13:00', saida: '19:00' },
];

let cache: Promise<Atalho[]> | null = null;
export function carregarAtalhos(recarregar = false) {
  if (!cache || recarregar) {
    cache = Promise.resolve(createClient().from('atalhos_horario').select('id, entrada, saida').order('entrada').order('saida'))
      .then(({ data, error }) => (error || !data?.length ? PADRAO
        : data.map((a) => ({ id: a.id, entrada: String(a.entrada).slice(0, 5), saida: String(a.saida).slice(0, 5) }))));
  }
  return cache;
}

export function useAtalhos() {
  const [lista, setLista] = useState<Atalho[]>(PADRAO);
  useEffect(() => {
    let vivo = true;
    carregarAtalhos().then((a) => vivo && setLista(a));
    return () => {
      vivo = false;
    };
  }, []);
  return lista;
}

/** "07:00" → "7h", "07:30" → "7h30" */
export const hora = (t: string) => {
  const [h, m] = t.split(':');
  return `${Number(h)}h${m && m !== '00' ? m : ''}`;
};
export const rotuloAtalho = (a: Atalho) => `${hora(a.entrada)} às ${hora(a.saida)}`;

const CURTO: Record<string, string> = {
  'Segunda-feira': 'Seg', 'Terça-feira': 'Ter', 'Quarta-feira': 'Qua', 'Quinta-feira': 'Qui',
  'Sexta-feira': 'Sex', Sábado: 'Sáb', Domingo: 'Dom',
};
const GRUPOS: [string, string[]][] = [
  ['Seg a Sex', DIAS_SEMANA.slice(0, 5)],
  ['Seg a Sáb', DIAS_SEMANA.slice(0, 6)],
  ['Todos os dias', DIAS_SEMANA],
];

const chip = (ligado: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-semibold transition ${ligado
    ? 'border-acento bg-acento text-white'
    : 'border-linha bg-white text-tinta hover:border-acento hover:text-acento-escuro'}`;

/**
 * Painel "Preencher rápido": escolhe os dias e um horário comum
 * e gera uma linha por dia (frequência semanal).
 */
export default function AtalhosHorario({ onAplicar, ocupado = false }: { onAplicar: (linhas: LinhaRapida[]) => void; ocupado?: boolean }) {
  const atalhos = useAtalhos();
  const [dias, setDias] = useState<string[]>(GRUPOS[0][1]);
  const [entrada, setEntrada] = useState('');
  const [saida, setSaida] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const alternar = (d: string) =>
    setDias((x) => (x.includes(d) ? x.filter((y) => y !== d) : DIAS_SEMANA.filter((y) => y === d || x.includes(y))));
  const igual = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

  function aplicar() {
    if (!dias.length) return setErro('Escolha pelo menos um dia.');
    if (!entrada || !saida) return setErro('Escolha um horário (ou preencha entrada e saída).');
    setErro(null);
    onAplicar(dias.map((dia_semana) => ({ dia_semana, entrada, saida })));
  }

  return (
    <div className="rounded-md border border-acento/30 bg-acento-claro/30 p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold text-acento-escuro">
        <Zap className="size-3.5" aria-hidden /> Preencher rápido
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Dias">
        {GRUPOS.map(([r, g]) => (
          <button key={r} type="button" onClick={() => setDias(g)} className={chip(igual(dias, g))}>{r}</button>
        ))}
        <span className="mx-1 h-5 w-px bg-linha" aria-hidden />
        {DIAS_SEMANA.map((d) => (
          <button key={d} type="button" aria-pressed={dias.includes(d)} onClick={() => alternar(d)}
            className={`${chip(dias.includes(d))} px-2.5`}>{CURTO[d]}</button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Horário">
        {atalhos.map((a) => (
          <button key={`${a.entrada}-${a.saida}`} type="button" onClick={() => { setEntrada(a.entrada); setSaida(a.saida); }}
            className={chip(entrada === a.entrada && saida === a.saida)}>
            {rotuloAtalho(a)}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-tinta-suave">das</span>
        <input type="time" value={entrada} onChange={(e) => setEntrada(e.target.value)} aria-label="Entrada" className={campoCls} />
        <span className="text-tinta-suave">às</span>
        <input type="time" value={saida} onChange={(e) => setSaida(e.target.value)} aria-label="Saída" className={campoCls} />
        <Botao onClick={aplicar} carregando={ocupado}>
          Adicionar {dias.length} {dias.length === 1 ? 'dia' : 'dias'}
        </Botao>
      </div>
      {erro && <p className="mt-1 text-xs font-semibold text-erro">{erro}</p>}
    </div>
  );
}

/** Junta as linhas novas às existentes: troca as linhas em branco e o mesmo dia já cadastrado */
export function juntarLinhas<T extends { frequencia: string; dia_semana: string | null; entrada: string; saida: string; data_referencia: string }>(
  atuais: T[], novas: LinhaRapida[], criar: (l: LinhaRapida) => T,
) {
  const emBranco = (h: T) => !h.entrada && !h.saida && !h.data_referencia;
  const dias = new Set(novas.map((n) => n.dia_semana));
  const mantidas = atuais.filter((h) => !emBranco(h) && !(h.frequencia === 'Semanal' && h.dia_semana && dias.has(h.dia_semana)));
  const ordem = (h: T) => (h.dia_semana ? DIAS_SEMANA.indexOf(h.dia_semana) : 99);
  return [...mantidas, ...novas.map(criar)].sort((a, b) => ordem(a) - ordem(b));
}

/** Lista curta para trocar o horário de uma linha só */
export function SeletorAtalho({ onEscolher, className = campoCls }: { onEscolher: (a: Atalho) => void; className?: string }) {
  const atalhos = useAtalhos();
  return (
    <select value="" aria-label="Horário comum" className={className}
      onChange={(e) => {
        const a = atalhos[Number(e.target.value)];
        if (a) onEscolher(a);
      }}>
      <option value="">Horário comum…</option>
      {atalhos.map((a, i) => <option key={`${a.entrada}-${a.saida}`} value={i}>{rotuloAtalho(a)}</option>)}
    </select>
  );
}
