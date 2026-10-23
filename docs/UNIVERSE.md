# Bezalel Universe — versão 5 (por dentro)

Cidade 3D explorável da Bezalel em `/universe`. O visitante começa **a pé** no
parque de chegada, caminha pela cidade, **entra em carros e os dirige**, sai e
continua andando. Também há o **carro voador** da versão 1. Em volta circulam
**trânsito terrestre** e **trânsito aéreo** autônomos. A Sede, o Laboratório de
IA e o Centro de Produtos continuam sendo pontos de interesse, com painéis que
levam às páginas reais do site.

O laboratório tem atalho para o Universe na tela de entrada, no HUD do 3D e no
mapa 2D, e "Universe" está no menu principal.

A versão 3 refez a aparência sem mudar as mecânicas: arquitetura em famílias e
marcos, carros desenhados por superfícies, noite com bloom e reflexos da
própria cidade, infraestrutura de rua (asfalto, faixas, meio-fio,
estacionamentos, ponto de táxi), voadores redesenhados e um **modo
apresentação** com tomadas de cinema. Detalhes em
[Direção de arte](#direção-de-arte-e-iluminação).

A versão 4 tirou as travadas que ainda se sentiam mesmo em máquinas fortes (ver
[Fluidez](#fluidez-sem-travadas): cada uma tinha uma causa medida) e deu vida à
cidade: **som** gerado na hora (cidade, vento, motores, turbina, passos, porta,
trânsito que passa), **pedestres** nas calçadas e na praça, **faróis que
iluminam o asfalto**, **holofotes** da Sede varrendo o céu, **vento nas
árvores** e um carro voador novo (da família do táxi aéreo). A Baixa ganhou
brilho, antisserrilhado e as luzes no chão.

**Depois da versão 5** (Experience Layer):

- **Toque**: botão grande "Ver de dentro / de fora" ao lado do velocímetro (o da barra, com a tecla V, fica
  para o computador).
- **Interior refeito** nas medidas de um carro, a partir dos olhos do motorista. O painel tem duas camadas,
  friso de bronze e saídas de ar. O quadro de instrumentos fica sobre o painel (embutido sob uma coifa no
  esportivo, que é baixo), com marcas a cada 20 km/h, P R N D, modo e autonomia. A tela central é virada
  para o motorista e mostra o **mapa real da cidade** (frente para cima, os cinco locais, rumo em graus). Há
  volante de três raios com o losango da marca, bancos com abas e miolo em outro tom, portas com apoio e luz,
  e retrovisor. Cores no vértice: quatro materiais para tudo, compilados no preparo como o resto. O filete de
  luz ficou fino (o grosso "estourava" no brilho).
- **Sombras de contato** sob os carros do jogador, o trânsito, o visitante e os pedestres, em todas as
  qualidades: uma mancha macia instanciada, sem luz nem profundidade. Na Baixa, que não tem mapa de sombras, é
  ela que põe as coisas no chão.
- **Baixa mais nítida**: a resolução adaptativa voltou a subir na Baixa (o teto era o próprio valor inicial,
  de 85%: ela nunca saía dali). O teto agora é 1,15, os reflexos têm 128 px (antes 64), a anisotropia é 4 e o
  miolo da cidade tem a densidade da Média (o horizonte continua mais leve).

A versão 5 leva o visitante **para dentro**:

- **O Laboratório de IA virou um pavilhão para percorrer a pé.** É uma caixa de
  vidro de 28 × 28 m sob um disco de cobertura. Do lado da avenida (oeste),
  um pórtico de bronze tem **portas automáticas de correr** e balizas que deixam
  passar quem anda, mas não os carros. Lá dentro ficam o núcleo de vidro, as seis
  estações dos agentes com hologramas e nomes, e as faixas de luz no teto.
- **Saída do laboratório para a cidade.** No `/lab` em 3D, o portal de entrada
  ganhou uma porta de vidro com a placa "Bezalel Universe →", e a cidade à
  noite aparece do lado de fora. Na porta, o HUD oferece **"Sair para o Bezalel
  Universe"** (botão ou **E**). Isso abre `/universe?from=lab`, que entra direto
  no 3D com o visitante **na porta do Laboratório de IA da cidade**, de frente
  para a avenida e a Sede.
- **Interior dos veículos e primeira pessoa.** **V** (ou o botão do olho no
  HUD, "Ver de dentro (V)") põe a câmera no banco do motorista. A cabine tem
  bancos, volante que gira com o esterço, console, faixa de luz e **duas telas**:
  - o quadro de instrumentos mostra o **velocímetro** digital com arco,
    a marcha (P/R/D, ou o número no esportivo) e a bateria; no carro voador
    mostra a altitude e ↑/↓/H;
  - a tela central mostra a hora.

  Arrastar olha em volta; com o carro andando, o olhar volta para a frente.

## Inicialização

1. `/universe` é uma página lazy (`UniversePage.tsx`, ~19 kB comprimidos) e
   pré-renderizada. O HTML traz a tela de entrada e nenhum 3D.
2. **Explorar em 3D** (se houver WebGL) ou **Ver o mapa da cidade** (2D, sempre
   disponível). A escolha fica na sessão (`bz-universe-mode`).
3. Só ao escolher o 3D é baixada a cena (`scene/UniverseScene.tsx`, ~43 kB),
   junto com o three.js e o React Three Fiber compartilhados com o laboratório.
   São ~310 kB comprimidos no total (limite de 320 kB), conferidos por
   `npm run check:budget`.
4. **Preparo** (`scene/Warmup.tsx`), sob a tela "Preparando a cidade": o
   canvas nasce com o laço de quadros parado; o mapa de reflexos é gerado, os
   materiais compartilhados entre usos incompatíveis ganham cópias, os shaders
   são compilados em paralelo (`compileAsync` + KHR_parallel_shader_compile),
   cada programa recebe o primeiro uso um por quadro, as texturas sobem aos
   poucos e um quadro completo é desenhado escondido. Só então o jogo começa.
   Antes, o primeiro quadro compilava ~40 shaders de uma vez: 3 a 9 s de tela
   congelada no Intel Iris Xe. Agora: tela de carregamento de ~5 a 7 s na
   primeira visita (o maior bloqueio que sobra, ~1,5 s, é o filtro do mapa de
   reflexos, que o three compila de forma síncrona) e ~2 a 3 s nas seguintes
   (o navegador guarda os shaders); depois disso, o pior quadro fica entre 30
   e 46 ms.
5. Na primeira entrada aparece **Como jogar** (`bz-universe-help-v2`). Depois,
   o guia fica no botão de ajuda.
6. Se o 3D falhar (import, driver ou perda de contexto), a página avisa e cai
   no mapa 2D.

## Organização

```
features/universe/
  UniversePage.tsx        entrada, palco 3D + HUD (modo, ação, velocímetro), mapa 2D, painéis
  TouchControls.tsx       controles de toque por modo (joystick/volante, pedais, subir/descer)
  PlacePanel.tsx, UniverseMap.tsx, universe-content.ts (textos pt-BR/en)
  world/                  dados e lógica pura, sem three.js e testados
    city.ts               grade 5 × 5, distritos, edifícios, torres, passarelas, telões, sólidos, alturas do chão
    walker.ts             caminhar/correr com inércia e colisões
    vehicles.ts           três classes de carro, direção arcade, colisões, saída segura
    runtime.ts            estado do jogador (a pé → entrando → dirigindo → saindo), veículos estacionados
    traffic.ts            rotas e simulação do trânsito terrestre (passo fixo, determinística)
    air.ts                corredores e simulação do trânsito aéreo
    pedestrians.ts        rotas dos pedestres (calçadas da região principal e anéis da praça)
    cinema.ts             tomadas do modo apresentação
    flight.ts             carro voador do jogador e piloto automático
    products.ts           produtos do Centro de Produtos (rotas reais)
  scene/                  three.js / React Three Fiber (só desenha o que world/ calcula)
    UniverseScene.tsx     Canvas, céu, luzes, grupos da cena, vigias
    bloom.ts, PostFX.tsx  brilho (bloom) em textura HDR, ACES, antisserrilhado (MSAA ou FXAA) e resolução dinâmica
    shadowDepth.ts        materiais de profundidade fixos para a passada de sombras
    audio.ts, Soundscape.tsx   som gerado na hora (Web Audio) e a ligação dele com o jogo
    Pedestrians.tsx       pedestres instanciados, com o andar no shader
    lightDecals.ts        fachos dos faróis no asfalto e holofotes
    nightEnvironment.ts   cena noturna que vira o mapa de reflexos
    quality.ts            o que cada nível de qualidade muda
    Warmup.tsx            preparo antes do 1º quadro (shaders, texturas, reflexos)
    materialSplit.ts      cópias de materiais compartilhados entre usos incompatíveis
    staticMerge.ts        junta peças estáticas por material (edifícios institucionais)
    Sun.tsx               luar com sombras que acompanham a câmera
    AdaptiveResolution.tsx, PerformanceGovernor.tsx, perfState.ts   resolução adaptativa e qualidade automática
    PerfProbe.tsx         sonda de desempenho (só nos testes)
    PlayerController.tsx  teclado, mouse/toque, gamepad, câmera em 3 modos
    Avatar.tsx            o explorador (humanoide do laboratório reaproveitado)
    carDesign.ts          desenho dos 3 carros por superfícies "loft" (curvas por modelo), rodas torneadas, 3 níveis de detalhe
    carModels.ts          modelos prontos (completo, intermediário, de longe) + materiais automotivos
    airModels.ts          modelos dos 4 voadores (perto e longe)
    Vehicles.tsx          carros do jogador (esterço, rodas, faróis, lanternas de freio)
    Traffic.tsx, AirTraffic.tsx   trânsito instanciado
    Buildings.tsx, towerGeometry.ts, towerMaterial.ts   sete famílias de torres, passarelas e telões
    landmarkGeometry.ts   a Sede (marco) e o Centro de Produtos
    treeGeometry.ts       árvores (duas espécies)
    ArrivalPark.tsx       estacionamentos, baia e abrigo do ponto de táxi
    City.tsx, Landmarks.tsx, assets.ts, textures.ts
```

## A cidade

Seis linhas de rua em cada eixo (`STREET_LINES = [-180, -110, -40, 40, 110, 180]`)
formam **5 × 5 superquadras**. No centro ficam a **praça** com o monumento (o
símbolo da Bezalel), a **Sede** ao norte, o **Laboratório de IA** a leste, o
**Centro de Produtos** a oeste e o **parque de chegada** ao sul. Em volta há dois
anéis: o *midtown*, com prédios médios, e o *skyline*, com as torres altas do
horizonte.

**Hierarquia arquitetônica.**

- **Marcos (categoria A)**: a **Sede** (`landmarkGeometry.ts`) — pódio de pedra
  clara com saguão envidraçado de pé-direito duplo (recuado, com pilares,
  montantes de bronze e a parede da marca lá dentro), marquise em balanço sobre
  a área de embarque, letreiro em letras soltas sobre o pódio, torre de vidro
  champanhe que afina de 22 × 16 m para 19 × 13,5 m com aletas de bronze, uma
  **fenda de luz dourada** de alto a baixo na fachada que encara a avenida,
  lanterna de vidro aceso e o cubo da marca no topo (81 m, o mais alto da
  região). Nenhum outro prédio usa esse vidro nem essa fenda. O **Centro de
  Produtos** são galerias empilhadas e deslocadas, cada uma com um sistema de
  fachada (lojas, painéis metálicos, vitrine escura com os produtos reais,
  vidro bronze com aletas) e filetes dourados nas lajes. O **Laboratório de
  IA** mantém o salão octogonal de vidro com o núcleo dos agentes.
- **Edifícios urbanos (B)**: sete famílias (`TOWER_VARIANTS`), cada uma com
  planta (retângulo, cantos chanfrados ou redonda), sistema de fachada e
  coroamento próprios — lâmina de vidro azul com aletas e coroa de aletas;
  residencial branco em terraços com varandas e cobertura verde; monólito
  grafite com arestas de LED; torre redonda com diagrid de bronze e halo;
  comercial médio com janelas em fita e equipamentos no teto; torre
  escalonada de bronze com mastro e luzes de sinalização; lâmina corporativa
  escura com topo inclinado. Os embasamentos têm lojas (letreiros, vitrines,
  pessoas, lojas fechadas) e marquises com luz na borda. Cada torre desloca a
  textura por módulos e andares inteiros: duas da mesma família não têm as
  mesmas janelas acesas.
- **Fundo (C)**: o anel de fora (*skyline*) usa a versão econômica das mesmas
  famílias (sem aletas, varandas, diagrid nem marquises) na Média; o detalhe
  completo vai para o anel em volta da praça (a região de demonstração).

**Fachadas por sistema construtivo** (`facadeSystem` em `textures.ts`): uma
imagem cobre 24 m × 28 m (16 módulos de 1,5 m × 8 andares de 3,5 m) e as
alturas dos volumes são múltiplos de 3,5 m (testado). Vidro com montantes e
lajes opacas; concreto claro com janelas recortadas e moldura funda; pedra
grafite com janelas em fenda; painéis metálicos com janelas em fita; vidro
escuro. Os escritórios acesos são trechos contínuos de um andar (15–40%, a
Sede é a mais acesa), com luz do forro mais forte no alto, persianas em alguns
e vultos de divisórias — não um grid de quadradinhos acesos.

**Infraestrutura**: asfalto com agregado, faixas de rodagem mais escuras e
remendos; bordas brancas e eixo tracejado; faixas de pedestres nas quatro
bordas dos cruzamentos (sem se sobrepor nas quinas); meio-fio de verdade em
volta das calçadas; poças de luz dos postes no chão; no parque de chegada,
**dois estacionamentos** com vagas pintadas e batentes, a **baia do ponto de
táxi** (contorno dourado e "TAXI" no chão) e um **abrigo de embarque** com
placa acesa; na Sede, a marquise sobre a área de embarque. Árvores em duas
espécies (copa redonda e colunar), com cachos de folhagem irregulares e cor
mais escura embaixo e mais clara no alto.

Há também **passarelas** envidraçadas entre torres vizinhas e **telões** nas
esquinas do anel central, que mostram os produtos reais do site.

Tudo sai de dados: cena, mapa 2D, colisões, trânsito e corredores aéreos. Para
**cadastrar** algo:

- **Edifício institucional**: um `BuildingSpec` em `city.ts`, com os volumes de
  colisão, desenhado em `Landmarks.tsx` com as mesmas medidas.
- **Ponto de interesse**: um `PlaceSpec` em `PLACES` e o texto em
  `universe-content.ts`. O marcador, o painel, o menu Locais, o mapa 2D, o
  transporte rápido e o piloto automático passam a incluí-lo sozinhos.
- **Quadra ou distrito novo**: acrescente a linha de rua em `STREET_LINES` ou o
  distrito em `DISTRICTS`. As torres são geradas por quadra, com passo próprio
  em cada eixo.
- **Produto**: a página real do site e uma entrada em `products.ts`.

Os testes conferem que nenhum edifício, torre, telão ou passarela invade rua
ou calçada e que as torres não se sobrepõem.

## Jogador: a pé, entrar, dirigir, sair

Máquina de estados em `runtime.ts`:

```
a pé ──E perto de um veículo──▶ entrando (0,55 s) ──▶ dirigindo
  ▲                                                     │ E
  └──────── saindo (0,5 s) ◀── (freia / pousa) ◀────────┘
```

- **A pé**: WASD em relação à câmera, Shift corre. A aceleração e a
  desaceleração são suaves. O jogador colide com prédios, veículos
  estacionados e o trânsito, e respeita os limites da cidade.
- **Indicação**: perto de um veículo (dentro do comprimento + 1,4 m), o HUD
  mostra "E · Entrar: Sedã Aurora". Perto de um local, mostra "Abrir: …". O
  mesmo botão serve ao toque.
- **Entrar**: o avatar some no carro e a câmera passa da distância de
  caminhada para a de condução, com transição amortecida. O HUD troca o modo
  ("Dirigindo: …"), mostra o velocímetro e a ação "Sair do veículo".
- **Sair**: o carro freia sozinho até parar (o voador pousa). Depois, o jogador
  aparece num **ponto livre**: primeiro pelo lado do motorista (esquerdo),
  depois pelo passageiro, por trás e pela frente. Cada ponto é conferido contra
  paredes, outros veículos e o trânsito. Se nenhum estiver livre, o jogador
  continua no carro e o HUD avisa. O veículo fica no mundo, parado onde ficou.

Veículos estacionados: três no parque de chegada (um de cada modelo), o carro
voador no heliponto e mais três perto dos edifícios.

## Carros e direção

Três modelos **procedurais** com desenho próprio (`carDesign.ts`). Não é o
mesmo modelo com outra cor:

| | Sedã Aurora | Esportivo Vento | Táxi autônomo |
|---|---|---|---|
| Silhueta | capô longo, para-brisa inclinado, teto em arco | perfil baixo, cabine recuada, traseira *ducktail* | cápsula alta, estufa de vidro ampla |
| Detalhes | colunas, friso cromado, câmeras no lugar dos retrovisores | aerofólio, entradas de ar, difusor, aros de 10 raios | letreiro e lidar no teto, porta de correr, frisos dourados |
| Máx. | 115 km/h | 158 km/h | 90 km/h |

A carroceria é uma **superfície "loft"**, como no design automotivo: curvas por
modelo (topo, linha de cintura, base, ombro e arco do teto, interpoladas sem
ondular) definem uma seção transversal em cada estação ao longo do carro, e as
seções são costuradas numa pele contínua. As regiões (pintura, vidro, teto,
plásticos, faróis, lanternas) saem da posição na pele, então faróis e
lanternas são parte da carroceria, não peças coladas. Os arcos das rodas
sobem a soleira. Rodas torneadas: pneu com flanco e ombro, aro com cubo
côncavo, raios (5 duplos no sedã, 10 finos no esportivo, calota com fendas no
táxi), disco e pinça; giram com a velocidade. Extras por modelo: difusor,
entradas de ar e aerofólio (esportivo); letreiro e lidar (táxi); friso cromado
na base dos vidros, vincos das portas, maçanetas e câmeras no lugar dos
retrovisores.

Materiais: pintura com verniz (*clearcoat*) da Média para cima, vidro escuro
espelhado (reflete a noite da cidade), borracha, plástico fosco, cromo e
lanternas em HDR que acendem mais forte ao frear.

**Três níveis de detalhe**: completo (~21 mil triângulos com as rodas) no carro
em uso e nos estacionados a menos de 18 m; intermediário (~8,5 mil, a mesma
pele e os mesmos detalhes) no trânsito de perto e nos estacionados a meia
distância; de longe (~2 mil, 3 malhas). Um teste confere o orçamento de cada
nível.

**Direção** (`vehicles.ts`): estilo arcade, no padrão dos jogos de mundo
aberto, para ninguém precisar de manual:

- W acelera. S freia e, com o carro parado, engata a ré. Ao soltar tudo, o
  carro perde velocidade aos poucos.
- O esterço diminui com a velocidade e o volante volta sozinho ao centro.
- **Modelo de bicicleta**: o giro vale velocidade × tan(esterço) ÷
  entre-eixos, então o carro gira em torno do eixo traseiro e não escorrega de
  lado sem motivo.
- **Freio de mão** (Espaço): reduz a aderência e solta a traseira nas curvas
  fechadas. É o único caso de escorregamento lateral.
- **Colisões**: o carro são três círculos ao longo do comprimento. De frente,
  ele perde quase toda a velocidade; de raspão, só um pouco.
- **Controle (gamepad)**: analógico esquerdo vira; RT acelera; LT freia; A
  entra e sai; B é o freio de mão.
- **Celular**: o joystick vira volante, com pedais (acelerar, frear/ré) e
  freio de mão sob o polegar direito.

Não há motor de física: o modelo cinemático acima basta para um carro
controlável e previsível, e é testado sem navegador.

## Controles no computador

| | A pé | Carro | Carro voador |
|---|---|---|---|
| Frente / trás | W S ou ↑ ↓ | W acelera · S freia/ré (ou ↑ ↓) | W acelera · S freia |
| Virar | A D ou ← → | A D ou ← → | A D ou ← → |
| Subir / descer | — | — | **↑ ↓**, Espaço/R · C/Q |
| Extra | Shift corre | Espaço = freio de mão | Shift = turbo |
| Ação | E entra / abre | E sai | E pousa e sai |
| Câmera | — | **V** dentro/fora | **V** dentro/fora |

Em todos os modos, **M** liga e desliga o **som**, **C** abre o **modo
apresentação** (Esc sai) e **F** liga e desliga a **tela cheia**; o botão "Tela cheia"
fica ao lado de "Sair do Universe". Depois de clicar num botão do HUD, as
setas continuam indo para o jogo; o Espaço fica com o botão focado, que é como
ele se aciona pelo teclado.

## Câmera

Terceira pessoa nos três modos, sempre amortecida (sem saltos). Dentro de um
veículo, **V** alterna para a primeira pessoa (abaixo):

- **A pé**: atrás do ombro, a 6,5 m. Arrastar gira; a roda ou a pinça
  aproxima.
- **Dirigindo**: atrás do carro, a 8,6 m. A distância aumenta com a velocidade
  e o campo de visão abre até +16° em alta velocidade. Um giro manual da
  câmera volta sozinho para trás do carro.
- **Transição**: ao entrar ou sair, a câmera desliza de uma posição para a
  outra no mesmo laço.
- **Não atravessa prédios**: a câmera percorre o caminho do jogador até a
  posição desejada e para antes do primeiro volume.
- **Movimento reduzido**: sem variação do campo de visão e sem tremor nas
  batidas.

**Primeira pessoa** (V, só dentro de um veículo; vale até trocar de volta):

- **Posição dos olhos.** Vem do desenho de cada carro (`cabinOf` em
  `carDesign.ts`). O motorista senta à esquerda, então a câmera fica do lado do
  volante. Cada classe olha um pouco para baixo, na medida certa para ver o
  painel e a rua.
- **Paredes da cabine.** São a própria carroceria, desenhada pelo avesso
  (`BackSide`). Os vidros ficam de fora, então a vista pela janela é aberta. O
  carro voador não tem essa casca, porque o casco fechado taparia a vista.
- **Telas.** São canvas na CPU (`willReadFrequently`, que evita uma leitura
  de volta da GPU no envio). Só são redesenhadas quando o número mostrado muda,
  e no máximo 10 vezes por segundo.
- **Ordem do quadro.** O controle do jogador roda com prioridade −1 no
  `useFrame`, antes do desenho dos veículos. Sem isso, a câmera ficava um
  quadro à frente da carroceria e "entrava" no painel.

**Modo apresentação** (botão de claquete no HUD ou tecla **C**; **Esc** sai):
a câmera percorre a região principal em seis tomadas — travelling pela
avenida até a Sede, órbita no monumento da praça, grua subindo a fachada da
Sede até o cubo, travellings laterais no Laboratório e no Centro de Produtos e
um plano aéreo da cidade —, com aceleração e frenagem suaves, fusão para o
escuro entre elas, faixas de cinema e o nome da tomada. A interface do jogo e
os marcadores dos locais se recolhem; o jogador fica parado onde estava. Com
movimento reduzido, cada tomada vira um plano fixo e as trocas são cortes
secos. Os caminhos passam sobre ruas e a praça; um teste amostra cada tomada
contra os sólidos da cidade em todas as qualidades.

## Trânsito terrestre

`traffic.ts`: rotas descritas por dados (laços de cruzamentos na faixa da
direita, com esquinas arredondadas). São **11 rotas**: anel da praça, anel
médio e avenida de contorno nos dois sentidos, laços em frente aos três
edifícios e duas travessias de ponta a ponta. A simulação roda em **passo fixo
de 1/30 s** e é determinística.

- Os três modelos circulam com velocidades de cruzeiro diferentes por modelo
  (táxi 0,9×, esportivo 1,12×) e ±5% por motorista.
- **Seguimento**: na mesma rota, o carro mede a distância exata ao da frente
  ao longo do laço. Entre rotas diferentes, conta quem está à frente na faixa.
- **Frenagem cinemática**: a velocidade-alvo é √(2·a·d), com a = 4,5 m/s²
  (menos que a frenagem máxima de 10 m/s²). Assim o carro sempre consegue
  parar a tempo, atrás de outro ou na linha de parada.
- **Cruzamentos** são zonas exclusivas, como um semáforo implícito. A linha de
  parada fica 1,5 m antes da zona. Quem já não consegue parar ocupa a zona.
  Entre os que esperam, passa **quem chegou antes**, depois quem está mais
  perto.
- O trânsito **freia para o jogador**, a pé ou dirigindo, na faixa à frente.

Os testes simulam 10 minutos em cada qualidade: nenhum carro encosta em outro,
ninguém fica parado mais de 20 s (o máximo medido é 10,7 s, na alta) e todos
avançam.

## Trânsito aéreo

`air.ts`: **corredores sobre as avenidas**. As ruas não têm prédios, então
nenhum voo atravessa construção, e um teste confere isso amostrando cada rota
contra todos os sólidos da cidade.

- **Separação vertical por eixo**: leste-oeste a 30 m e 42 m, norte-sul a 56 m
  e 68 m. Drones de serviço voam a 15 m no anel médio. Rotas que se cruzam
  ficam a pelo menos 10 m de altura uma da outra (testado).
- Cada rota é um circuito: vai por uma avenida, faz o retorno além da borda da
  cidade e volta pela paralela. Na mesma rota, todos voam à mesma velocidade e
  igualmente espaçados.
- **Quatro classes** com modelo próprio: táxi aéreo (fuselagem em gota
  torneada, cabine envidraçada, esquis, estabilizador com placas e quatro
  rotores carenados em braços inclinados, barras de luz na frente e atrás),
  particular (fuselagem longa e achatada, bolha de cabine, asas enflechadas
  com espessura, cauda em V e dois propulsores em naceles), cargueiro
  (contêiner sob uma estrutura de quatro rotores) e drone de serviço. As luzes de navegação seguem a convenção da aviação
  (vermelha à esquerda, verde à direita, branca na cauda) e piscam. Os voadores
  inclinam nas curvas.
- A pose de cada voador é função do tempo (sem estado acumulado): é barata e
  determinística.

O jogador pilota só o carro voador da versão 1. O tipo `VehicleKind = 'air'` e
os modelos já permitem pilotar outros voadores no futuro.

## Direção de arte e iluminação

- **Paleta por área, não uma cor só**: vidro azul-esverdeado e bronze no
  horizonte, concreto claro e metal no anel da praça, grafite com LEDs
  ciano, champanhe e dourado só na Sede. O azul e o dourado da marca ficam nos
  pontos de interesse e na sinalização.
- **Noite cinematográfica legível**: céu em gradiente com o brilho da cidade
  no horizonte; névoa exponencial na cor do horizonte (profundidade
  atmosférica); luar frio como luz principal, com sombras que acompanham a
  câmera; hemisfério (céu frio por cima, rebote neutro da rua por baixo);
  contraluz quente e baixo que recorta as silhuetas.
- **Reflexos da própria cidade**: o mapa de reflexos é uma cena noturna
  (`nightEnvironment.ts`: céu, prédios com faixas de janelas acesas, luzes de
  rua), e não o estúdio do three — pintura e vidro refletem o que existe em
  volta, sem manchas de luz de estúdio.
- **Brilho (bloom) em HDR** (`bloom.ts`, da Média para cima): a cena é
  desenhada numa textura de meia precisão; o que passa do limiar (faróis,
  lanternas, LEDs, coroas, letreiros, janelas mais acesas) é reduzido e
  reampliado ("dual filter") e somado; ACES e sRGB no fim. Antisserrilhado:
  FXAA na própria passada final na Média; MSAA 4× na Alta e na Ultra.
- **Luzes com propósito**: nenhuma luz dinâmica por poste — as poças de luz no
  chão são decalques somados; a única luz pontual é a do monumento. Na Sede,
  refletores no chão "lavam" os pilares e as laterais do pódio (decalques
  verticais somados).

## Som

Tudo gerado na hora com a Web Audio API (`audio.ts`), nenhum arquivo baixado:

- **Cidade**: um rumor grave e o chiado do trânsito distante, que "respira"
  devagar. No alto ele some e dá lugar ao **vento**, que cresce com a altura
  e a velocidade.
- **Motores por modelo**: sedã e táxi são elétricos (um zumbido em duas
  harmônicas que sobe com a velocidade); o esportivo tem um ronco grave
  sintético com "marchas"; o carro voador, uma **turbina** (sopro filtrado que
  abre com o empuxo e um assobio).
- **Trânsito que passa**: o carro mais perto da câmera soa com volume pela
  distância e lado (estéreo) pela direção.
- **Passos** no ritmo da passada, **porta** ao entrar e sair, **sinal** suave
  ao abrir um local.
- **Ambientação a pé** (desde a Torre Bezalel): antes era um ruído quase parado e alto, que cansava. Agora:
  - um acorde suave em ré maior, com dois bancos de cinco notas que se alternam numa fusão lenta a cada
    ~15–21 s e um "respirar" próprio em cada nota;
  - sinos distantes e raros (pentatônica do acorde) numa reverberação sintética;
  - a cidade bem mais baixa, oscilando em ritmos que não coincidem.
  No veículo, a ambientação recua e o motor domina. Medido a pé, parado na praça
  (`scripts/audio-level-universe.mjs`): média de −23,9 para −26,1 dBFS, picos de −16,5 para −22,9. O volume
  geral desceu mais um pouco depois disso.
- **Fora da tela, silêncio**: ao trocar de app ou de aba ou bloquear a tela, o contexto de áudio é
  suspenso (`visibilitychange` e `pagehide`) e volta ao retornar. Antes, no celular, o som continuava com o
  navegador em segundo plano. Teste e2e "o som para quando a página sai da tela".
- **Elevador da Torre**: sinal na chegada e um sopro na porta.

O botão de alto-falante no HUD e a tecla **M** ligam e desligam (a escolha fica
no aparelho, `bz-universe-sound`). O som começa depois do clique de "Explorar
em 3D", como os navegadores exigem. Conferido com um medidor na saída
(`window.__bzUniverseAudio.rms()`, só nos testes): parado 0,058; dirigindo
0,073; voador subindo 0,065; no alto, em turbo, 0,081; desligado, 0,0002.

## Vida na cidade

- **Pedestres** (`pedestrians.ts`, `Pedestrians.tsx`): 24 a 96, conforme a
  qualidade, andando pelas calçadas das cinco quadras da região principal (nos
  dois sentidos, cada sentido na sua faixa, longe dos postes) e pelos anéis da
  praça, na velocidade de gente (1,1–1,6 m/s). Roupas e tons de pele variados;
  o andar (pernas e braços em oposição, o corpo subindo e descendo) é feito no
  shader, numa malha instanciada só. O jogador esbarra neles como esbarra nos
  carros. A pose é função do tempo; um teste confere que ninguém sai da
  calçada nem entra num edifício.
- **Faróis no asfalto**: cada carro do trânsito (e o carro em uso) projeta à
  frente um facho em dois lóbulos que se abrem e se fundem — uma malha
  instanciada para o trânsito inteiro, somada à imagem.
- **Holofotes da Sede**: dois fachos dourados saem da lanterna e varrem o céu
  devagar; vistos de toda a cidade.
- **Vento nas árvores**: as copas balançam, cada árvore no seu tempo, mais no
  alto da copa (no shader).
- **Carro voador novo**: um eVTOL da família do táxi aéreo, em pérola com
  frisos dourados (6 chamadas de desenho; o antigo tinha ~25).

Tudo isso para com "Pausar animações".

## Qualidade gráfica

Escolhida no HUD: **Auto** (padrão), Baixa, Média, Alta ou **Ultra**. A
escolha fica na sessão.

- **Auto** começa pelo nível do aparelho (`useDeviceProfile`: núcleos, memória,
  toque, economia de dados — critérios simples, sem teste na abertura) e se
  ajusta enquanto se joga (`PerformanceGovernor.tsx`):
  - **desce um nível** quando, mesmo com a resolução no piso, mais de 30% dos
    quadros ficam abaixo de ~45 fps por 4 s;
  - **sobe um nível** — até o Ultra, só em aparelho forte — depois de 8 s com
    quase nenhum quadro perdendo os 60 Hz, resolução no máximo e o custo real
    do quadro (CPU + GPU, medido por uma cerca `fenceSync`) abaixo de 55% do
    orçamento de 60 fps (o nível de cima custa ~1,3–1,6× o atual);
  - **período de prova**: num nível alcançado subindo, se nos primeiros 10 s
    mais de 8% dos quadros perderem os 60 Hz, volta, e esse nível vira o teto
    da sessão (não fica subindo e descendo).
- **Resolução adaptativa** (`AdaptiveResolution.tsx`), em qualquer nível: a
  meta é 60 fps **sem quadros perdidos**, qualquer que seja a tela. Desce 12%
  quando mais de 15% dos quadros atrasam (< ~45 fps) **ou** quando, por duas
  janelas de 1 s seguidas, mais de 6% perdem um quadro de 60 Hz (o engasgo que
  se sente mesmo com a média boa). Sobe 8% só com folga medida: várias janelas
  sem quadros perdidos e o custo real do quadro (cerca do `FrameCost`),
  aumentado pelo degrau, abaixo de 80% do orçamento. Se depois de subir voltar
  a perder quadros, desce e espera o dobro antes de tentar de novo. Se descer
  não melhora, o gargalo é o processador: para de descer. Com o brilho (todos
  os níveis), ela muda a **resolução interna** da cena (resolução dinâmica,
  sem realocar nada); só a superamostragem do Ultra muda o tamanho do canvas.
  A resolução em que o aparelho se firmou fica na sessão: a próxima entrada já
  começa nela.
- Num nível fixo (escolhido à mão), só a resolução se adapta; se nem assim
  der, a cena desce um nível e avisa.

| | Baixa | Média | Alta | Ultra |
|---|---|---|---|---|
| Resolução (dpr, adaptativa) | 0,6–1 | 0,7–1,25 | 0,8–1,75 | 1–2 (acima da tela) |
| Antisserrilhado | FXAA | FXAA | FXAA | MSAA 4× |
| Sombras (mapa / área / frequência) | não | 1024² / 140 m / a cada 2 quadros | 2048² / 190 m / todo quadro | 4096² / 260 m / todo quadro |
| Distância visível / névoa | 300 / 280 m | 420 / 380 m | 600 / 520 m | 750 / 650 m |
| Torres / passarelas | 76 / 0 | 156 / 10 | 176 / 10 | 176 / 10 |
| Carros / voadores | 13 / 9 | 25 / 19 | 39 / 28 | 48 / 38 |
| Carro com rodas e peças até (completo até 18 m) / voador detalhado | 28 / 40 m | 45 / 60 m | 58 / 90 m | 85 / 140 m |
| Brilho (bloom) | 3 níveis | 4 níveis | 5 níveis | 6 níveis |
| Luzes no chão (postes, faróis), holofotes da Sede | luzes no chão | sim | sim | sim |
| Pedestres | 24 | 48 | 72 (com sombra) | 96 (com sombra) |
| Detalhe das torres (aletas, varandas, diagrid, marquises) | não | anel da praça | todas | todas |
| Copas das árvores | facetadas | facetadas | subdivididas | subdivididas |
| Mapa de reflexos | 64 px | 128 px | 256 px | 256 px |
| Pintura dos carros | padrão | com verniz (*clearcoat*) | com verniz | com verniz |
| Texturas / filtragem anisotrópica | 512 px / 1× | 512 px / 4× | 1024 px / 8× | 1024 px / 16× |

Medido num notebook com **Intel Iris Xe** (gráfico integrado), 1920×1012, com
a resolução e o nível travados (`bz-universe-governor = off`), mediana de 3
janelas de 3 s. Os números variam muito com a temperatura do notebook (a mesma
versão foi de 37 a 47 fps na Alta em rodadas diferentes), por isso a versão 3
foi medida **em par** com a publicada antes dela (2.0), uma logo depois da
outra (`node scripts/bench-universe.mjs`, com `BENCH_URL` apontando para cada
build):

| | Baixa | Média | Alta | Ultra |
|---|---|---|---|---|
| 2.0 (publicada) | 68,6 fps | 55,3 fps | 45,1 fps | 39,7 fps |
| 3 | 63,7 fps | 51,4 fps | 44,1 fps | 35,2 fps |
| Triângulos na 3 (todas as passadas) | 138 mil | 218 mil | 499 mil | 611 mil |

(A Baixa foi medida numa rodada e a Média, a Alta e a Ultra noutra, cada uma em
par.) A Média e a Alta da versão 3 trazem o brilho (bloom) e a cidade nova por
−2% a −7%; a Baixa custa ~7%; a Ultra, que é para placas dedicadas, ~11% a
mais. Com a resolução adaptativa e o Auto ligados (o normal), o aparelho fica
no nível que mantém 60 fps.

Versão 4, no mesmo notebook e com o mesmo protocolo (outra rodada, não em par
com a 3 — compare com cuidado): **Baixa 83,1 fps** (já com brilho, FXAA e as
luzes no chão), **Média 66,3**, **Alta 46,2**, **Ultra 34,0**. O que importa
mais para a sensação de fluidez — os quadros longos — está em
[Fluidez](#fluidez-sem-travadas).

## Celulares fracos: o ritmo de 30 e o nível que não desce à toa

Num Redmi Note 9S real, o jogo só se firmava na Baixa. Emulado (processador 4×), dava para reproduzir:
a versão publicada começava na Média e descia para a Baixa em 20 s (`scripts/auto-quality-universe.mjs`).
Eram três causas:

1. **O Auto começava na Alta no celular.** O nível inicial era lido no primeiro render, antes de as
   consultas de mídia conhecerem a tela de toque. Agora o nível vem do perfil lido ao vivo, até o
   governador escolher outro.
2. **A meta era 45 fps ou descer.** Celular não sustenta isso na Média. Agora, num celular que atrasa a
   60, o jogo passa a desenhar **30 quadros por segundo sempre iguais** (`FramePacer`, que conduz o laço
   do R3F à mão a cada ~33 ms da tela), como os jogos de celular fazem:
   - parece mais liso que 30–45 oscilando;
   - dobra o orçamento do quadro;
   - esquenta menos o aparelho.

   Os atrasos passam a ser medidos contra esse alvo. Ele volta a 60 se o custo real couber com folga, e a
   escolha fica na sessão.
3. **Descer o nível não ajudava.** A Baixa e a Média desenham a mesma cidade e custam o mesmo ao
   processador (~37 ms por quadro emulado, nos dois). Agora o nível só desce quando o quadro espera pela
   placa de vídeo. Se baixar a resolução já não aliviou, o processador é o gargalo e o nível fica.

Resultado emulado: a Média se mantém, a 1,10× de resolução, no ritmo de 30. A placa de vídeo não é
emulada, então isso não diz quantos quadros por segundo o aparelho real fará: falta medir num celular de
verdade.

Também nesta rodada:
- o visitante passou de 16 para 5 desenhos (`HumanoidSolo`: uma malha com esqueleto por material);
- o trânsito acha o cruzamento mais próximo pela rua mais próxima em cada eixo, em vez de medir todos.

## Baixa e Média com a cidade do Ultra (aparelhos modestos)

Meta: a Baixa e a Média com a mesma cidade do Ultra, rodando num aparelho como o Redmi Note 9S
(Snapdragon 720G, Adreno 618).

**Como foi medido.** `scripts/bench-redmi.mjs` emula a tela desse celular: 2400 × 1080 a 2,75×, deitado,
com toque. O processador fica 4× mais lento (CDP), um pouco pessimista: um núcleo do 720G é ~2,7× mais
lento que o do computador de teste, pelo Geekbench de um núcleo. O quadro fica sem limite de 60 Hz, a
resolução é fixa e a medida é a mediana de 5 janelas. A placa de vídeo não é emulada, e o número não
substitui um teste no aparelho.

**Onde estava o custo.** As medições descartaram o que parecia óbvio:
- O tempo de GPU do temporizador do ANGLE marcava ~13 ms com qualquer resolução, até com nada na tela. É
  espera, não trabalho, e foi descartado como medida.
- Com o quadro solto, a resolução não muda o tempo: de 0,5 a 1,25 dá o mesmo.
- Com o processador 2× mais lento, o quadro cresce 4 ms: o resto é o motor gráfico processando as chamadas
  de desenho.
- No perfil de CPU, quase todo o quadro é o three.js desenhando (~10 de 10,6 ms). A simulação (trânsito,
  pedestres, voo, física) fica abaixo de 0,5 ms.

O gargalo é o número de chamadas de desenho, não pixels nem triângulos.

**O que mudou:**
- **Uma passada para transparentes dos dois lados.** O three desenha esses objetos duas vezes por quadro e,
  em cada uma, marca o material como alterado, o que recalcula o programa do shader. Uma armadilha no
  `version` dos materiais mostrou 11 deles (vidros, brilhos, hologramas) recalculados todo quadro.
  `forceSinglePass` (em `materialSplit.ts`) zera isso: as chamadas caíram ~20% na mesma vista.
- **Sombras em cache na Baixa e na Média.** Só o que não se move projeta sombra (torres, marcos, árvores,
  mobiliário). O mapa só é redesenhado quando o visitante se afasta um terço do alcance; entre um e outro,
  custo zero por quadro. Carros, pedestres e o visitante ficam com a sombra de contato. A Baixa passou a ter
  sombras (1024 px, 90 m) e a Média foi de 1024/70 m a 2048/115 m. A Alta e o Ultra seguem com sombras
  dinâmicas.
- **Conteúdo separado do desenho.** A cidade é a do Ultra em todo nível: densidade de torres, fachadas
  detalhadas, árvores, holofotes, trânsito, pedestres e texturas de 1024 px. Isso entra em malhas já juntas
  ou instanciadas e custa triângulos (de ~170 mil para ~440 mil na Baixa), não chamadas. Os níveis mudam o
  desenho: resolução, mapa de sombras, brilho e nitidez.
- **Menos chamadas onde não se vê diferença:**
  - o interior do Laboratório de IA (22 peças) só aparece a menos de ~60 m;
  - nos níveis de menor alcance, o carro estacionado só usa o modelo completo de bem perto;
  - a junção de peças estáticas passou a aceitar transparentes em que a ordem não importa (brilho aditivo,
    sem escrita de profundidade).
- **Nitidez adaptativa (CAS) na passada final** da Baixa, Média e Alta. Realça a borda pela vizinhança, com
  peso que cai onde o contraste já é alto, em espaço comprimido para as luzes HDR não estourarem. Recupera o
  detalhe que o FXAA e a resolução abaixo da tela tiram. Brilho com mais níveis na Baixa (3 → 4) e na
  Média (4 → 5).
- **Perfil "sem placa de vídeo".** Com WebGL por software (SwiftShader no CI), a cidade fica leve, a
  resolução fica em 0,5–0,6 e não há brilho, sombras nem poças de luz. Detectado uma vez por sessão.

**Resultado no celular emulado (processador 4× mais lento).** O ruído entre rodadas foi de ±25% por um
processo de vídeo do computador de teste em segundo plano, então os números são faixas de várias rodadas.

| Nível | Antes (cidade leve) | Depois (cidade do Ultra) |
|---|---|---|
| Baixa | 36 fps na chegada | 30–41 fps, com sombras e ~2,6× os triângulos |
| Média | 32 fps na chegada | 21–36 fps, com sombras de 2048 px e ~1,8× os triângulos |
| Ultra (referência) | — | 14–16 fps (não é para esse aparelho) |

**Limitações:**
- Não foi medido num aparelho real.
- A Adreno 618 não foi emulada: mais triângulos custam mais nela do que no computador de teste.
- A resolução adaptativa e o modo Auto continuam como rede de segurança. Se o aparelho não aguentar,
  descem a resolução e depois o nível.

## Fluidez: sem travadas

A média de fps não mostra o engasgo; ele está nos quadros longos. A versão 4
mediu o tempo de **cada quadro** (`node scripts/hitches-universe.mjs`) em cenas
de quem visita — parado, a volta inteira do modo apresentação (a câmera passa
pela cidade toda), correndo e girando a câmera, dirigindo e voando em turbo —,
com o Auto e a resolução adaptativa **ligados**, como no site (Intel Iris Xe,
1600×900, tela de 60 Hz):

| Cena | Quadros > 25 ms antes → depois | Pior quadro antes → depois |
|---|---|---|
| Parado no início | 65 de 533 (12%) → 0 de 601 | 67 → 18 ms |
| Apresentação (68 s) | 202 de 3877 (5%) → 1 de 4086 | 100 → 33 ms |
| Correndo e girando a câmera | 179 de 1709 (10%) → 9 de 1627 | 51 → 50 ms |
| Dirigindo | 30 de 1016 (3%) → 0 de 1049 | 50 → 17 ms |
| Voando em turbo | 68 de 1138 (6%) → 0 de 1208 | 50 → 18 ms |

Na Baixa, as três cenas medidas (parado, apresentação, dirigindo) ficaram sem
nenhum quadro acima de 25 ms. As causas, uma a uma:

1. **Geometria e shaders subindo em pleno jogo**: o preparo só desenhava o que
   estava na frente da câmera inicial; o resto (quadrantes de torres atrás,
   modelos de outro nível de detalhe) subia na primeira vez que aparecia — 50
   a 90 ms. Agora o preparo desenha a cidade **inteira** uma vez, num alvo de
   16×16 do mesmo tipo do destino real (tudo visível, sem descarte, conjuntos
   vazios com uma instância): os shaders saem iguais e quase não há pixels a
   pintar (sem placa de vídeo, desenhar tudo na tela cheia travaria a página).
2. **Sombras trocando de shader** (`shadowDepth.ts`): o three desenha as
   sombras com um material de profundidade compartilhado e copia nele a
   textura de cada objeto — fachadas com textura e acabamentos sem textura
   faziam o shader trocar dezenas de vezes por quadro, e a variante "com
   textura" só compilava quando uma fachada entrava na área das sombras (~80
   ms, no corte para a Sede). Cada objeto agora tem um material de
   profundidade fixo, por tipo de malha.
3. **Telões reenviando o canvas a cada 5 s**: enviar um canvas acelerado ao
   WebGL obriga o navegador a lê-lo de volta da GPU (50–80 ms). As mensagens
   viram texturas uma vez, no carregamento.
4. **A resolução voltava ao valor inicial a cada renderização da cena**: o
   Canvas reaplica o `dpr` que recebe — e recebia sempre o inicial. Com o HUD
   atualizando a cena 5× por segundo (o velocímetro), a resolução adaptativa
   era desfeita sem parar. A cena agora recebe a resolução atual.
5. **A cena inteira reconciliada pelo React a cada atualização do HUD**: a
   cena é memorizada e as funções que a página passa são estáveis.
6. **Cada troca de resolução realocava o canvas e as texturas** (~50–75 ms):
   com o brilho, a resolução muda **dentro** da textura da cena (resolução
   dinâmica) e é ampliada na passada final — sem realocar nada; e a política
   de subir e descer deixou de ir e voltar.
7. **Teste do ponteiro contra a cidade inteira**: o clique e o "passar por
   cima" dos edifícios eram testados contra a geometria detalhada a cada
   movimento do mouse (dezenas de ms ao girar a câmera arrastando). Agora são
   caixas invisíveis do tamanho de cada edifício.
8. **Quadros no limite de 16,7 ms**: −15% de chamadas de desenho (rodas
   instanciadas nos carros do jogador, peças pequenas dos carros e voadores do
   trânsito juntas, conjuntos vazios sem chamada, telões e refletores numa
   malha) e FXAA na Alta (o MSAA em meia precisão pesava ~2–3 ms num gráfico
   integrado; a resolução dinâmica deixa a imagem nítida).

## Otimizações

Cada uma foi medida antes de entrar (`PerfProbe`: chamadas de desenho,
triângulos, tempo de CPU e de GPU do quadro):

- **Preparo antes do primeiro quadro** (ver Inicialização): sem a trava de
  vários segundos na entrada.
- **Materiais sem alternância de shader** (`materialSplit.ts`): 19 materiais
  eram compartilhados entre malhas instanciadas e comuns (ou com e sem
  sombra); o three recalculava o programa a cada alternância — quase metade
  do tempo de CPU do quadro. Cada combinação de uso ganha uma cópia (as
  texturas são as mesmas). A sonda confere que não sobra nenhum conflito.
- **Níveis de detalhe (LOD)**: carros em três níveis (completo, intermediário
  e de longe — ver Carros); voadores em dois. O trânsito usa o intermediário
  de perto: a primeira versão da carroceria nova usava o completo (~21 mil
  triângulos) até 70 m, e o trânsito somava ~200 mil triângulos por quadro.
  O carro em uso é sempre o completo. Há margem na fronteira, para não trocar
  de modelo de um quadro para outro.
- **Detalhe por importância**: as torres do horizonte usam a versão econômica
  das famílias na Média; as do anel da praça, a completa. As torres e os
  acabamentos (aletas, cornijas, LEDs) levam a cor no vértice: um quadrante
  inteiro cabe em ~10 chamadas de desenho.
- **Sombras só onde aparecem**: meio-fio, troncos e vidros dos carros do
  trânsito saíram da passada de sombras.
- **Antisserrilhado sob medida**: com o brilho, o MSAA na textura de meia
  precisão custava ~2–3 ms na Média do Iris Xe; ali ele virou FXAA na passada
  final (medido: 49 → 55 fps sem o brilho mudar).
- **Menos chamadas de desenho** (cada uma custa ~23 µs de CPU no Iris Xe,
  pelo Direct3D): torres juntadas por quadrante e material (os quadrantes
  fora da visão não são desenhados), passarelas numa malha por material,
  peças estáticas dos edifícios institucionais juntadas (`staticMerge.ts`; as
  animadas e as clicáveis continuam separadas).
- **Chão desenhado de cima para baixo**: praça e jardins, calçadas,
  cruzamentos, ruas e terreno, depois de prédios e veículos; o teste de
  profundidade descarta os pixels cobertos antes de calcular o material deles.
- **Sombras que acompanham a câmera** (`Sun.tsx`): a área cobre o que está à
  frente da câmera, com o centro encaixado na grade de texels (as bordas não
  tremem ao andar). Com o mesmo mapa, as sombras ficaram 2,5–3× mais nítidas,
  e a Média ganhou sombras das torres e dos carros.
- **Sem lixo por quadro**: os corpos de colisão do trânsito são reaproveitados.
- **Shaders sem consulta de log no site publicado** (`checkShaderErrors`
  desligado fora do desenvolvimento).
- Mantidas da fase anterior: instanciamento, simulação em passo fixo separada
  do desenho, HUD lido 5× por segundo, desmontagem completa ao sair e nenhuma
  imagem baixada (todas as texturas são desenhadas em canvas).

## Recursos externos

**Nenhum.** Todos os modelos (carros, voadores, edifícios, árvores e o avatar)
são procedurais, feitos com geometrias do three.js, e todas as texturas são
desenhadas em canvas. Nenhum modelo ou textura de terceiros foi incorporado, e
não há questão de licença além das bibliotecas já usadas pelo site (three.js e
React Three Fiber, licença MIT).

Na versão 3, modelos glTF profissionais foram avaliados para os carros e os
marcos e **não** foram usados: o projeto não tem acervo licenciado, modelos de
terceiros não teriam a identidade própria da Bezalel pedida para veículos e
edifícios, e o orçamento de download do 3D (320 kB comprimidos, hoje em
310 kB) não comporta carros glTF texturizados. A diferença esperada: um carro
modelado à mão num programa de modelagem teria superfícies esculpidas, vincos
e interiores que o loft procedural não alcança.

## Executar e testar

```bash
npm run dev                  # http://localhost:5173/site_bezalel/universe/
npm run check                # tipos, lint, testes de unidade e build
npm run build:pages && npm run test:e2e   # navegador (inclui auditoria axe)
npm run check:budget         # tamanhos
node scripts/bench-universe.mjs   # fps, chamadas e triângulos por nível (com o build servido)
node scripts/profile-universe.mjs high   # custo de cada parte da cena (liga e desliga grupos)
node scripts/hitches-universe.mjs auto   # engasgos: tempo de cada quadro em cenas reais, com o Auto ligado
node scripts/shots-universe.mjs <pasta> high   # capturas sempre dos mesmos ângulos (vistas, carros, voadores, tomadas)
```

- **Unidade** (`tests/unit/universe.test.ts`, 48 testes, os de qualidade nos
  quatro níveis): pedestres (só calçadas e praça, fora dos edifícios,
  determinísticos, velocidade de gente), arquitetura (sete famílias, andares inteiros, geometria
  válida, a Sede como marco mais alto e colisão com as medidas desenhadas),
  modo apresentação (nenhuma tomada atravessa prédio, ordem, fusão, movimento
  reduzido), orçamento de triângulos dos carros por nível, cidade (grade,
  nenhuma invasão de rua, torres sem sobreposição, densidade por qualidade,
  passarelas), produtos e textos, trânsito terrestre (determinismo, modelos e
  velocidades, 10 minutos sem colisão por qualidade, frear para o jogador),
  trânsito aéreo (nenhuma rota atravessa edifício, separação vertical, quatro
  classes, quantidade por qualidade), direção (aceleração, freio e ré, virar,
  freio de mão, parede, saída segura), a pé (inércia, correr, colisões),
  entrar e sair e voo.
- **Navegador** (`tests/e2e/smoke.spec.ts`): atalho do laboratório; andar →
  perto do carro → entrar → acelerar, virar, frear → sair num lugar livre →
  carro continua lá → andar de novo; painel de um local pelo teclado; troca de
  qualidade (o canvas é recriado); sair sem deixar laço de quadros ativo;
  celular (aviso de girar, joystick, volante, pedais, acelerador move o carro);
  modo apresentação (botão e tecla C recolhem o HUD, a câmera anda, o jogador
  não, Esc sai); som (botão e tecla M, a escolha fica guardada).
  `a11y.spec.ts` audita o mapa, o HUD e o painel nos dois temas.

Nos testes de navegador, `localStorage['bz-universe-debug'] = '1'` expõe
`window.__bzUniverse` (ler o estado, posicionar o jogador ou um veículo, fixar
a câmera, ler e congelar os voadores, parar o modo apresentação num instante),
`window.__bzUniverseGl` (sonda de desempenho: contagens, tempos de quadro,
ligar e desligar partes da cena, materiais em conflito) e
`window.__bzUniversePerf` (leituras do governador). Com
`localStorage['bz-universe-governor'] = 'off'`, a resolução e o nível ficam
fixos (para medir). Só existem com essas chaves.

## Limitações conhecidas

- **Desempenho medido só num computador**: os números acima são de um
  notebook com Intel Iris Xe. Falta medir num celular intermediário e numa
  placa de vídeo dedicada (onde o Auto deveria chegar ao Ultra).
- **Preparo na primeira visita**: o filtro do mapa de reflexos ainda bloqueia
  a página por ~1,5 s (o three o compila de forma síncrona), sob a tela de
  carregamento.
- **Desenho por partes no preparo**: testado e descartado — com partes
  escondidas o three cria outras variantes de shader (36 → 63 programas).
- **Modelos procedurais têm teto**: as silhuetas, os materiais e as luzes são
  próprios e coerentes, mas não há superfícies esculpidas, interiores nem
  texturas pintadas; as janelas são textura (com aletas, varandas e cornijas
  de verdade só onde há detalhe). Ir além exige modelos feitos num programa de
  modelagem (glTF), com licença e orçamento de download próprios.
- **Interiores**: só os veículos do jogador e o Laboratório de IA têm interior. A
  Sede e o Centro de Produtos continuam fechados. A cabine é estilizada: os
  bancos e o painel são volumes simples, sem costuras nem botões, e a bateria
  mostrada é fixa por carro.
- **Saída do `/lab`**: a cidade vista pela porta do laboratório é um painel
  pintado, não o Universe de verdade. A passagem é uma troca de página, e a
  cidade carrega em seguida.
- **Pedestres simples**: corpo estilizado, sem rosto nem cabelo; seguem a rota
  e não desviam de quem cruza o caminho (o jogador esbarra neles); não
  atravessam a rua nem entram nos prédios.
- **Som sintetizado**: convincente como ambiente, mas não é gravação de
  verdade (sem buzinas, sirenes nem vozes); um carro do trânsito soa de cada
  vez.
- **Ultra**: ~11% mais pesada que a da versão 2 no Iris Xe (pensada para placas
  dedicadas, onde não foi medida).
- **Colisão simplificada**: volumes retangulares e círculos. Árvores, postes e
  marquises não são sólidos.
- **Trânsito**: sem semáforos visíveis (os cruzamentos são zonas invisíveis),
  sem troca de faixa e sem ultrapassagem. Os carros do trânsito freiam para o
  jogador, mas não desviam.
- **Pilotar outros voadores**: fora desta fase (só o carro voador do jogador).
- **Tela cheia**: os avisos (toasts) do site não aparecem nela.

## Próximos passos

A arquitetura recomendada, os gargalos medidos e a ordem de implementação estão em
[UNIVERSE-FOUNDATION.md](UNIVERSE-FOUNDATION.md).


1. Medir o FPS em aparelhos reais e ajustar os níveis de qualidade com base
   nessas medidas.
2. Modelos glTF próprios (encomendados ou modelados) para os carros e as
   torres-marco, com LOD.
3. Semáforos visíveis ligados às zonas de cruzamento e troca de faixa.
4. Interiores: saguão da Sede e do Centro de Produtos (o do Laboratório existe desde a versão 5).
5. Pilotar táxis aéreos usando os corredores existentes.
6. Ciclo dia/noite suave e reflexos de chão molhado na qualidade alta.
