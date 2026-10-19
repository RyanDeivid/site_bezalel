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
3. Só ao escolher o 3D é baixada a cena (`scene/UniverseScene.tsx`, ~23 kB),
   junto com o three.js e o React Three Fiber compartilhados com o laboratório.
   São ~286 kB comprimidos no total, conferidos por `npm run check:budget`.
4. Na primeira entrada aparece **Como jogar** (`bz-universe-help-v2`). Depois,
   o guia fica no botão de ajuda.
5. Se o 3D falhar (import, driver ou perda de contexto), a página avisa e cai
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
    UniverseScene.tsx     Canvas, céu, luzes e sombras por qualidade, vigias de desempenho
    quality.ts            o que cada nível de qualidade muda
    PlayerController.tsx  teclado, mouse/toque, gamepad, câmera em 3 modos
    Avatar.tsx            o explorador (humanoide do laboratório reaproveitado)
    carModels.ts          modelos procedurais dos 3 carros + materiais automotivos
    airModels.ts          modelos dos 4 voadores
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

Escolhida no HUD (Baixa / Média / Alta) e guardada na sessão. A seleção
automática usa o nível do aparelho (`useDeviceProfile`: núcleos, memória,
toque, economia de dados), sem teste de desempenho na abertura. Se a média ou
a alta ficar abaixo de ~28 fps por alguns segundos, a cena desce um nível e
avisa.

| | Baixa | Média | Alta |
|---|---|---|---|
| Resolução (dpr) | 0,85 | 1–1,25 | 1–1,75 |
| Antisserrilhado | não | sim | sim |
| Sombras | não | 1024² | 2048² (torres também projetam) |
| Distância visível / névoa | 300 / 280 m | 420 / 380 m | 600 / 520 m |
| Torres / passarelas | 76 / 0 | 156 / 10 | 176 / 10 |
| Carros / voadores | 13 / 9 | 25 / 19 | 39 / 28 |
| Pintura dos carros | padrão | com verniz (*clearcoat*) | com verniz (*clearcoat*) |
| Texturas | 512 px | 512 px | 1024 px |

Trocar a qualidade recria o canvas, descartando e recriando os recursos da GPU.

## Otimizações

- **Instanciamento**: torres (por parte e material), carros e voadores do
  trânsito, árvores, postes e aletas.
- **Geometrias e materiais compartilhados**: os modelos dos carros são
  construídos uma vez e servem ao trânsito e aos carros do jogador. As peças de
  cada material são mescladas numa geometria só.
- **Simulação separada do desenho**: o trânsito roda em passo fixo e a cena
  interpola entre os passos. O HUD lê o estado 5× por segundo, não a cada
  quadro.
- **Desmontagem**: sair do Universe desmonta o canvas, o laço de quadros para,
  o gancho de testes é removido e geometrias e materiais são descartados
  (testado no navegador).
- **Sem pós-processamento**: sem *bloom* e sem *motion blur*. Nenhuma imagem é
  baixada; as texturas são desenhadas em canvas.

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
```

- **Unidade** (`tests/unit/universe.test.ts`, 36 testes): cidade (grade,
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
`window.__bzUniverse` (ler o estado e posicionar o jogador ou um veículo). Só
existe com essa chave.

## Limitações conhecidas

- **Desempenho real não medido**: os testes usam WebGL por software
  (SwiftShader), que não diz nada sobre FPS em aparelho real. Falta medir num
  celular intermediário e num computador modesto.
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
