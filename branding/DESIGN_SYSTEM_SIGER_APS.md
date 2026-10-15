# GUIA OFICIAL DO DESIGN SYSTEM & UI TOKENS — SIGER DAE

## Especificação de Interface para Aplicações Corporativas FSPSS / SESAU

---

### 1. Filosofia de Interface e Princípios Visuais

O Design System do SIGER DAE foi concebido para o ecossistema de Saúde Pública (GovTech & Healthcare), combinando sobriedade institucional, alta legibilidade e ergonomia mobile first.

* **Clareza Operacional**: O usuário deve bater o olho e entender imediatamente o que precisa de ação.
* **Sobriedade Visual**: Ausência de excessos ornamentais, gradientes berrantes ou sombras pesadas.
* **Ergonomia e Thumb Zone**: Alvos de toque com altura mínima de 44px, controles acessíveis na metade inferior da tela de smartphones.
* **Contraste Rígido WCAG 2.1 AA**: Relação de contraste mínima de 4.5:1 para textos normais e 3:1 para elementos de controle.

---

### 2. Paleta de Cores e Tokens Oficiais

#### Cores Primárias e Institucionais
| Nome do Token | Hexadecimal | Descrição e Aplicação |
|---|---|---|
| `--color-electric-cobalt` | `#004aad` | Azul Primário Oficial FSPSS. Ações principais, botões ativos, destaques. |
| `--color-deep-cobalt` | `#003b8a` | Azul Cobalto Escuro. Estados de hover e foco em botões primários. |
| `--color-powder-blue` | `#cfe0f8` | Azul Claro Suave. Fundos de destaque secundário e tags institucionais. |
| `--color-lavender-mist` | `#edf3fc` | Fundo de cartões em destaque e cabeçalhos de tabela. |

#### Cores de Superfície e Fundo
| Nome do Token | Hexadecimal | Descrição e Aplicação |
|---|---|---|
| `--color-canvas-cream` | `#ffffff` | Fundo principal da aplicação em modo claro. |
| `--color-surface-ivory` | `#ffffff` | Superfície de cartões, modais e gavetas laterais. |
| `--color-pure-white` | `#ffffff` | Fundo puro para áreas de leitura e edição. |
| `--color-hairline` | `#e2e8f0` | Borda padrão e divisórias sutis de conteúdo. |
| `--color-faint-gray` | `#f1f5f9` | Fundo de inputs inativos e seções secundárias. |

#### Escala de Textos e Grafites
| Nome do Token | Hexadecimal | Descrição e Aplicação |
|---|---|---|
| `--color-ink-charcoal` | `#0f172a` | Texto principal, títulos e números de impacto. |
| `--color-deep-ink` | `#1e293b` | Títulos secundários e rótulos de alta prioridade. |
| `--color-mid-graphite` | `#334155` | Textos corridos e parágrafos de instrução. |
| `--color-slate-gray` | `#64748b` | Legendas, datas, metadados e ícones neutros. |
| `--color-steel-gray` | `#94a3b8` | Placeholders e elementos desativados. |

#### Cores Semânticas de Status
| Nome do Token | Hexadecimal | Aplicação em Saúde |
|---|---|---|
| `--color-forest` (Sucesso) | `#046645` | Frequência presente, dados sincronizados, metas batidas. |
| `--color-forest-light` | `#e6f4ea` | Fundo de badges de sucesso. |
| `--color-warning` (Atenção) | `#b7791f` | Ausências parciais, atestados médicos, advertências. |
| `--color-warning-light` | `#fef3c7` | Fundo de badges de aviso e alertas médios. |
| `--color-danger` (Crítico) | `#c94a4a` | Faltas sem justificativa, desfalque de equipe mínima. |
| `--color-danger-light` | `#fde8e8` | Fundo de banners de erro e bloqueios. |

---

### 3. Tipografia

A família tipográfica oficial é a **Inter** (com fallback nativo do sistema operacional):

```css
font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
font-feature-settings: "ss01" on, "kern" on;
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

#### Escala Tipográfica Padronizada
| Nível | Tamanho | Peso | Line-Height | Uso |
|---|---|---|---|---|
| Título Executivo H1 | `24px` (`1.5rem`) | `700` (Bold) | `1.2` | Cabeçalho principal da visão |
| Subtítulo de Seção H2 | `18px` (`1.125rem`)| `600` (Semibold)| `1.3` | Títulos de cards e módulos |
| Título Interno H3 | `15px` (`0.9375rem`)| `600` (Semibold)| `1.4` | Tópicos em listas e modais |
| Corpo Regular | `14px` (`0.875rem`) | `400` (Regular) | `1.5` | Conteúdo corrido e instruções |
| Rótulo / Label | `13px` (`0.8125rem`)| `500` (Medium)  | `1.2` | Labels de formulário e filtros |
| Microtexto / Badge | `11px` (`0.6875rem`)| `600` (Semibold)| `1.2` | Badges de status e metadados |

---

### 4. Raios de Arredondamento e Sombras

#### Raios de Borda (`border-radius`)
* **Cartões e Superfícies (`dock-card`)**: `16px` (`rounded-2xl`).
* **Botões e Pílulas (`dock-btn`)**: `48px` (`rounded-full`) para botões de ação e `8px` para botões compactos de tabela.
* **Inputs e Campos de Seleção**: `10px` a `12px` (`rounded-xl`).
* **Badges**: `9999px` (`rounded-full`).

#### Sombras Elevacionais (`box-shadow`)
```css
/* Sombra sutil para cartões e containers limpos */
--shadow-subtle: rgba(0, 0, 0, 0.07) 0px 1px 1px 0px, 
                 rgba(0, 0, 0, 0.04) 0px -1px 1px 0px inset, 
                 rgba(0, 0, 0, 0.14) 0px 0px 0px 0.5px inset;

/* Sombra flutuante para modais e drawers */
--shadow-lg: rgba(0, 0, 0, 0.08) 0px 20px 25px -5px, 
             rgba(0, 0, 0, 0.04) 0px 10px 10px -5px;
```

---

### 5. Classes Utilitárias dos Componentes de Interface

#### 5.1 Cartão Dock (`.dock-card`)
Container primordial de conteúdo que evita bordas grosseiras:
```css
.dock-card {
  background-color: var(--color-pure-white);
  border: 1px solid var(--color-hairline);
  border-radius: 16px;
  box-shadow: var(--shadow-subtle);
  padding: 16px;
}
```

#### 5.2 Botão Primário Cobalto (`.dock-btn-primary`)
Ação de maior hierarquia da tela:
```css
.dock-btn-primary {
  background-color: var(--color-electric-cobalt);
  color: #ffffff;
  font-weight: 500;
  font-size: 14px;
  border-radius: 48px;
  padding: 10px 20px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.05s ease;
}

.dock-btn-primary:hover {
  background-color: var(--color-deep-cobalt);
}

.dock-btn-primary:active {
  transform: scale(0.98);
}
```

#### 5.3 Botão Fantasma / Secundário (`.dock-btn-ghost`)
Ações secundárias, cancelamento e filtros:
```css
.dock-btn-ghost {
  background-color: #ffffff;
  color: var(--color-ink-charcoal);
  font-weight: 500;
  font-size: 14px;
  border: 1px solid var(--color-hairline);
  border-radius: 48px;
  padding: 10px 20px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dock-btn-ghost:hover {
  background-color: var(--color-faint-gray);
  border-color: var(--color-steel-gray);
}
```

#### 5.4 Badges de Frequência e Status
Pílulas compactas com tipografia semibold:
```html
<!-- Presente / Sucesso -->
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e6f4ea] text-[#046645] border border-[#046645]/20">
  <span class="w-1.5 h-1.5 rounded-full bg-[#046645]"></span>
  Presente
</span>

<!-- Ausente / Falta -->
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#fde8e8] text-[#c94a4a] border border-[#c94a4a]/20">
  <span class="w-1.5 h-1.5 rounded-full bg-[#c94a4a]"></span>
  Faltou
</span>

<!-- Atestado Médico -->
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#fef3c7] text-[#b7791f] border border-[#b7791f]/20">
  <span class="w-1.5 h-1.5 rounded-full bg-[#b7791f]"></span>
  Atestado
</span>
```

---

### 6. Padrões de Layout Mobile First

1. **Stacking Vertical Obrigatório**: Em resoluções abaixo de 768px, nenhuma linha de dados deve ultrapassar a largura da tela com scroll horizontal oculto. Os itens se empilham em cartões verticais independentes.
2. **Bottom Sheet & Slide Over Drawer**: Modais de edição em telas mobile devem ancorar na parte inferior da tela (Slide Over da base), permitindo fechamento por arrasto ou toque na zona do polegar.
3. **Safe Areas**: Uso sistemático de `env(safe-area-inset-bottom)` em rodapés fixos para compatibilidade com a barra de navegação gestual do iPhone e Android moderno.
4. **Alvos de Toque (Touch Targets)**: Nenhum elemento clicável (botão, checkbox, item de lista) pode possuir dimensão inferior a 44x44 pixels.
