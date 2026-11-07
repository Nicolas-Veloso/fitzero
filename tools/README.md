# tools/ — conteúdo do FitZero (Dev 4)

Nada desta pasta vai para o app: ela serve só para gerar e validar o conteúdo.
Requer Node 18+.

```bash
cd tools
npm install          # instala o SVGO (fica em tools/node_modules, ignorado pelo git)
npm run build:svg    # svg-poses.mjs -> SVGO -> ../assets/svg/<id>.svg
npm run validate     # confere catálogo, SVGs, pré-cache do SW e orçamento do bundle
```

## Como adicionar um exercício
1. Acrescente o objeto em `../exercises.json` (campos obrigatórios: `id`, `nome_popular`, `ambiente`
   [`casa` | `praca`], `nivel`, `tempo_estimado_min`, `foco_muscular`, `series_recomendadas`,
   `regressao_segura`, `pontos_atencao`).
2. `series_recomendadas` precisa seguir o formato que o motor de treino lê, por exemplo
   `3 séries de 8 a 12 repetições` ou `3 séries de 20 a 30 segundos`.
3. Crie a pose com o mesmo `id` em `svg-poses.mjs` e rode `npm run build:svg`.
   Cada pose tem duas posições: **A** (início) e **B** (fim, no sentido da seta). O boneco vai de A para B
   e volta em um ciclo de 6 s (constante `CICLO`).
4. Inclua `./assets/svg/<id>.svg` no `PRECACHE_ASSETS` do `../sw.js` (e aumente a versão do cache).
5. Rode `npm run validate`.

O `foco_muscular` alimenta os filtros do app (Superior / Inferior / Core) por palavra-chave:
use termos como peito, ombros, costas, tríceps, coxas, glúteos, pernas, abdômen, lombar.

## Linguagem visual dos SVGs
| Cor | Significado |
| :-- | :-- |
| `--accent` (pulsa) | músculo ativo |
| `--accent-teal` | linha da coluna e guia de alinhamento tracejado |
| `--warning` | pontos de apoio |
| `--border-strong` | chão, barra, banco, parede |
| seta tracejada | sentido da força |
| anel que expande e recolhe | ritmo da respiração (inspira / solta o ar) |

O movimento do boneco é animação SVG nativa (SMIL) dentro de cada arquivo; o app pausa essa animação
quando o aparelho pede movimento reduzido. O pulso, o anel de respiração e a guia de alinhamento ficam
em `styles.css` (só `opacity` e `transform`) e também respeitam `prefers-reduced-motion`.

## Arquivos-fonte editáveis (Inkscape)
`npm run build:fonte` gera `tools/fontes-inkscape/<id>.svg`: o mesmo desenho (posição inicial) com
camadas nomeadas (`vetor-corpo`, `alinhamento-coluna`, `musculo-ativo` ou `escapula-ativa`, `pontos-apoio`,
`seta-forca`, `anel-respiracao`, `estrutura-ambiente`), caminhos com nós editáveis e cores reais.
Servem para abrir e ajustar no Inkscape; o arquivo que vai para o app continua sendo `assets/svg/<id>.svg`.

## Atenção: versão do cache
O Service Worker responde primeiro pelo cache (cache-first). **Sempre que mudar qualquer arquivo pré-cacheado**
(`app.js`, `styles.css`, `exercises.json`, `assets/svg/*`...), aumente `CACHE_NAME` em `sw.js`
(`fitzero-v3` -> `fitzero-v4`). Sem isso, quem já abriu o app continua vendo os arquivos antigos.
Durante o desenvolvimento, em F12 > Application > Service Workers, marque **Update on reload**.
