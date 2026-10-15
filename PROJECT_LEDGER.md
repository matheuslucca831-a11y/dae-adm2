# PROJECT LEDGER — SIGER DAE

## [v3.24.0 - "SIGER DAE"] - 15/10/2026
### Build Estática Pura (.zip) para HostGator Apache (Extração Direta em Subdomínio)
* **Escopo**: Exportação estática pura (`output: 'export'`) para hospedagem direta no Apache da HostGator via arquivo `.zip`, sem necessidade de runtime Node.js.
* **Arquitetura da Distribuição Estática**:
  * `next.config.mjs`: Configurado com `output: 'export'` e `images: { unoptimized: true }`.
  * `src/lib/contextoPerfil.tsx`: Criação de Provedor de Autenticação Client-Side (`ProvedorPerfil` e `usePerfil`) para validação de sessão e recuperação de perfil diretamente via Supabase Browser SDK, preservando 100% da segurança por RLS.
  * Camada de Apresentação: Layouts e páginas convertidos para componentes cliente, eliminando dependências de headers/cookies de servidor na etapa de build.
  * Apache `.htaccess`: Criado na raiz do pacote estático com regras de reescrita para URLs limpas (sem extensão `.html`), fallback de rotas, compressão Gzip (`mod_deflate`) e expiração de cache (`mod_expires`).
  * Pacote Gerado: `SIGER-DAE-v3.24.0-HostGator.zip` (3.12 MB) e pasta `dist-[v3.24.0 - SIGER DAE] - 15-10-2026/`.
* **Validação Operacional**:
  * 100% das 24 rotas compiladas e exportadas como arquivos estáticos `.html` reais (`login.html`, `administracao.html`, `funcionarios.html`, etc.).
  * Teste do arquivo `.zip` confirmando presença de todos os chunks estáticos, CSS e `.htaccess`.

## [v3.23.0 - "SIGER DAE"] - 15/10/2026
### Build Standalone Otimizada para Hospedagem HostGator (cPanel Node.js + Apache)
* **Escopo**: Empacotamento de produção para HostGator cPanel (Phusion Passenger / Apache).
* **Arquitetura da Distribuição**:
  * `next.config.mjs`: Habilitado `output: 'standalone'` para gerar o runtime Node.js autocontido.
  * Pasta de Distribuição: Criada a pasta `dist-[v3.23.0 - SIGER DAE] - 15-10-2026/` seguindo a diretriz estrita de versionamento do projeto.
  * Estrutura Empacotada:
    * `server.js`: Ponto de entrada nativo do Node.js compatível com o Phusion Passenger do cPanel da HostGator.
    * `.htaccess`: Regras para o Apache com compressão Gzip (`mod_deflate`), cache estático (`mod_expires`) e diretivas do Passenger.
    * `.next/`: Build de produção compilada contendo `static/` e `server/`.
    * `public/`: Assets estáticos (logos, ícones e brasões institucionais).
    * `node_modules/`: Dependências mínimas isoladas para produção.
    * `.env.production`: Variáveis de conexão Supabase para o ambiente de produção.
* **Validação Operacional**:
  * Servidor de produção standalone executado e testado com sucesso com resposta HTTP 200 nas rotas dinâmicas.
  * Servidor de desenvolvimento local restaurado e aquecido em `http://localhost:3000` sem erros 404 de chunks.

## [v3.22.0 - "SIGER DAE"] - 15/10/2026
### Readequação Estrutural da Área Interna ao Padrão SIGER APS
* **Escopo**: Front end exclusivo. Lógica de negócio, contratos de API e banco de dados 100% preservados.
* **Layout Interno & Shell Institucional**:
  * Menu Lateral Desktop: Inclusão do brasão institucional transparente `public/logo-transparent.png` sem duplicações textuais; unificação cromática total no tom oficial Azul Cobalto Elétrico (`#004aad`); itens de navegação com pílulas ativas brancas e sombra suave; rodapé com pílula de persistência local `Salvo no Aparelho 0 local`, pílula de lotação jurisdicional e avatar com iniciais duplas do usuário.
  * Barra Superior Institucional: Continuidade cromática uniforme em Azul Cobalto Elétrico (`#004aad`), pílula de busca global, selo de integridade `Base Sincronizada`, alternador de tema escuro, sinete de notificações e container com brasões oficiais.
  * Subnavegação: Conversão integral das abas horizontais para o formato de pílulas flutuantes.
* **Gestão de Usuários e Permissões (Padrão SIGER APS)**:
  * Banner Executivo: Cartão com ícone institucional em azul cobalto elétrico, titulação hierárquica e botões de ação rápida (`Sincronizar Rede` e `Novo Usuário`).
  * Grupo de Filtros e Busca: Pílulas de segmentação com contadores dinâmicos (`Todos os Usuários`, `Gestores Unidade`, `Administradores Sede`, `Ativos`, `Inativos`), busca dedicada e alternador de visão (Cartões vs Tabela).
  * Lista de Usuários em Cartões Flutuantes: Cada gestor renderizado em cartão branco arredondado independente com avatar circular de iniciais duplas, crachá de perfil de acesso (`GESTOR FREQUÊNCIA` | `ADM CENTRAL`), metadados de contato, tag de lotação titular, ponto semântico de atividade e ações diretas (`Senha`, `Editar`, `Desativar`/`Reativar`).
* **Higienização de Conteúdo & Validação Estática**:
  * Banimento rigoroso de caracteres de emojis e eliminação de hífens estilísticos em títulos e microtextos.
  * Validação de compilação estática via `next build` aprovada em 100% das 23 rotas sem regressões.

## [v3.21.0 - "SIGER DAE"] - 15/10/2026
### Rebranding Institucional e Implementação do Design System
* **Escopo**: Front end exclusivo. Lógica de negócio, contratos de API e banco de dados 100% preservados.
* **Identidade Visual**:
  * Difusão de assets oficiais (`SIGER DAE logo.png` e `header SIGER DAE.png`) como favicon, apple-icon, og-image, cabeçalhos principais e `logo-transparent.png` sem background alinhado à margem esquerda institucional.
  * Adoção da paleta oficial FSPSS / SESAU: Azul Cobalto Elétrico (`#004aad`), Cobalto Escuro (`#003b8a`), Verde Floresta (`#046645`) e Branco Puro.
  * Aplicação de tokens e classes `.dock-card`, `.dock-btn-primary`, `.dock-btn-ghost` e sombras sutis.
  * Tipografia oficial Inter em substituição a fontes genéricas.
* **Arquitetura de Navegação**:
  * Cabeçalho unificado com logo oficial e identificador de unidade ativa.
  * Shell responsivo com Menu Lateral Desktop e Navegação Inferior Mobile na Thumb Zone.
  * Alvos de toque com altura mínima de 44px (WCAG 2.1 AA).
* **Higienização de Conteúdo**:
  * Banimento total de emojis gráficos unicode.
  * Substituição de hífens estilísticos em rótulos, opções e títulos por barras verticais ou pontuação coesa.
