import { dataBR } from './formato';
import { resumoHorarios, type Lancamento } from './lancamentos';

/** Seções do documento de envio ao RH (A4), na ordem em que aparecem */
export const SECOES_DOC = [
  { id: 'ausencias', titulo: 'Ausências de registro', colunas: ['Profissional', 'Tipo', 'Ref.'] },
  { id: 'folgas', titulo: 'Solicitações de folga', colunas: ['Profissional', 'Saída', 'Qtd.'] },
  { id: 'abonos', titulo: 'Solicitações de abono', colunas: ['Profissional', 'Dia'] },
  { id: 'ferias', titulo: 'Férias / LP', colunas: ['Profissional', 'Tipo', 'Saída', 'Qtd.'] },
  { id: 'he', titulo: 'HE / Compensação de horas', colunas: ['Profissional', 'Tipo', 'Ref.', 'Qtd.'] },
  { id: 'avaliacao', titulo: 'Avaliação de desempenho', colunas: ['Profissional'] },
  { id: 'geral', titulo: 'Requisição geral', colunas: ['Profissional', 'Assunto'] },
] as const;

export type SecaoId = (typeof SECOES_DOC)[number]['id'];

/** Em qual seção do documento cada pedido entra */
export function secaoDocumento(l: Lancamento): SecaoId {
  if (l.tipo === 'Outro') return 'geral';
  switch (l.categoria) {
    case 'ponto_ausencias': return 'ausencias';
    case 'folgas_abonos': return l.tipo === 'Abono' || l.tipo === 'Abono natalício' ? 'abonos' : 'folgas';
    case 'ferias_lp': return 'ferias';
    case 'he_bh': return 'he';
    case 'avaliacoes': return 'avaliacao';
    default: return 'geral';
  }
}

const dias = (l: Lancamento) => (l.qtd_dias != null ? `${l.qtd_dias} ${l.qtd_dias === 1 ? 'dia' : 'dias'}` : '');

/** Células da linha conforme a seção */
export function celulas(secao: SecaoId, l: Lancamento): string[] {
  const nome = l.funcionario_nome;
  switch (secao) {
    case 'ausencias': {
      const ref = l.data_inicio
        ? [dataBR(l.data_inicio) + (l.qtd_dias && l.qtd_dias > 1 ? ` (${dias(l)})` : ''), resumoHorarios(l)].filter(Boolean).join(', ')
        : l.referencia ?? '';
      return [nome, l.motivo_ocorrencia ? `${l.tipo}: ${l.motivo_ocorrencia}` : l.tipo, ref];
    }
    case 'folgas': return [nome, dataBR(l.data_inicio), dias(l)];
    case 'abonos': return [nome, dataBR(l.data_inicio) + (l.qtd_dias && l.qtd_dias > 1 ? ` (${dias(l)})` : '')];
    case 'ferias': return [nome, l.tipo + (l.venda_terco ? ' (venda de 1/3)' : ''), dataBR(l.data_inicio), dias(l)];
    case 'he': return [nome, l.tipo, l.referencia ?? '', l.quantidade ?? ''];
    case 'avaliacao': return [nome + (l.referencia ? ` (${l.referencia})` : '')];
    case 'geral': return [nome, l.obs || l.tipo];
  }
}
