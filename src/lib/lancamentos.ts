/** Configuração de cada aba de lançamento. As telas leem daqui. */
export type Campo = 'periodo' | 'venda_terco' | 'referencia' | 'quantidade';
export type Categoria = 'ferias_lp' | 'folgas_abonos' | 'he_bh' | 'ponto_ausencias' | 'avaliacoes';

export type ConfigCategoria = {
  titulo: string;
  descricao: string;
  tipos: string[];
  campos: Campo[];
  /** Data principal do pedido (usada no filtro de período) */
  dataPrincipal: 'data_inicio' | 'data_recebimento';
  /** false = só a DAE lança; a unidade apenas acompanha (igual a categoria_so_dae no banco) */
  unidadeLanca: boolean;
  /** Gera comunicação 1Doc ao autorizar (igual ao trigger tg_lancamento_1doc) */
  temUmDoc: boolean;
  /** Datas opcionais (ex.: ponto, em que nem todo tipo tem data) */
  periodoOpcional?: boolean;
};

export const CATEGORIAS: Record<Categoria, ConfigCategoria> = {
  folgas_abonos: {
    titulo: 'Folgas / Abonos', descricao: 'Folgas, abonos e demais dispensas.',
    tipos: ['Folga', 'Banco de Horas', 'Folga abonada', 'Abono', 'Abono natalício', 'Serviço eleitoral',
      'Trabalho eventual', 'Campanha de vacinação', 'Outro'],
    campos: ['periodo'], dataPrincipal: 'data_inicio', unidadeLanca: false, temUmDoc: true,
  },
  ferias_lp: {
    titulo: 'Férias / LP', descricao: 'Férias e Licença-Prêmio.',
    tipos: ['Férias', 'Licença-Prêmio'],
    campos: ['periodo', 'venda_terco'], dataPrincipal: 'data_inicio', unidadeLanca: false, temUmDoc: true,
  },
  he_bh: {
    titulo: 'HE / BH / Compensações', descricao: 'Horas extras, banco de horas e compensações.',
    tipos: ['Hora Extra', 'Banco de Horas', 'Compensação de Horas', 'Outro'],
    campos: ['referencia', 'quantidade'], dataPrincipal: 'data_recebimento', unidadeLanca: false, temUmDoc: false,
  },
  ponto_ausencias: {
    titulo: 'Ponto / Ausências', descricao: 'Ocorrências de ponto, atestados e declarações.',
    tipos: ['Ocorrência de ponto', 'Atestado', 'Declaração', 'Cartão/Espelho de Ponto + Justificativa', 'Outro'],
    campos: ['periodo', 'referencia'], dataPrincipal: 'data_recebimento', unidadeLanca: false, temUmDoc: false,
    periodoOpcional: true,
  },
  avaliacoes: {
    titulo: 'Avaliações', descricao: 'Avaliações de desempenho.',
    tipos: ['Avaliação de desempenho', 'Avaliação de desempenho (promoção)'],
    campos: ['referencia'], dataPrincipal: 'data_recebimento', unidadeLanca: false, temUmDoc: false,
  },
};

import { dataBR } from './formato';

/** Resumo das datas ou da referência: "09/10/2026 a 11/10/2026 (2 dias)" ou "Ref. 10/2026, Qtd. 12h30" */
export function detalhe(l: Pick<Lancamento, 'data_inicio' | 'data_retorno' | 'qtd_dias' | 'referencia' | 'quantidade'>) {
  if (l.data_inicio) {
    const fim = l.data_retorno ? ` a ${dataBR(l.data_retorno)}` : '';
    return `${dataBR(l.data_inicio)}${fim}${l.qtd_dias ? ` (${l.qtd_dias} ${l.qtd_dias === 1 ? 'dia' : 'dias'})` : ''}`;
  }
  return [l.referencia && `Ref. ${l.referencia}`, l.quantidade && `Qtd. ${l.quantidade}`].filter(Boolean).join(', ');
}

export type Decisao = 'Aguardando' | 'Autorizado' | 'Devolvido' | 'Não autorizado' | 'Dispensado';

type Um1Doc = { id: string; situacao: 'Pendente' | 'Enviado' };
type ItemAviso = { aviso: { id: string; numero: string } | null };

/** Primeiro item de uma relação, venha como lista ou objeto */
export const primeiro = <T,>(x: T | T[] | null | undefined): T | undefined => (Array.isArray(x) ? x[0] : x ?? undefined);

export type Lancamento = {
  id: string; protocolo_dae: string; categoria: Categoria; tipo: string;
  funcionario_id: string; funcionario_nome: string; vinculo: string | null;
  unidade_id: string | null; unidade_nome: string | null;
  data_recebimento: string; data_inicio: string | null; data_retorno: string | null; qtd_dias: number | null;
  venda_terco: boolean; referencia: string | null; quantidade: string | null; obs: string | null;
  diretora: Decisao; diretora_obs: string | null; diretora_em: string | null;
  diretor_id: string | null; diretor_nome: string | null; data_assinatura: string | null;
  motivo_ocorrencia: string | null; testemunha: string | null;
  horario_entrada: string | null; horario_saida_almoco: string | null; horario_retorno_almoco: string | null; horario_saida: string | null;
  situacao_rh: string; destino_rh: string | null; enviado_rh_em: string | null; baixa_em: string | null;
  avaliacao_etapa: 'Na DAE' | 'Na unidade' | 'Devolvida' | null; avaliacao_unidade_em: string | null; avaliacao_devolvida_em: string | null;
  // O Supabase pode devolver lista ou objeto (relação 1 para 1); use primeiro()
  comunicados_1doc?: Um1Doc | Um1Doc[] | null;
  aviso_rh_itens?: ItemAviso | ItemAviso[] | null;
};

export const CAMPOS_LANCAMENTO =
  'id, protocolo_dae, categoria, tipo, funcionario_id, funcionario_nome, vinculo, unidade_id, unidade_nome, ' +
  'data_recebimento, data_inicio, data_retorno, qtd_dias, venda_terco, referencia, quantidade, obs, ' +
  'motivo_ocorrencia, testemunha, horario_entrada, horario_saida_almoco, horario_retorno_almoco, horario_saida, ' +
  'diretora, diretora_obs, diretora_em, diretor_id, diretor_nome, data_assinatura, situacao_rh, destino_rh, enviado_rh_em, baixa_em, ' +
  'avaliacao_etapa, avaliacao_unidade_em, avaliacao_devolvida_em';

/** Para a tabela: inclui 1Doc e Aviso RH */
export const CAMPOS_TABELA =
  CAMPOS_LANCAMENTO + ', comunicados_1doc(id, situacao), aviso_rh_itens(aviso:avisos_rh(id, numero))';

/** Pode editar enquanto não foi assinado (ou foi devolvido) */
export const podeEditar = (l: Lancamento) => l.diretora === 'Aguardando' || l.diretora === 'Devolvido';

export const DESTINOS_RH = ['RH SESAU', 'RH FSPSS'];
export const DESTINOS_1DOC = ['Central de Regulação', 'Unidades onde atende', 'Outro'];

export const TIPO_PROMOCAO = 'Avaliação de desempenho (promoção)';
const ENVIADO = ['Enviado ao RH', 'Concluído']; // "Concluído" = registros antigos (antes não havia arquivamento)

/** Situações que contam como "em andamento" e como "concluído" */
export const SITUACOES_ANDAMENTO = ['Aguardando autorização', 'Autorizado / Aguardando envio'];
export const SITUACOES_CONCLUIDO = ENVIADO;

export type Passo = { titulo: string; data: string | null };

/**
 * Linha do tempo do pedido.
 * - Pedidos: Na DAE → Assinado → Enviado ao RH (termina aqui)
 * - Avaliações: Recebida do RH → Na unidade → Devolvida pela unidade → Assinada (ou liberada, na promoção) → Enviada ao RH
 * `atual` = última etapa cumprida. `parado` = devolvido/não autorizado pela Diretoria (trava a etapa seguinte).
 */
export function linhaDoTempo(l: Lancamento): { passos: Passo[]; atual: number; parado: string | null; fim: boolean } {
  const rh = `Enviado ao ${l.destino_rh ?? 'RH'}`;
  const assinatura = l.data_assinatura ?? l.diretora_em;
  const parado = l.diretora === 'Devolvido' || l.diretora === 'Não autorizado' ? l.diretora : null;
  let passos: Passo[];
  let atual: number;

  if (l.categoria === 'avaliacoes') {
    passos = [
      { titulo: 'Recebida do RH', data: l.data_recebimento },
      { titulo: 'Na unidade', data: l.avaliacao_unidade_em },
      { titulo: 'Devolvida pela unidade', data: l.avaliacao_devolvida_em },
      { titulo: l.tipo === TIPO_PROMOCAO ? 'Liberada (sem assinatura)' : 'Assinada', data: assinatura },
      { titulo: rh, data: l.enviado_rh_em },
    ];
    atual = ENVIADO.includes(l.situacao_rh) ? 4
      : l.situacao_rh === 'Autorizado / Aguardando envio' ? 3
      : l.avaliacao_etapa === 'Devolvida' ? 2 : l.avaliacao_etapa === 'Na unidade' ? 1 : 0;
  } else {
    passos = [
      { titulo: 'Na DAE', data: l.data_recebimento },
      { titulo: 'Assinado', data: assinatura },
      { titulo: rh, data: l.enviado_rh_em },
    ];
    atual = ENVIADO.includes(l.situacao_rh) ? 2 : l.situacao_rh === 'Autorizado / Aguardando envio' ? 1 : 0;
  }
  return { passos, atual, parado, fim: atual === passos.length - 1 };
}

// ---------------- Ponto ----------------
export const TIPO_OCORRENCIA = 'Ocorrência de ponto';
export const TIPO_CARTAO = 'Cartão/Espelho de Ponto + Justificativa';

/** Quem pode usar cada formulário de ponto */
export const VINCULO_EXIGIDO: Record<string, string> = { [TIPO_OCORRENCIA]: 'FSPSS', [TIPO_CARTAO]: 'Estatutário' };

/** Justificativas do Formulário de Ocorrência de Ponto (FSPSS) */
export const MOTIVOS_OCORRENCIA = [
  { valor: 'Esquecimento', ajuda: 'limitado a 5 ocorrências por mês' },
  { valor: 'Anomalia no funcionamento do REP', ajuda: 'erro na leitura biométrica, falta de papel, atolamento da impressora etc. Exige testemunha' },
  { valor: 'Serviço externo', ajuda: 'reunião, visita à unidade etc.' },
  { valor: 'Transferência temporária de lotação', ajuda: '' },
  { valor: 'Outros', ajuda: 'descreva a ocorrência' },
];

export function modoPonto(categoria: Categoria, tipo: string): 'ocorrencia' | 'cartao' | 'padrao' {
  if (categoria !== 'ponto_ausencias') return 'padrao';
  return tipo === TIPO_OCORRENCIA ? 'ocorrencia' : tipo === TIPO_CARTAO ? 'cartao' : 'padrao';
}

/** "Entrada 07:00, Saída 16:00" */
export function resumoHorarios(l: Pick<Lancamento, 'horario_entrada' | 'horario_saida_almoco' | 'horario_retorno_almoco' | 'horario_saida'>) {
  return ([['Entrada', l.horario_entrada], ['Saída almoço', l.horario_saida_almoco], ['Retorno almoço', l.horario_retorno_almoco], ['Saída', l.horario_saida]] as const)
    .filter(([, h]) => h).map(([r, h]) => `${r} ${h!.slice(0, 5)}`).join(', ');
}

/** Texto curto do andamento: "Aguardando assinatura", "Enviado ao RH SESAU"… */
export function textoAndamento(l: Pick<Lancamento, 'situacao_rh' | 'destino_rh'> & Partial<Pick<Lancamento, 'categoria' | 'avaliacao_etapa'>>) {
  if (l.categoria === 'avaliacoes' && l.situacao_rh === 'Aguardando autorização') {
    if (l.avaliacao_etapa === 'Na DAE') return 'Recebida do RH, a enviar à unidade';
    if (l.avaliacao_etapa === 'Na unidade') return 'Com a unidade';
  }
  switch (l.situacao_rh) {
    case 'Aguardando autorização': return 'Aguardando assinatura';
    case 'Autorizado / Aguardando envio': return 'Pronto, aguardando envio ao RH';
    case 'Enviado ao RH':
    case 'Concluído': return `Enviado ao ${l.destino_rh ?? 'RH'}`;
    default: return l.situacao_rh;
  }
}

/** Como mostrar a decisão da Diretoria */
export const textoDecisao = (d: string) => (d === 'Dispensado' ? 'Sem assinatura' : d);
