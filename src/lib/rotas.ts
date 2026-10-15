import {
  Users, UserPlus, Contact, Inbox, ListChecks, Fingerprint, ClipboardCheck,
  Send, FileText, Printer, Settings, type LucideIcon,
} from 'lucide-react';

export type Rota = {
  path: string;
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  somenteCentral?: boolean;
  /** Só aparece para o ADM-Unidade */
  somenteUnidade?: boolean;
};

export const ROTAS: Rota[] = [
  { path: '/funcionarios',    titulo: 'Funcionários',           descricao: 'Cadastro geral, lotações, escalas e histórico de cada funcionário.', icone: Users },
  { path: '/equipe',          titulo: 'Meus funcionários',      descricao: 'Dados e horários dos funcionários lotados na unidade.', icone: Contact, somenteUnidade: true },
  { path: '/sugestoes',       titulo: 'Sugerir cadastro',       descricao: 'Sugira à DAE o cadastro de um funcionário e os dias dele na unidade.', icone: UserPlus, somenteUnidade: true },
  { path: '/acompanhar',      titulo: 'Acompanhar pedidos',     descricao: 'Em que etapa estão as folgas, férias e demais pedidos da unidade.', icone: ListChecks, somenteUnidade: true },
  { path: '/pedidos',         titulo: 'Pedidos',                descricao: 'Férias / LP, Folgas / Abonos e HE / BH.', icone: Inbox, somenteCentral: true },
  { path: '/ponto-ausencias', titulo: 'Ponto / Ausências',      descricao: 'Ocorrências de ponto, atestados e declarações.', icone: Fingerprint, somenteCentral: true },
  { path: '/avaliacoes',      titulo: 'Avaliações',             descricao: 'Avaliações de desempenho.', icone: ClipboardCheck, somenteCentral: true },
  { path: '/envios-rh',       titulo: 'Envios RH',              descricao: 'Selecione lançamentos autorizados e gere o documento de envio ao RH.', icone: Send, somenteCentral: true },
  { path: '/avisos-rh',       titulo: 'Avisos RH',              descricao: 'Acompanhe os avisos emitidos e confirme os envios.', icone: FileText, somenteCentral: true },
  { path: '/relatorios',      titulo: 'Relatórios',             descricao: 'Relatórios de funcionários e administrativos para impressão.', icone: Printer, somenteCentral: true },
  { path: '/administracao',   titulo: 'Administração',          descricao: 'Usuários, unidades, vínculos e diretores.', icone: Settings, somenteCentral: true },
];
