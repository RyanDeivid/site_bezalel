# Bezalel Universe — versão 3 (direção de arte)

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
    cinema.ts             tomadas do modo apresentação
    flight.ts             carro voador do jogador e piloto automático
    products.ts           produtos do Centro de Produtos (rotas reais)
  scene/                  three.js / React Three Fiber (só desenha o que world/ calcula)
    UniverseScene.tsx     Canvas, céu, luzes, grupos da cena, vigias
    bloom.ts, PostFX.tsx  brilho (bloom) em textura HDR, ACES e antisserrilhado (MSAA ou FXAA)
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

Em todos os modos, **F** liga e desliga a **tela cheia**; o botão "Tela cheia"
fica ao lado de "Sair do Universe". Depois de clicar num botão do HUD, as
setas continuam indo para o jogo; o Espaço fica com o botão focado, que é como
ele se aciona pelo teclado.

## Câmera

Terceira pessoa nos três modos, sempre amortecida (sem saltos):

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
  meta é 60 fps, qualquer que seja a tela (em 120/144 Hz, perseguir a taxa da
  tela sacrificaria nitidez sem necessidade). Mais de 15% de quadros abaixo de
  ~45 fps → desce a resolução 12%; 4 s sem perder quadros → sobe 8% e testa.
  Se descer não melhora, o gargalo é o processador: ela para de descer. Ela
  sempre cede antes de trocar de nível (trocar de nível recria a cena).
- Num nível fixo (escolhido à mão), só a resolução se adapta; se nem assim
  der, a cena desce um nível e avisa.

| | Baixa | Média | Alta | Ultra |
|---|---|---|---|---|
| Resolução (dpr, adaptativa) | 0,6–1 | 0,7–1,25 | 0,8–1,75 | 1–2 (acima da tela) |
| Antisserrilhado | não | sim | sim | sim |
| Sombras (mapa / área / frequência) | não | 1024² / 140 m / a cada 2 quadros | 2048² / 190 m / todo quadro | 4096² / 260 m / todo quadro |
| Distância visível / névoa | 300 / 280 m | 420 / 380 m | 600 / 520 m | 750 / 650 m |
| Torres / passarelas | 76 / 0 | 156 / 10 | 176 / 10 | 176 / 10 |
| Carros / voadores | 13 / 9 | 25 / 19 | 39 / 28 | 48 / 38 |
| Carro com rodas e peças até (completo até 18 m) / voador detalhado | 28 / 40 m | 45 / 60 m | 58 / 90 m | 85 / 140 m |
| Brilho (bloom) / antisserrilhado | — / — | 4 níveis / FXAA | 5 níveis / MSAA 4× | 6 níveis / MSAA 4× |
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
node scripts/shots-universe.mjs <pasta> high   # capturas sempre dos mesmos ângulos (vistas, carros, voadores, tomadas)
```

- **Unidade** (`tests/unit/universe.test.ts`, 46 testes, os de qualidade nos
  quatro níveis): arquitetura (sete famílias, andares inteiros, geometria
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
  não, Esc sai).
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
- **Laboratório de IA**: mantido da versão 2 (não foi redesenhado nesta fase).
- **Ultra**: ~11% mais pesada que a da versão 2 no Iris Xe (pensada para placas
  dedicadas, onde não foi medida).
- **Colisão simplificada**: volumes retangulares e círculos. Árvores, postes e
  marquises não são sólidos.
- **Trânsito**: sem semáforos visíveis (os cruzamentos são zonas invisíveis),
  sem troca de faixa e sem ultrapassagem. Os carros do trânsito freiam para o
  jogador, mas não desviam.
- **Pedestres**: não há (por decisão de escopo: nada de multidões genéricas).
- **Pilotar outros voadores**: fora desta fase (só o carro voador do jogador).
- **Tela cheia**: os avisos (toasts) do site não aparecem nela.

## Próximos passos

1. Medir o FPS em aparelhos reais e ajustar os níveis de qualidade com base
   nessas medidas.
2. Modelos glTF próprios (encomendados ou modelados) para os carros e as
   torres-marco, com LOD.
3. Semáforos visíveis ligados às zonas de cruzamento e troca de faixa.
4. Interiores: saguão da Sede e salão do Laboratório.
5. Pilotar táxis aéreos usando os corredores existentes.
6. Ciclo dia/noite suave e reflexos de chão molhado na qualidade alta.
