import { DIAS_SEMANA } from './constantes';
import { dataBR } from './formato';

/** Horário mínimo para comparar escalas */
export type HorarioBase = {
  id?: string; dia_semana: string | null; data_referencia: string | null; frequencia?: string;
  entrada?: string | null; saida?: string | null;
};
export type LotacaoBase = { chave: string; unidade: string; ativa: boolean; horarios: HorarioBase[] };

/** Dia da semana de uma data 'AAAA-MM-DD' (no formato de DIAS_SEMANA) */
export function diaDaData(iso: string) {
  const [a, m, d] = iso.split('-').map(Number);
  const js = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
  return DIAS_SEMANA[(js + 6) % 7];
}

/** Os dois horários caem no mesmo dia? */
function mesmoDia(a: HorarioBase, b: HorarioBase) {
  if (a.data_referencia && b.data_referencia) return a.data_referencia === b.data_referencia;
  const da = a.data_referencia ? diaDaData(a.data_referencia) : a.dia_semana;
  const db = b.data_referencia ? diaDaData(b.data_referencia) : b.dia_semana;
  return !!da && da === db;
}

const minutos = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
/** Intervalo em minutos; saída menor que a entrada = vira a noite (19h às 7h) */
function intervalo(h: HorarioBase): [number, number] | null {
  if (!h.entrada || !h.saida) return null;
  const ini = minutos(h.entrada);
  let fim = minutos(h.saida);
  if (fim <= ini) fim += 24 * 60;
  return [ini, fim];
}

/**
 * Choque de escala: mesmo dia E horários que se sobrepõem.
 * Manhã numa unidade e tarde em outra pode. Sem entrada/saída não dá para afirmar o choque.
 */
function choca(a: HorarioBase, b: HorarioBase) {
  if (!mesmoDia(a, b)) return false;
  const ia = intervalo(a);
  const ib = intervalo(b);
  if (!ia || !ib) return false;
  return ia[0] < ib[1] && ib[0] < ia[1];
}

const rotulo = (h: HorarioBase) => (h.data_referencia ? dataBR(h.data_referencia) : h.dia_semana ?? '');
const faixa = (h: HorarioBase) => (h.entrada && h.saida ? ` ${h.entrada.slice(0, 5)}–${h.saida.slice(0, 5)}` : '');

/** Unidades (ativas, diferentes) que já têm horário no mesmo dia e na mesma hora deste horário */
export function conflitosDoHorario(h: HorarioBase, chaveLotacao: string, lotacoes: LotacaoBase[]) {
  const dono = lotacoes.find((l) => l.chave === chaveLotacao);
  const out = new Set<string>();
  for (const l of lotacoes) {
    if (!l.ativa || l.chave === chaveLotacao || l.unidade === dono?.unidade) continue;
    if (l.horarios.some((x) => choca(h, x))) out.add(l.unidade);
  }
  return [...out];
}

/** Lista de todos os choques: "Segunda-feira 08:00–12:00: Unidade A e Unidade B" */
export function todosConflitos(lotacoes: LotacaoBase[]) {
  const msgs = new Set<string>();
  for (const l of lotacoes) {
    if (!l.ativa) continue;
    for (const h of l.horarios) {
      const outras = conflitosDoHorario(h, l.chave, lotacoes);
      if (outras.length) msgs.add(`${rotulo(h)}${faixa(h)}: ${[l.unidade, ...outras].sort().join(' e ')}`);
    }
  }
  return [...msgs];
}

export const textoConflito = (h: HorarioBase, unidades: string[]) =>
  `Atenção: este funcionário já tem horário em ${unidades.join(' e ')} ${h.data_referencia ? `no dia ${dataBR(h.data_referencia)}` : `na ${rotulo(h).toLowerCase()}`}${faixa(h)}. ` +
  'O mesmo funcionário não pode estar em duas unidades no mesmo horário.';

/** "Qua 07:00–13:00 (quinzenal)" ou "20/10/2026 08:00–17:00" */
export function resumoHorario(h: { frequencia?: string | null; dia_semana: string | null; data_referencia: string | null; entrada?: string | null; saida?: string | null }) {
  const dia = h.data_referencia ? dataBR(h.data_referencia) : (h.dia_semana ?? '').slice(0, 3);
  const hora = h.entrada || h.saida ? ` ${h.entrada?.slice(0, 5) ?? '?'}–${h.saida?.slice(0, 5) ?? '?'}` : '';
  const freq = h.frequencia && !['Semanal', 'Datas específicas'].includes(h.frequencia) ? ` (${h.frequencia.toLowerCase()})` : '';
  return `${dia}${hora}${freq}`;
}
