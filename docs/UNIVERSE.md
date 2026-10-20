# Bezalel Universe — versão 2.0

Cidade 3D explorável da Bezalel em `/universe`. O visitante começa **a pé** no
parque de chegada, caminha pela cidade, **entra em carros e os dirige**, sai e
continua andando. Também há o **carro voador** da versão 1. Em volta circulam
**trânsito terrestre** e **trânsito aéreo** autônomos. A Sede, o Laboratório de
IA e o Centro de Produtos continuam sendo pontos de interesse, com painéis que
levam às páginas reais do site.

O laboratório tem atalho para o Universe na tela de entrada, no HUD do 3D e no
mapa 2D, e "Universe" está no menu principal.

## Inicialização

1. `/universe` é uma página lazy (`UniversePage.tsx`, ~19 kB comprimidos) e
   pré-renderizada. O HTML traz a tela de entrada e nenhum 3D.
2. **Explorar em 3D** (se houver WebGL) ou **Ver o mapa da cidade** (2D, sempre
   disponível). A escolha fica na sessão (`bz-universe-mode`).
3. Só ao escolher o 3D é baixada a cena (`scene/UniverseScene.tsx`, ~29 kB),
   junto com o three.js e o React Three Fiber compartilhados com o laboratório.
   São ~293 kB comprimidos no total, conferidos por `npm run check:budget`.
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
    flight.ts             carro voador do jogador e piloto automático
    products.ts           produtos do Centro de Produtos (rotas reais)
  scene/                  three.js / React Three Fiber (só desenha o que world/ calcula)
    UniverseScene.tsx     Canvas, céu, luzes, grupos da cena, vigias
    quality.ts            o que cada nível de qualidade muda
    Warmup.tsx            preparo antes do 1º quadro (shaders, texturas, reflexos)
    materialSplit.ts      cópias de materiais compartilhados entre usos incompatíveis
    staticMerge.ts        junta peças estáticas por material (edifícios institucionais)
    Sun.tsx               luar com sombras que acompanham a câmera
    AdaptiveResolution.tsx, PerformanceGovernor.tsx, perfState.ts   resolução adaptativa e qualidade automática
    PerfProbe.tsx         sonda de desempenho (só nos testes)
    PlayerController.tsx  teclado, mouse/toque, gamepad, câmera em 3 modos
    Avatar.tsx            o explorador (humanoide do laboratório reaproveitado)
    carModels.ts          modelos procedurais dos 3 carros (perto e longe) + materiais automotivos
    airModels.ts          modelos dos 4 voadores (perto e longe)
    Vehicles.tsx          carros do jogador (esterço, rodas, faróis, lanternas de freio)
    Traffic.tsx, AirTraffic.tsx   trânsito instanciado
    Buildings.tsx, towerGeometry.ts   torres, passarelas e telões
    City.tsx, Landmarks.tsx, assets.ts, textures.ts
```

## A cidade

Seis linhas de rua em cada eixo (`STREET_LINES = [-180, -110, -40, 40, 110, 180]`)
formam **5 × 5 superquadras**. No centro ficam a **praça** com o monumento (o
símbolo da Bezalel), a **Sede** ao norte, o **Laboratório de IA** a leste, o
**Centro de Produtos** a oeste e o **parque de chegada** ao sul. Em volta há dois
anéis: o *midtown*, com prédios médios, e o *skyline*, com as torres altas do
horizonte.

**Torres compostas** (`TOWER_VARIANTS`) em seis linguagens arquitetônicas, cada
uma com silhueta própria: torre de vidro com aletas, escalonada, lâmina
residencial, corporativa alta com heliponto, edifício médio com terraço e o
"marco do horizonte". Cada uma tem pódio, corpo com aletas ou faixas de laje,
recuos e coroamento (antena, heliponto, equipamentos, jardim ou agulha), além
de faixa de LED em algumas. Há também **passarelas** envidraçadas entre torres
vizinhas e **telões** nas esquinas do anel central, que mostram os produtos
reais do site.

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

Três modelos **procedurais** com desenho próprio (`carModels.ts`). Não é o
mesmo modelo com outra cor:

| | Sedã Aurora | Esportivo Vento | Táxi autônomo |
|---|---|---|---|
| Silhueta | capô longo, para-brisa inclinado, teto em arco | perfil baixo, cabine recuada, traseira *ducktail* | cápsula alta, estufa de vidro ampla |
| Detalhes | colunas, friso cromado, câmeras no lugar dos retrovisores | aerofólio, entradas de ar, difusor, aros de 10 raios | letreiro e lidar no teto, porta de correr, frisos dourados |
| Máx. | 115 km/h | 158 km/h | 90 km/h |

A carroceria é um perfil lateral extrudado com chanfro, com arcos de roda
recortados. Faróis, lanternas e para-choques são montados na **superfície real**
da carroceria, calculada a partir do perfil (`surfaceZ`), porque o chanfro
incha o perfil e números fixos deixariam as peças enterradas na pintura. Os
pneus têm ombros arredondados. Materiais: pintura com verniz (*clearcoat*) nas
qualidades média e alta, vidro escurecido, borracha, cromo e lanternas que acendem mais
forte ao frear.

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
- **Quatro classes** com modelo próprio: táxi aéreo (cápsula envidraçada com
  quatro rotores carenados), particular (fuselagem em cunha, asas curtas, dois
  propulsores), cargueiro (contêiner sob uma estrutura de quatro rotores) e
  drone de serviço. As luzes de navegação seguem a convenção da aviação
  (vermelha à esquerda, verde à direita, branca na cauda) e piscam. Os voadores
  inclinam nas curvas.
- A pose de cada voador é função do tempo (sem estado acumulado): é barata e
  determinística.

O jogador pilota só o carro voador da versão 1. O tipo `VehicleKind = 'air'` e
os modelos já permitem pilotar outros voadores no futuro.

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
| Modelo detalhado até (carro / voador) | 28 / 40 m | 45 / 60 m | 70 / 90 m | 110 / 140 m |
| Mapa de reflexos | 64 px | 128 px | 256 px | 256 px |
| Pintura dos carros | padrão | com verniz (*clearcoat*) | com verniz | com verniz |
| Texturas / filtragem anisotrópica | 512 px / 1× | 512 px / 4× | 1024 px / 8× | 1024 px / 16× |

Medido num notebook com **Intel Iris Xe** (gráfico integrado), 1920×1012, com
a resolução travada em 1× (sem a adaptação), mediana de 3 janelas:

| | Baixa | Média | Alta | Ultra |
|---|---|---|---|---|
| Antes desta rodada | ~55 fps | ~41 fps (+ trava de 8,7 s) | ~26 fps | — |
| Agora | 93 fps (p95 12 ms) | 76 fps (p95 16 ms) | 64 fps (p95 19 ms) | 49 fps (p95 25 ms) |
| Chamadas de desenho | 208 | 215 | 325 | 341 |
| Triângulos | 69 mil | 129 mil | 210 mil | 324 mil |

Nesse notebook o Auto fica na Alta, a 60 fps sem perder quadros: o custo do
quadro (~16–20 ms, a GPU é o gargalo) não deixa folga para o Ultra, que é para
placas de vídeo dedicadas. Num aparelho muito lento (renderização por software,
~1 fps), o Auto baixa a resolução e desce Alta → Média → Baixa. Os números
variam com a temperatura do notebook (o processador reduz a frequência); por
isso as comparações foram feitas em pares.

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
- **Níveis de detalhe (LOD)**: carros e voadores do trânsito e os carros
  estacionados do jogador têm um modelo de longe — o mesmo perfil sem o
  chanfro e com poucas divisões, rodas paradas, tudo junto em 3 malhas
  (pintura, resto com cor por vértice, luzes). Carro de perto: 5,6 mil
  triângulos (as rodas eram 60% e ficaram mais leves); de longe: ~700. O
  carro em uso é sempre o detalhado. Há uma margem de 12% na fronteira, para
  não trocar de modelo de um quadro para outro.
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
  do desenho, HUD lido 5× por segundo, desmontagem completa ao sair, nenhum
  pós-processamento e nenhuma imagem baixada.

## Recursos externos

**Nenhum.** Todos os modelos (carros, voadores, edifícios e o avatar) são
procedurais, feitos com geometrias do three.js, e todas as texturas são
desenhadas em canvas. Nenhum modelo ou textura de terceiros foi incorporado, e
não há questão de licença além das bibliotecas já usadas pelo site (three.js e
React Three Fiber, licença MIT).

## Executar e testar

```bash
npm run dev                  # http://localhost:5173/site_bezalel/universe/
npm run check                # tipos, lint, testes de unidade e build
npm run build:pages && npm run test:e2e   # navegador (inclui auditoria axe)
npm run check:budget         # tamanhos
node scripts/bench-universe.mjs   # fps, chamadas e triângulos por nível (com o build servido)
```

- **Unidade** (`tests/unit/universe.test.ts`, 40 testes, os de qualidade nos
  quatro níveis): cidade (grade,
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
  celular (aviso de girar, joystick, volante, pedais, acelerador move o carro).
  `a11y.spec.ts` audita o mapa, o HUD e o painel nos dois temas.

Nos testes de navegador, `localStorage['bz-universe-debug'] = '1'` expõe
`window.__bzUniverse` (ler o estado e posicionar o jogador ou um veículo),
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
- **Modelos procedurais não equivalem a modelos AAA**: as silhuetas, os
  materiais e as luzes são próprios e coerentes, mas não há superfícies
  esculpidas, interiores detalhados nem texturas pintadas. Chegar a esse nível
  exige modelos feitos num programa de modelagem (glTF), com licença própria.
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
