# MANUAL DE BRANDING & IDENTIDADE VISUAL — SIGER DAE

## Diretrizes Institucionais de Marca para o Ecossistema Digital FSPSS / SESAU

---

### 1. Posicionamento e DNA da Marca

O **SIGER DAE** (Sistema Integrado de Gestão e Relatórios da Atenção Especializada) é a plataforma oficial da Fundação de Saúde Pública de São Sebastião (FSPSS) em cooperação com a Secretaria de Saúde (SESAU).

A identidade do produto sintetiza:
* **Autoridade Pública**: A robustez e a seriedade de um órgão governamental de saúde.
* **Agilidade Contemporânea**: A experiência de um software corporativo leve, intuitivo e resolutivo.
* **Cuidado e Humanização**: O foco na assistência à população através da valorização dos profissionais da ponta.

---

### 2. Elementos Centrais de Identidade da Marca

#### 2.1 Nome e Nomenclatura Oficial
* **Nome Primário**: `SIGER DAE` (sempre em caixa alta).
* **Extenso Oficial**: `Sistema Integrado de Gestão e Relatórios da Atenção Primária`.
* **Subordinação Institucional**: `FSPSS | Secretaria de Saúde de São Sebastião`.

#### 2.2 Símbolos Oficiais e Brasões
1. **Logo SIGER DAE**: Composto pelo isotipo vetorial estilizado em tons de azul cobalto e verde floresta, acompanhado pela tipografia institucional.
2. **Brasão FSPSS**: Utilizado no cabeçalho e nos rodapés de documentos gerados e telas de autenticação.
3. **Brasão do Município de São Sebastião**: Utilizado em conjunto nos documentos executivos e relatórios de supervisão com proporção equilibrada.

---

### 3. Diretrizes Rígidas de Conteúdo e UX Writing

Para preservar a imagem institucional e a sobriedade dos sistemas, as seguintes regras são compulsórias para o SIGER DAE e quaisquer aplicações derivadas:

#### 3.1 Banimento Total de Emojis Unicode
* **Regra**: É estritamente proibido o uso de emojis gráficos (como carinhas, mãos, polegares, fogos ou alertas em emoji) em qualquer parte do sistema: telas, botões, modais, mensagens de erro, toasts, logs ou documentações técnicas.
* **Substituto Exclusivo**: Utilizar ícones vetoriais semânticos da biblioteca **Lucide Icons** (exemplo: `CheckCircle2`, `AlertTriangle`, `Calendar`, `UserCheck`, `Building2`).

#### 3.2 Banimento de Hífens como Separadores em Copys
* **Regra**: É proibido utilizar o caractere de hífen (`-`) como elemento estilístico ou separador de frases em títulos, subtítulos, botões, mensagens de feedback ou placeholders.
* **Alternativas Recomendadas**:
  * Utilizar dois pontos (`:`) para desdobramentos lógicos (ex: *Competência: Outubro de 2026*).
  * Utilizar barra vertical (`|`) para metadados curtos (ex: *USF Maresias | Manhã*).
  * Reescrever a frase de forma coesa e direta sem muletas de pontuação.

#### 3.3 Tom de Voz Institucional
* **Objetivo e Claro**: Mensagens diretas, orientadas à ação imediata do operador.
* **Educativo e Sem Punição**: Em casos de erro ou preenchimento incorreto, a mensagem deve explicar exatamente como solucionar o problema sem termos técnicos obscuros.
  * Incorreto: *"Erro 500: falha no banco de dados ao salvar a frequência."*
  * Correto: *"Não foi possível salvar os registros desta unidade. Verifique sua conexão e tente novamente."*

---

### 4. Iconografia Oficial (Padrão Lucide)

Todas as aplicações FSPSS devem padronizar o consumo de ícones utilizando **Lucide Icons**:

* **Espessura do Traço (`stroke-width`)**: Padronizada em `1.75px` ou `2.0px`.
* **Dimensões Padronizadas**:
  * Microícones de inline / badges: `14px` x `14px`.
  * Ícones em botões e tabelas: `16px` x `16px` ou `18px` x `18px`.
  * Ícones de navegação e cabeçalhos: `20px` x `20px`.
  * Ícones em estados vazios (Empty States): `36px` a `48px`.
* **Cores dos Ícones**: Sempre herdar a cor do contexto (`currentColor`) ou aplicar tokens semânticos específicos (`text-electric-cobalt`, `text-forest`, `text-slate-gray`).

---

### 5. Aplicação do Branding em Novos Sistemas da FSPSS

Ao iniciar ou adaptar um novo sistema satélite (ex: Almoxarifado, Regulação, Escalas, ADMs), a equipe deve seguir este checklist visual para garantir consistência entre plataformas sem tocar na lógica funcional:

1. **Cabeçalho Unificado**: Barra superior limpa com fundo branco `#ffffff`, borda inferior sutil `#e2e8f0`, logotipo à esquerda e identificação da unidade ativa à direita.
2. **Estrutura de Cartões**: Agrupamento de formulários e listagens em containers `.dock-card` com raio de `16px` e sombra sutil.
3. **Botão de Ação Primária**: Padronizado com fundo Azul Cobalto `#004aad`, cantos arredondados `48px` (`rounded-full`) e texto branco em peso 500.
4. **Navegação Inferior Mobile**: Em dispositivos móveis, menus principais fixados na base da tela com ícones e rótulos curtos na zona de alcance natural do polegar.
5. **Zero Emojis e Zero Hífens em Textos**: Aplicação estrita da revisão de UX Writing em todas as interfaces.
