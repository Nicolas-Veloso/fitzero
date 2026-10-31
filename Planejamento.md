# Planejamento de Engenharia e Distribuição de Tarefas (4 Devs) — FitZero

## 1. Visão Geral e Restrições Não-Negociáveis

* **Budget de Performance:** Tamanho final do bundle estático $< 1\text{ MB}$ (teto operacional $\le 850\text{ KB}$).
* **Arquitetura:** Progressive Web App (PWA) *Offline-First* estrito, sem chamadas de rede em tempo de execução após o primeiro carregamento.
* **Stack Tecnológico:**
  * **Core:** HTML5 Semântico, CSS3 Moderno (Custom Properties, Flexbox/Grid nativos, zero frameworks volumosos), Vanilla JavaScript (ES2022+ modular sem bundlers que gerem overhead de runtime).
  * **Armazenamento Local:** `LocalStorage` estruturado com validação de esquema runtime e controle de versão.
  * **Mídias:** SVG 100% inline/otimizado via SVGO, sem tags `<video>` ou arquivos MP4/GIF.
  * **Worker API:** `Service Worker` customizado com estratégia estrita `Cache-First` para assets e `Stale-While-Revalidate` condicional.

## 2. Matriz de Perfis e Divisão da Equipe (4 Devs)

| Dev | Papel Principal | Foco Técnico |
| :--- | :--- | :--- |
| **Dev 1** | **Tech Lead & PWA Core** | Service Workers, ciclo de vida do cache, arquitetura *offline-first*, Web App Manifest e bundle budget. |
| **Dev 2** | **Frontend UI/UX & Acessibilidade** | Interface responsiva mobile-first, navegação por abas, CSS puro, modo escuro nativo e WCAG. |
| **Dev 3** | **Motor de Treino & Motor de Tempo** | State machine de sessões (séries/descanso), áudio sintetizado via Web Audio API, persistência local e timers. |
| **Dev 4** | **Engenharia de Conteúdo & SVG Assets** | Estruturação dos catálogos (JSON), otimização de vetores anatômicos (SVG/SVGO), animações CSS leves e filtros de treino. |

---

## 3. Backlog Detalhado de Engenharia (Sprint Backlog 1 Semana)

> **Convenção de Estimativa:** Story Points em escala Fibonacci ($1, 2, 3, 5, 8$), calibrados para uma capacidade de $\approx 10\text{ a }13$ pontos por dev na sprint de 5 dias.

### Épico 1: Fundação PWA, Infraestrutura & Performance
*Responsável principal: Dev 1*

#### `[PWA-01]` Configuração do Web App Manifest e App Shell Base
* **Responsável:** Dev 1 | **Pontos:** 2 | **Prioridade:** P0 (Bloqueante)
* **Descrição:** Configurar arquivo `manifest.webmanifest` e estrutura básica do `index.html` para permitir instalação nativa (A2HS - *Add to Home Screen*) sem lojas de aplicativos.
* **Critérios de Aceite:**
  * `manifest.webmanifest` servido com MIME type correto e propriedades: `display: standalone`, `orientation: portrait`, `theme_color`, `background_color`.
  * Ícones adaptativos configurados nos tamanhos 192x192 e 512x512 com suporte a `maskable`.
  * Meta tags para iOS Safari (`apple-mobile-web-app-capable`, `apple-touch-icon`).

#### `[PWA-02]` Service Worker com Estratégia de Cache-First Estrita
* **Responsável:** Dev 1 | **Pontos:** 5 | **Prioridade:** P0 (Bloqueante)
* **Descrição:** Desenvolver `sw.js` com interceptação de requisições e armazenamento em cache de todos os arquivos estáticos da aplicação.
* **Critérios de Aceite:**
  * Evento `install`: executa pré-cache completo dos assets essenciais (`index.html`, `styles.css`, `app.js`, `exercises.json`, SVGs) via `caches.open('fitzero-v1')`.
  * Evento `activate`: faz o expurgo e limpeza automática de versões legadas de cache.
  * Evento `fetch`: responde via estratégia *Cache-First* imediata; se falhar, tenta rede e retorna fallback offline amigável.
  * Aplicação continua funcionando integralmente com o navegador em modo offline simulado.

#### `[PWA-03]` Gerenciador de Armazenamento Local e Exportação JSON (LGPD)
* **Responsável:** Dev 1 | **Pontos:** 3 | **Prioridade:** P1
* **Descrição:** Criar módulo utilitário `storage.js` para persistir dados de treinos completados localmente no navegador, sem telemetria externa, permitindo backup manual.
* **Critérios de Aceite:**
  * Salvar e recuperar array de histórico contendo: `data_iso`, `treino_id`, `duracao_min`, `exercicios_concluidos`.
  * Função `exportUserData()` que gera download de arquivo `historico-calistenia.json`.
  * Função `importUserData(jsonFile)` que valida schema e importa sem sobrescrever indevidamente dados existentes.
  * Zero envio de dados para servidores externos (em estrita conformidade com a LGPD).

---

### Épico 2: Interface Mobile-First, Design Tokens & Navegação
*Responsável principal: Dev 2*

#### `[UI-01]` Design Tokens e Folha de Estilos Base em CSS Puro
* **Responsável:** Dev 2 | **Pontos:** 2 | **Prioridade:** P0 (Bloqueante)
* **Descrição:** Estabelecer arquitetura CSS com variáveis personalizadas para cores, espaçamentos, tipografia fluida e suporte a tema escuro/alto contraste.
* **Critérios de Aceite:**
  * Variáveis CSS definidas para cores semânticas (`--bg-primary`, `--surface`, `--text-primary`, `--accent-teal`, `--danger`).
  * Contraste mínimo de 4.5:1 (WCAG AA) para legibilidade comprovada sob luz solar direta em áreas externas.
  * Suporte nativo à diretiva `@media (prefers-color-scheme: dark)` e classe `.high-contrast`.

#### `[UI-02]` App Shell e Bottom Navigation Responsiva
* **Responsável:** Dev 2 | **Pontos:** 3 | **Prioridade:** P0 (Bloqueante)
* **Descrição:** Implementar o layout estrutural do app com cabeçalho fixo leve e barra de navegação inferior (*Bottom Navigation Bar*) voltada para uso com uma mão só.
* **Critérios de Aceite:**
  * Três abas de navegação principais: **Treinar** (catálogo/sessão), **Histórico** (dias concluídos) e **Postura Segura** (guias).
  * Troca instantânea de abas via manipulação de classes CSS (`hidden`), sem recarregamento de página.
  * Alvos de clique de no mínimo 48x48px para facilitar o toque durante a prática de exercícios.

#### `[UI-03]` Componente de Seleção de Ambiente e Cards de Exercício
* **Responsável:** Dev 2 | **Pontos:** 3 | **Prioridade:** P1
* **Descrição:** Construir os cards visuais que listam as rotinas, contendo filtro rápido por contexto ambiental.
* **Critérios de Aceite:**
  * Toggle intuitivo: **"Quarto / Laje"** (solo, sem impacto e sem salto) vs. **"Praça / Barras"** (estrutura urbana).
  * Cards informando: nome popular, tempo estimado (ex.: 15 min), nível (iniciante/adaptado) e tag de foco muscular.
  * Abertura de gaveta lateral ou modal leve com os detalhes do exercício e vetor anatômico.

---

### Épico 3: Motor de Execução, Timers e Feedback Sensorial
*Responsável principal: Dev 3*

#### `[ENG-01]` Máquina de Estados da Sessão de Treino
* **Responsável:** Dev 3 | **Pontos:** 3 | **Prioridade:** P0 (Bloqueante)
* **Descrição:** Implementar a lógica central do treino que orquestra a transição de exercícios e descansos.
* **Critérios de Aceite:**
  * Estados suportados: `IDLE` $\rightarrow$ `PREPARING` $\rightarrow$ `WORK` $\rightarrow$ `REST` $\rightarrow$ `FINISHED`.
  * Controle de repetições por série (ex.: 3 séries de 8 a 10 reps) ou contagem regressiva por tempo (ex.: prancha 30s).
  * Ações de controle disponíveis: Pausar, Retomar, Pular Exercício e Encerrar Treino.

#### `[ENG-02]` Cronômetro Resiliente a Bloqueio de Tela (Delta Timestamp)
* **Responsável:** Dev 3 | **Pontos:** 3 | **Prioridade:** P0 (Bloqueante)
* **Descrição:** Desenvolver contador de tempo imune à suspensão/throttling de abas em segundo plano quando o usuário bloqueia o celular.
* **Critérios de Aceite:**
  * Cálculo de tempo decorrido baseado na diferença de timestamps (`Date.now() - startTime`) em vez de simples acúmulo em `setInterval`.
  * Ao desbloquear o aparelho, o relógio sincroniza instantaneamente com o tempo real transcorrido.
  * Integração opcional com `navigator.wakeLock` para manter a tela acesa durante as séries ativas (com fallback gracioso).

#### `[ENG-03]` Síntese de Áudio Nativa via Web Audio API e Vibração
* **Responsável:** Dev 3 | **Pontos:** 3 | **Prioridade:** P1
* **Descrição:** Gerar bips sonoros e vibração no aparelho para guiar o treino sem exigir o download de arquivos pesados de áudio (MP3/WAV).
* **Critérios de Aceite:**
  * Uso de `new AudioContext()` com oscilador senoidal puro (`OscillatorNode`).
  * Emissão de 3 bips curtos nos últimos 3 segundos de descanso e 1 bip prolongado no início da série.
  * Acionamento da API `navigator.vibrate([100, 50, 100])` para alertar o usuário mesmo com o aparelho guardado no bolso.

---

### Épico 4: Catálogo Biomecânico, Ativos SVG e Acessibilidade
*Responsável principal: Dev 4*

#### `[CONT-01]` Modelagem do Catálogo de Exercícios em JSON
* **Responsável:** Dev 4 | **Pontos:** 2 | **Prioridade:** P0 (Bloqueante)
* **Descrição:** Estruturar a base de dados imutável dos exercícios com linguagem direta e popular, validada por diretrizes de saúde preventiva.
* **Critérios de Aceite:**
  * Arquivo `exercises.json` contendo no mínimo 12 rotinas/variações divididas entre Solo/Casa e Praça.
  * Propriedades obrigatórias por item: `id`, `nome_popular`, `ambiente`, `regressao_segura` (ex.: flexão inclinada na parede), `pontos_atencao` (alinhamento de escápula e punho).
  * Texto claro e acessível, eliminando jargões desnecessários em inglês.

#### `[CONT-02]` Produção e Otimização de Ilustrações Vetoriais em SVG
* **Responsável:** Dev 4 | **Pontos:** 5 | **Prioridade:** P0 (Bloqueante)
* **Descrição:** Criar e compactar os vetores anatômicos para cada exercício, substituindo vídeos pesados por ilustrações leves.
* **Critérios de Aceite:**
  * Ilustrações em SVG limpo com destaque em cores distintas para: grupo muscular ativo, linha da coluna e pontos de apoio.
  * Todos os arquivos processados por pipeline `SVGO` com teto de tamanho individual $< 10\text{ KB}$.
  * Compatibilidade e renderização idêntica em Chrome, Firefox e Safari móvel.

#### `[CONT-03]` Microanimações CSS de Postura e Respiração
* **Responsável:** Dev 4 | **Pontos:** 2 | **Prioridade:** P2
* **Descrição:** Implementar animações suaves em CSS puro nos elementos do SVG para indicar ritmo de respiração e travamento postural.
* **Critérios de Aceite:**
  * Pulso suave em CSS (`keyframes`) indicando momento de inspiração e expiração.
  * Setas pontilhadas indicando o sentido correto da força (ex.: empurrar o chão para afastar os ombros das orelhas).
  * Impacto nulo no consumo de CPU em celulares com processadores de entrada.

---

## 4. Cronograma Sprint Intensivo de 1 Semana (5 Dias Úteis)

```
DIA 1 (Segunda-feira): Contratos, Scaffolding e Schemas
├── Dev 1: Repositório GitHub, App Shell HTML base e setup do Web App Manifest [PWA-01].
├── Dev 2: Variáveis CSS (Design Tokens), reset, tipografia e layout responsivo mobile [UI-01].
├── Dev 3: Máquina de estados finita da sessão em JS puro (sem acoplamento à UI) [ENG-01].
└── Dev 4: Definição do schema JSON dos exercícios e primeiros 5 SVGs otimizados via SVGO [CONT-01].

DIA 2 (Terça-feira): Módulos Funcionais Isolados
├── Dev 1: Service Worker com pré-cache estático e interceptor Cache-First [PWA-02].
├── Dev 2: Componentes de cards de exercício, abas inferiores de navegação e modal de detalhes [UI-02].
├── Dev 3: Timer delta com Date.now() resiliente a background e oscilador sonoro Web Audio API [ENG-02, ENG-03].
└── Dev 4: Conclusão dos SVGs restantes e textos curtos de biomecânica/segurança postural [CONT-02].

DIA 3 (Quarta-feira): Conexão e Primeira Montagem Completa
├── Dev 1: Integração do Storage Manager (LocalStorage com schema) e listener online/offline [PWA-03].
├── Dev 2: Conexão dos cards com o catálogo JSON de exercícios (Dev 4) e filtros Casa vs. Praça [UI-03].
├── Dev 3: Integração do timer com a UI (Dev 2), habilitando bips sonoros e vibração háptica.
└── Dev 4: Efeitos de realce postural em CSS e validação da linguagem popular nos textos [CONT-03].

DIA 4 (Quinta-feira): Testes de Bancada e Otimização Extrema
├── Dev 1: Auditoria Lighthouse (Meta: 100 em PWA/Performance) e medição do bundle (< 850 KB).
├── Dev 2: Ajustes finos de contraste para leitura sob sol forte e modo escuro nativo.
├── Dev 3: Tratamento de edge cases (recarregamento durante o treino, pausas e chamadas telefônicas).
└── Dev 4: Teste prático do fluxo completo em 2 aparelhos de entrada (2 GB RAM) em Modo Avião.

DIA 5 (Sexta-feira): Deploy, Artefatos Físicos e Fechamento
└── Time Completo (4 Devs):
    ├── Deploy em CDN estática gratuita (GitHub Pages / Cloudflare Pages com HTTPS).
    ├── Validação final: instalação do PWA em aparelhos desconectados da internet.
    ├── Geração dos cartazes lambe-lambe com QR Code apontando para o link de produção.
    └── Congelamento da release estável (Tag v1.0.0-release).
```

## 5. Critérios de Aceite para a Versão Final (DoD - Definition of Done)

1. **Zero Erros de Console:** Execução contínua sem exceptions em navegadores baseados em Chromium e WebKit móvel.
2. **Offline Total:** Após carregar a página uma vez e ativar o modo avião, todas as rotinas, timers, ilustrações SVG e sons sintéticos continuam funcionando sem falhas.
3. **Privacidade Absoluta:** Nenhuma requisição a servidores de telemetria de terceiros, sem cookies invasivos e sem qualquer formulário de login (adequação total à LGPD).
4. **Bundle Consolidado:** Todo o repositório estático servido via CDN gratuita (GitHub Pages / Vercel / Cloudflare Pages) totalizando menos de $1\text{ MB}$.