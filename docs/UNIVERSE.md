# Bezalel Universe — Fase 1

Primeira área explorável do universo 3D da Bezalel: uma praça futurista com a
**Sede**, o **Laboratório de IA** e o **Centro de Produtos**, ruas com trânsito
terrestre e um **carro voador** que o visitante pilota. Rota: `/universe`.

## Como a experiência é inicializada

1. `/universe` é uma página lazy (`features/universe/UniversePage.tsx`,
   ~13 kB), pré-renderizada como as outras: o HTML traz a tela de entrada e
   nenhum 3D.
2. A tela de entrada oferece **Pilotar em 3D** (se houver WebGL) ou **Ver o mapa
   da cidade** (2D, sempre disponível). A escolha fica na sessão
   (`bz-universe-mode`).
3. Só ao escolher o 3D é baixada a cena (`scene/UniverseScene.tsx`) junto com o
   motor 3D: cerca de **250 kB comprimidos** no total, compartilhados com o
   laboratório (three.js, React Three Fiber e as texturas em canvas).
4. Na primeira entrada aparece a orientação **Como pilotar**
   (`bz-universe-help-v1` no localStorage). Depois ela fica no botão
   **Controles**.
5. Se o 3D falhar (erro de import, driver, perda do contexto WebGL), a página
   avisa e cai no mapa 2D, sem tela vazia (`SceneBoundary` + `ContextLossWatcher`).

## Organização

```
features/universe/
  UniversePage.tsx        página: entrada, palco 3D + HUD, mapa 2D, painéis
  PlacePanel.tsx          conteúdo de um local (o mesmo no 3D e no 2D)
  UniverseMap.tsx         planta em SVG gerada dos dados da cidade
  universe-content.ts     textos pt-BR/en (no chunk da página)
  world/                  dados e lógica pura — sem three.js, testados
    city.ts               grade de ruas, quadras, edifícios, locais, torres, colisões
    traffic.ts            rotas e simulação do trânsito (passo fixo, determinística)
    flight.ts             voo do carro, colisões, piloto automático
    products.ts           produtos do Centro de Produtos (rotas reais)
    runtime.ts            estado mutável compartilhado (carro, teclas, câmera)
  scene/                  three.js / React Three Fiber
    UniverseScene.tsx     Canvas, céu, luzes, sombras, vigias de desempenho
    assets.ts             materiais e texturas compartilhados (descartados ao sair)
    textures.ts           texturas desenhadas em canvas (nenhuma imagem baixada)
    City.tsx              chão, ruas, cruzamentos, quadras, praça, árvores, postes, torres
    Landmarks.tsx         Sede, Laboratório, Centro de Produtos, monumento, marcadores
    Traffic.tsx           veículos instanciados
    Craft.tsx             carro voador, câmera de perseguição, entrada, proximidade
```

### A cidade

Grade de superquadras: quatro linhas de rua em cada eixo
(`STREET_LINES = [-110, -40, 40, 110]`) formam 3 × 3 quadras. A central é a
**praça** (piso em anéis, espelho d'água e o **monumento**: o símbolo da
Bezalel como um cubo equilibrado num vértice, com as três faces da marca no
alto). Norte: **Sede** (pódio, saguão, letreiro, torre com aletas de bronze e o
mesmo cubo na coroa). Leste: **Laboratório de IA** (salão octogonal de vidro,
treliça girando e seis colunas, uma por agente do site). Oeste: **Centro de
Produtos** (galerias empilhadas e um painel com os produtos reais). Sul:
**parque de chegada**, onde o voo começa. Os cantos e o anel externo têm torres
sem interação, geradas de forma determinística.

### Cadastrar um edifício ou local

- **Edifício**: acrescente um `BuildingSpec` em `world/city.ts` (centro,
  fachada, `solids` = volumes de colisão) e desenhe-o em `scene/Landmarks.tsx`
  com as mesmas medidas. Os testes conferem que nenhum volume invade rua ou
  calçada.
- **Ponto de interesse**: acrescente um `PlaceSpec` em `PLACES` (heliponto,
  direção de chegada, altitude, alcance) e o texto em `universe-content.ts`
  (`places`). Marcador, painel, menu Locais, mapa 2D e piloto automático passam
  a incluí-lo sozinhos; um teste confere que o piloto automático chega lá sem
  bater, partindo de qualquer outro local.
- **Produto**: crie a página (rota + `meta` no i18n) e acrescente uma entrada em
  `world/products.ts`. Nome e descrição vêm dos metadados da própria página;
  um teste confere que a rota existe. Nada de produto inventado.

## Controles

Câmera em **terceira pessoa**, atrás do carro. A escolha (em vez da primeira
pessoa) mostra o carro e a arquitetura em volta, não dá enjoo em quem gira a
câmera e funciona igual com mouse e toque.

| Ação | Teclado | Mouse / toque |
|---|---|---|
| Acelerar / frear e dar ré | W, S ou ↑, ↓ | joystick para cima / baixo |
| Virar | A, D ou ←, → | joystick para os lados |
| Subir / descer | Espaço ou R / C ou F | botões Subir / Descer |
| Turbo | Shift | botão Turbo |
| Entrar no local próximo | E | botão "Entrar" que aparece no HUD |
| Voltar ao início | H | botão "Voltar ao início" |
| Olhar em volta / aproximar | — | arrastar / roda ou pinça |
| Abrir um edifício | — | clicar ou tocar nele |

Quem não quer pilotar usa **Locais**: escolhe um destino e o **piloto
automático** leva o carro até lá (sobe acima do que houver no caminho, segue
reto e desce no heliponto). Qualquer comando manual devolve o controle. Com
**movimento reduzido**, o piloto automático leva direto ao destino e o trânsito
fica parado.

**Celular**: botão de **tela cheia** (o palco ocupa a tela, sem o cabeçalho do
site). Com o celular em pé, o palco sugere deitar o aparelho e oferece "Tela
cheia na horizontal", que também trava a orientação onde o navegador permite
(Chrome do Android). O aviso não bloqueia: "Continuar assim" o dispensa. Onde
não há tela cheia de elementos (Safari do iPhone), o botão não aparece.

Colisões: o carro é uma esfera de 2,2 m. Ele não entra em nenhum volume da
cidade: sai pela face mais próxima ou pousa no telhado se vier de cima. Há
chão, teto (90 m) e limite lateral. A câmera também não entra em prédios:
sobe acima do telhado.

## Trânsito

Rotas descritas por dados (`ROUTES` em `world/traffic.ts`): sequências de
cruzamentos que viram laços na faixa da direita, com esquinas arredondadas.
A simulação roda em **passo fixo de 1/30 s**, independente da taxa de quadros,
e é **determinística**. A cena interpola entre os passos e desenha todos os
veículos com 4 `InstancedMesh`.

Regras sem física:
- quem está na mesma rota segue o da frente pela distância ao longo do laço;
- de rotas diferentes, quem está à frente na trajetória conta como obstáculo;
- cada cruzamento é uma **zona exclusiva** (um semáforo implícito): só entra
  quem está mais perto, com desempate por id, e quem já está dentro não espera
  por quem ficou retido na linha de parada.

Os testes rodam 10 minutos simulados nos dois níveis de qualidade e conferem:
nenhuma sobreposição, ninguém parado por mais de 20 s e todos andando.

**Veículos voadores** já cabem no modelo (`kind: 'air'` e `altitude` em
`RouteSpec`). Nesta fase só há rotas terrestres, e o voo é o do visitante.

## Qualidade gráfica

| | Alta | Baixa |
|---|---|---|
| Resolução | até 1,75× (dpr) | 1× |
| Antisserrilhado | sim | não |
| Sombras | sim (luar, PCF, 2048²) | não |
| Texturas | 512–1024 px | 256–512 px |
| Torres no horizonte | 80 | 40 |
| Árvores / postes | densos | metade |
| Veículos | 22 | 8 |

- **Ponto de partida**: aparelho forte começa na alta; os demais, na baixa.
- **Troca**: o botão de qualidade no HUD troca a qualquer momento, e a escolha
  fica na sessão.
- **Rebaixamento automático**: se a alta ficar abaixo de ~28 fps por alguns
  segundos, a cena muda para a baixa e avisa.
- **Pausar animações**: congela o trânsito e as animações ambientes.
- **Custo**: trocar a qualidade recria o canvas, descartando e recriando todos
  os recursos da GPU de forma previsível. Objetos repetidos (ruas,
  cruzamentos, árvores, postes, torres, veículos, aletas) são instanciados;
  quadras e calçadas são geometrias mescladas. Não há pós-processamento.

## Reaproveitado do projeto

- **Do laboratório, extraído para `components/three/`**: mapa de reflexos
  (`EnvironmentMap`), vigias de desempenho e de perda de contexto
  (`watchers.tsx`), `SceneBoundary` e o joystick de toque, agora genérico. O
  laboratório passou a usar esses módulos, com o mesmo comportamento.
- **Também do laboratório**: `makeCanvasTexture`, `drawLabel` e
  `makeGlowTexture` (texturas em canvas); o padrão de câmera amortecida, de
  arraste/pinça e de "estado mutável fora do React" do `Player`;
  `STATION_ORDER` (as seis colunas do Laboratório de IA são os seis agentes do
  site).
- **Do site**: `hasWebGL`/`useDeviceProfile` (detecção e nível do aparelho),
  `Dialog` (painéis e orientação), tokens de cor da marca, i18n, `curated()`
  (contagem real de cursos), `demoAgents` (nomes e funções no painel do
  laboratório).

## Executar, testar e publicar

```bash
npm run dev                  # http://localhost:5173/site_bezalel/universe/
npm run check                # tipos, lint, testes de unidade e build
npm run build:pages && npm run test:e2e   # navegador (inclui auditoria axe)
npm run check:budget         # tamanhos (UniverseScene, UniversePage, textures)
```

- **Testes de unidade** (`tests/unit/universe.test.ts`): planta da cidade,
  produtos ligados a rotas reais, determinismo e segurança do trânsito,
  colisões e limites do voo, e piloto automático entre todos os locais.
- **Testes de navegador** (`tests/e2e/smoke.spec.ts`, `a11y.spec.ts`): mapa 2D,
  entrada no 3D com a orientação, abertura de um local pelo teclado com o link
  para o laboratório, aviso de girar no celular, e axe na entrada, no mapa, no
  HUD e no painel, nos dois temas.
- **Publicação**: igual ao resto do site. Avançar a `main` dispara o deploy no
  GitHub Pages; `/universe` é pré-renderizada e entra no sitemap.

## Limitações conhecidas

- **Desempenho real não medido**: os testes rodam com WebGL por software
  (SwiftShader), que é lento e não diz nada sobre FPS em aparelho real. Ainda
  falta medir em um celular intermediário e em um computador modesto: abrir
  `/universe`, entrar no 3D e observar se o rebaixamento automático dispara.
- **Colisão simplificada**: volumes retangulares. Árvores, postes, marquises e
  pórticos não são sólidos, e o carro pode passar por eles em voo baixo.
- **Trânsito sem pedestres**: carros não reagem ao carro do visitante, e não há
  semáforos visíveis (as zonas de cruzamento são invisíveis).
- **Fora do HUD na tela cheia**: os avisos (toasts) do site não aparecem; os
  painéis aparecem normalmente.
- **Fora desta fase**: interiores dos edifícios, avatares, multiplayer,
  veículos voadores no trânsito e espaços de parceiros.
