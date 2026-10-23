# Bezalel Universe — fundação da próxima geração

Diagnóstico da implementação atual, gargalos comprovados, metodologia de
medição e a arquitetura recomendada para elevar a qualidade visual, a
profundidade de interação e a compatibilidade sem perder estabilidade.

Data: 23/10/2026 · base: `main` em `ae7df97`.

**Como ler.** Cada afirmação é marcada:
- **[fato]**: verificado no código ou medido, com a referência;
- **[medido]**: número de um teste executado aqui, com o ambiente;
- **[emulado]**: medido com emulação; não vale como aparelho real;
- **[estimativa]**;
- **[recomendação]**.

---

## 1. Diagnóstico da implementação atual

### 1.1 Mapa do código **[fato]**

São ~12 mil linhas em `src/features/universe/`, em três camadas:

| Camada | Onde | O que é |
|---|---|---|
| Mundo (puro, sem three.js) | `world/` | Cidade e sólidos (`city.ts`), carro (`vehicles.ts`), voo (`flight.ts`), pedestre-jogador (`walker.ts`), trânsito (`traffic.ts`), aéreo (`air.ts`), pedestres (`pedestrians.ts`), apresentação (`cinema.ts`), estado do jogador (`runtime.ts`) |
| Cena (three.js + React Three Fiber) | `scene/` | Geometria procedural (torres, carros, marcos, árvores, interiores), materiais, luz, sombras, brilho, preparo, sondas de desempenho |
| Página (React) | `UniversePage.tsx`, `TouchControls.tsx`, `UniverseMap.tsx` | Interface, teclado e toque, mapa 2D, governo da qualidade |

O mundo é **puro e testado**: `tests/unit/universe.test.ts` tem 49 testes de colisão, trânsito, voo, saída do
veículo e entrada no laboratório. Esse é o maior ativo da arquitetura.

### 1.2 Funcionalidades

**Completas (verificadas por teste ou captura):**
- andar, correr, entrar e sair de veículos;
- carros de três classes com suspensão e esterço;
- carro voador com piloto automático;
- câmera em terceira e primeira pessoa (cabine com painel e mapa);
- trânsito terrestre (passo fixo de 1/30 s) e aéreo (função do tempo);
- pedestres;
- modo apresentação;
- som procedural;
- teclado, toque e gamepad (`readGamepad` em `PlayerController.tsx`);
- mapa 2D com links reais;
- Laboratório de IA percorrível;
- porta `/lab` ↔ Universe;
- quatro níveis de qualidade com Auto e resolução adaptativa.

**Incompletas:**
- pedestres não desviam de quem cruza o caminho;
- o trânsito não troca de faixa;
- semáforos invisíveis (zonas);
- Sede e Centro de Produtos sem interior;
- outros voadores não são pilotáveis;
- só um personagem (o robô do laboratório);
- avisos não aparecem em tela cheia.

**Só na documentação ou desatualizadas:**
- `docs/UNIVERSE.md` → "Próximos passos" item 4 cita "o salão do Laboratório" como futuro, mas ele existe
  desde a versão 5;
- a seção de desempenho fala em medir em aparelhos reais: nunca foi feito.

### 1.3 Veículos, movimento, câmera, colisões e controles **[fato]**

- **Física em funções puras** (`stepCar`, `stepCraft`, `stepWalker`), com colisão por caixas alinhadas
  (`Solid`) e círculos (`Body`).
- **Quem avança a física é o laço de desenho.** `PlayerController.tsx` (linha 183) chama
  `updatePlayer`/`stepWalker`/`stepCar`/`stepCraft` dentro de `useFrame`, com `dt` variável limitado a
  50 ms. O trânsito tem acumulador de passo fixo, mas também dentro do componente de desenho
  (`Traffic.tsx`).
  - Consequência medida: num navegador lento (CI sem GPU), o jogo anda em câmera lenta. Foi o que derrubou
    o teste de dirigir.
  - O resultado depende da taxa de quadros: dois clientes não simulam igual.
- **Câmera** em `PlayerController.tsx`:
  - terceira pessoa amortecida, que não atravessa prédios;
  - primeira pessoa;
  - prioridade −1 no `useFrame`, para a câmera e o veículo atualizarem antes do desenho.
- **Estado do jogador** (`world/runtime.ts`): um objeto mutável único que mistura simulação (walker,
  vehicles), entrada (keys, joystick, buttons), câmera, interface (notice, sounds, near) e dados que a cena
  escreve de volta (`traffic`: corpos do trânsito e dos pedestres, numa ordem de montagem implícita, ver o
  comentário "Depois do trânsito" em `UniverseScene.tsx`). Supõe **um jogador** (`walker` único, `active`
  único).

### 1.4 Luz, sombras, materiais e pós-processamento **[fato]**

- **Luz:**
  - hemisfério, ambiente e luar (`Sun.tsx`), com sombras que acompanham a câmera e se encaixam na grade
    de texels;
  - contraluz quente;
  - mapa de reflexos gerado da própria cidade noturna (`nightEnvironment.ts`, PMREM);
  - poças de luz em decalques aditivos (`lightDecals.ts`), sem luzes dinâmicas.
- **Sombras:**
  - dinâmicas na Alta e no Ultra;
  - em cache na Baixa e na Média: só estáticos projetam, e o mapa só é redesenhado quando o visitante se
    afasta;
  - sombra de contato instanciada para tudo que se move (`contactShadow.ts`).
- **Materiais:**
  - `MeshStandard`/`MeshPhysical`;
  - fachadas com janelas em textura de canvas;
  - vento nas copas e passada dos pedestres no shader;
  - divisão de materiais por uso (`materialSplit.ts`), para o three não recalcular programas.
- **Pós-processamento** (`bloom.ts`, próprio, sem biblioteca):
  - cena em textura HDR e brilho em cascata;
  - FXAA com nitidez adaptativa (CAS), ou MSAA no Ultra;
  - resolução dinâmica interna.

### 1.5 Carregamento, descarregamento e memória **[fato + medido]**

- **Tudo é procedural**: nenhum modelo nem textura é baixado. O 3D é um chunk sob demanda
  (`UniverseScene`: ~57 kB, ~328 kB com o three.js).
- **O preparo** (`Warmup.tsx`) compila os shaders em paralelo, sobe as texturas aos poucos e desenha a
  cidade inteira escondida antes do primeiro quadro.
- **A cidade inteira é criada de uma vez** na montagem: não há carregamento por região.
- **Descarregamento:** 81 `dispose()` nos componentes da cena.
- **[medido]** 5 ciclos entrar-no-3D/voltar-ao-2D (`scripts/leak-universe.mjs`, Média, Iris Xe):
  - 330 geometrias, 87 texturas e 43 programas em todo ciclo: a cena libera o que cria;
  - heap de JS depois de sair entre 43 e 61 MB, sem crescimento contínuo (5 ciclos é pouco para descartar
    uma retenção pequena).
- **Falha de contexto da GPU** (`ContextLossWatcher`): volta para o mapa 2D com um aviso; o estado do
  jogador fica na página.
  - **[medido]** voltar ao 3D leva 0,55–1,0 s com o cache de shaders quente, e a posição é mantida.
  - Não há restauração automática: o visitante precisa tocar em "Explorar em 3D".

### 1.6 Otimizações que já existem **[fato]**

- Peças estáticas juntadas por material (`staticMerge.ts`).
- Torres juntadas por quadrante e por slot.
- Trânsito, aéreo, pedestres, árvores e rodas instanciados, com níveis de detalhe (perto/meio/longe).
- Divisão de materiais por uso e uma passada para transparentes dos dois lados.
- Sombras em cache na Baixa e na Média.
- Preparo completo antes do primeiro quadro.
- Resolução adaptativa com histerese e resolução firmada por sessão (`AdaptiveResolution.tsx`,
  `perfState.ts`).
- Governo Auto que sobe e desce o nível (`PerformanceGovernor.tsx`).
- Telas em canvas redesenhadas só quando o conteúdo muda.
- Interior do laboratório só de perto.
- Perfil sem placa de vídeo (CI).
- Conteúdo separado do desenho: a cidade do Ultra em todo nível.

### 1.7 Problemas arquiteturais que travam a evolução **[fato]**

1. **Trocar de nível reconstrói o mundo inteiro.** O `Canvas` tem `key={quality}` (`UniverseScene.tsx`).
   - **[medido]** No Ultra, a descida automática no meio de uma corrida a pé zerou e recriou programas
     (0 → 44), texturas (8 → 87) e geometrias (0 → 330): um quadro de 733 ms e ~2 s de engasgos
     (`hitches-universe.mjs ultra walk`, duas rodadas iguais).
   - **[emulado]** No celular emulado, a Média desceu para a Baixa no meio da cena: um quadro de 2,5 s.
   - Como o conteúdo agora é o mesmo em todo nível, a troca poderia ser no lugar.
2. **A simulação é dirigida pelo desenho** (1.3): impede passo determinístico, reprodução e rede.
3. **Estado único e mutável, misturando papéis** (1.3): não há a noção de entidade nem de "jogadores".
4. **Contrato implícito de ordem entre componentes:** a lista `runtime.traffic` é zerada pelo trânsito e
   completada pelos pedestres, e depende da ordem de montagem.
5. **Cidade monolítica:** tudo é criado de uma vez, sem regiões. Não escala para uma cidade maior nem para
   interiores grandes.
6. **Só procedural:** não há caminho para modelos artísticos (glTF), nem orçamento e licença para eles.

---

## 2. Gargalos comprovados

| # | Gargalo | Evidência |
|---|---|---|
| G1 | **Chamadas de desenho (CPU + driver)**, não pixels | **[medido]** Quadro sem limite de 60 Hz: dpr 0,5 e 1,25 custam o mesmo (~10–11 ms). Processador 2× mais lento → +4,3 ms. Perfil de CPU: ~10 de 10,6 ms dentro do `render` do three.js. Simulação < 0,5 ms. |
| G2 | **Trocar de nível reconstrói tudo** | **[medido]** 733 ms (Ultra, Iris Xe); **[emulado]** 2,5 s (Média → Baixa) |
| G3 | **Sombras dinâmicas na Alta e no Ultra** | **[medido]** Alta/Ultra parados: 3–37 de ~350 quadros acima de 33 ms; Baixa/Média (cache): 0–2 |
| G4 | **Simulação presa à taxa de quadros** | **[fato]** `dt` variável no `useFrame`; o teste de dirigir falhou no CI por câmera lenta |
| G5 | Temporizador de GPU do ANGLE não mede trabalho | **[medido]** ~13 ms com qualquer resolução, até sem nada na tela: não usar como métrica |

---

## 3. Metodologia de medição (reproduzível)

**Ferramentas** (todas com `npm run build && node scripts/serve-dist.ts` antes):

| Script | O que mede |
|---|---|
| `scripts/bench-universe.mjs [desktop\|redmi] [níveis] [--solto]` | Por nível: inicialização (página, cena montada, pronta); bytes transferidos; por cena (parado, a pé, dirigindo, voando, apresentação), a mediana, p95 e pior quadro e os quadros acima de 33 ms; chamadas, triângulos, texturas, programas e heap; recuperação após a perda do contexto da GPU. Grava JSON em `bench-results/` (fora do git). |
| `scripts/bench-redmi.mjs` | Custo do quadro sem limite, na tela do Redmi e com processador 4× mais lento (mediana de 5 janelas) |
| `scripts/hitches-universe.mjs` | Cada quadro, tarefas longas e trocas de resolução, programas e texturas (acha travadas e reconstruções) |
| `scripts/leak-universe.mjs` | Recursos vivos e heap em 5 ciclos 3D ↔ 2D |
| `PW_ARGS="--use-angle=swiftshader --enable-unsafe-swiftshader" npx playwright test -g "Universe 3D"` | Reproduz o CI (sem placa de vídeo) |

**Protocolo:**
1. Notebook na tomada.
2. Aquecer o cache de shaders com uma rodada descartada.
3. Rodar duas vezes e alternar versões ao comparar.
4. Registrar o aparelho e o navegador (o JSON guarda o `userAgent`).

O ruído medido aqui foi de ±25% por um processo de vídeo USB em segundo plano.

**Aparelhos testados nesta fase:**
- **real:** um notebook com Intel Iris Xe, Windows 11 e Edge 13x, na tomada;
- **emulado:** a tela e o processador de um Redmi Note 9S.

**Nenhum celular real foi testado.** Para testar no aparelho:
- conecte o celular por USB com depuração ativa;
- abra `chrome://inspect` e, com o site servido na rede local, use a aba Performance;
- ou rode o `bench-universe.mjs` contra o aparelho com `chromium.connectOverCDP` (via `adb forward`).

### Resultados **[medido]**: notebook Iris Xe, vsync ligado, 1600 × 900

| Nível | Pronta (após clicar) | Parado: mediana / p95 | A pé / dirigindo / voando: quadros > 33 ms | Chamadas | Triângulos |
|---|---|---|---|---|---|
| Baixa | 4,9 s | 16,7 / 16,8 ms | 0 / 0 / 0 | 139–219 | 381–471 mil |
| Média | 3,8 s | 16,7 / 16,9 ms | 2 / 0 / 0 | 152–228 | 399–482 mil |
| Alta | 4,7 s | 16,7 / 17,1 ms | 28 / 6 / 3 | 208–306 | 507–642 mil |
| Ultra | 3,2 s | 17,0 / 33,5 ms | 42 / 2 / 4 (e uma reconstrução de 766 ms) | 238–317 | 546–705 mil |

- Transferência: 347 kB para a página. O 3D já vem pré-carregado (zero bytes ao entrar).
- Recuperação: cai no 2D e volta em 0,8–1,0 s, com a posição mantida.

### Resultados **[emulado]**: tela do Redmi Note 9S, processador 4×, vsync ligado

| Nível | Mediana | Quadros > 33 ms | Observação |
|---|---|---|---|
| Baixa | 33,3 ms (~30 fps) | 30–40% | estável a ~30 fps, com variação |
| Média | 33,4 ms | 35–45% | o Auto desceu para a Baixa no meio da cena (quadro de 2,5 s; G2) |

A placa de vídeo não é emulada: a Adreno 618 é várias vezes mais fraca que a Iris Xe. **[estimativa]** No
aparelho real, a GPU pode virar o gargalo com 400–480 mil triângulos e sombras.

---

## 4. Arquitetura de ativos

**O que continua procedural [recomendação]** (vantagem: zero download, variação infinita, coerência de estilo):
- a cidade (torres por variantes, ruas, mobiliário, árvores);
- o trânsito em massa;
- o céu, a iluminação e as janelas;
- os interiores modulares.

**O que se beneficia de modelos artísticos (glTF)** (onde o olhar se detém e a geometria procedural tem
teto):
- os veículos do jogador (carroceria esculpida, interior);
- os marcos (Sede, Laboratório, Centro de Produtos) e os personagens;
- props de destaque.

**Pipeline proposto:**

1. **Fonte:**
   - modelos próprios ou encomendados;
   - de terceiros, só com licença compatível (CC0, CC-BY com crédito, ou comercial com direito de
     redistribuição na web).
   - Cada ativo terá um registro em `assets/LICENSES.md`: origem, autor, licença, data e prova.
2. **Conversão:**
   - glTF 2.0 binário (`.glb`);
   - geometria com `EXT_meshopt_compression` (decodificador ~20 kB, mais rápido que o Draco);
   - texturas em **KTX2/Basis** (`KHR_texture_basisu`): o UASTC para normais, o ETC1S para cor.
   - Sobem comprimidas para a placa (BC, ETC ou ASTC conforme o aparelho), de 4× a 8× menos memória de
     vídeo que o PNG.
   - Ferramenta: `gltf-transform` (`optimize`, `meshopt`, `ktx2`) num script de build. Não é dependência
     de execução.
3. **LOD:**
   - 3 níveis por modelo (`LOD0` perto, `LOD1` com ~30% dos triângulos, `LOD2` impostor ou o atual
     procedural "longe");
   - gerados com `gltf-transform simplify`;
   - o "longe" atual dos carros já é um LOD2 procedural.
4. **Reuso:**
   - materiais compartilhados por catálogo (os slots atuais: pintura, vidro, cromo, luzes);
   - instancing para o que se repete;
   - `BatchedMesh` para variedade com uma chamada só (ver 5).
5. **Carregamento progressivo:**
   - primeiro o procedural (a cidade inteira, como hoje);
   - os modelos glTF por região, perto do visitante;
   - o procedural fica no lugar até o glTF chegar, sem buraco nem tela de espera.
6. **Descarregamento:** cada região libera geometrias, texturas e materiais ao sair do raio, com o
   `dispose` centralizado num gerenciador de recursos (contagem de referências).
7. **Orçamentos** **[recomendação]**, que entram em `check-budget.ts`:

| Ativo | Download (comprimido) | Triângulos LOD0 | Texturas |
|---|---|---|---|
| Veículo do jogador | ≤ 400 kB | ≤ 60 mil | 2 × 1024² KTX2 |
| Marco | ≤ 1,5 MB | ≤ 150 mil | 4 × 2048² KTX2 |
| Personagem | ≤ 600 kB | ≤ 25 mil | 2 × 1024² KTX2 |
| Total por região | ≤ 4 MB | — | ≤ 64 MB de memória de vídeo |

**Dependências:**
- `GLTFLoader`, `KTX2Loader` e `MeshoptDecoder` já vêm com o three.js (`three/addons`), sem pacote novo;
- só o transcodificador Basis (~200 kB wasm), servido como ativo próprio e baixado só quando o primeiro
  KTX2 for pedido.

Nada disso foi adicionado nesta fase.

---

## 5. Renderização adaptativa

**Proposta [recomendação], por ordem de impacto comprovado:**

1. **Trocar de nível no lugar (resolve G2).** Tirar o `key={quality}` do `Canvas`.
   - Resolução, mapa de sombras, brilho e nitidez mudam ao vivo; a cidade não, porque já é a mesma.
   - O tamanho do mapa de sombras exige recriar só o alvo da luz.
   - O MSAA do Ultra exige recriar só o alvo do brilho.
2. **`BatchedMesh` com `WEBGL_multi_draw` — testado e descartado (24/10/2026).** Torres em lotes por material
   (42 → ~10 chamadas, descarte por torre): o quadro ficou mais lento, porque cada vértice passa a ler a matriz
   de uma textura e a GPU vira o gargalo (`uniformMatrix4fv` bloqueando 3,5 ms por quadro no perfil). Voadores
   em lotes (até 40 → 7 chamadas): igual ao instanciado num A/B alternado. Para geometria estática, a malha
   juntada com a posição já aplicada é o mais barato para a GPU. **O que funcionou:** os carros estacionados
   longe e fora de uso entram nos conjuntos instanciados do trânsito (−8% de chamadas na chegada, sem custo na
   GPU). **Próximo passo para menos chamadas:** menos materiais — um atlas de texturas para os letreiros e painéis
   dos marcos e cores por vértice nos hologramas e colunas, para juntá-los.
   Texto original da recomendação, mantido como registro: **`BatchedMesh` com `WEBGL_multi_draw` (ataca G1).**
   - Marcos, mobiliário, carros estacionados e placas: muitos objetos diferentes numa chamada, com
     frustum culling por objeto.
   - **[medido]** A extensão existe aqui. **[estimativa]** Está no Chrome para Android recente.
   - Meta **[estimativa]**: de 140–230 para menos de 100 chamadas.
3. **Sombras em cache também na Alta (G3)**, com os dinâmicos por cima no mapa só perto. Ou em cascatas:
   uma estática grande, em cache, e uma dinâmica pequena, perto da câmera.
4. **HLOD por quadra:** de longe, cada quadra vira uma malha só e muito simples (já quase é, pela junção
   por quadrante); de perto, as peças.
5. **Regiões:**
   - a cidade em células (as quadras de `blockBounds` já são a grade);
   - criar e liberar o conteúdo detalhado por raio do visitante;
   - simulação de trânsito e pedestres longe em frequência baixa ou suspensa (eles já são funções do
     tempo: retomam sem salto).
6. **Oclusão:** não agora. Com a cidade em grade e a neblina, o frustum culling por quadra e o HLOD rendem
   mais. Uma oclusão por consulta (`occlusion query`) só se o perfil mostrar o fill como gargalo.
7. **Memória:** orçamento por região (seção 4); ler `renderer.info.memory` na sonda e descer o raio das
   regiões se passar.
8. **Redução gradual antes de trocar de nível:** o Auto tira primeiro o mais caro e menos notado (raio das
   sombras dinâmicas, níveis do brilho, resolução), e só então troca de nível (no lugar, item 1).

**WebGPU × WebGL 2:**

| Critério | WebGL 2 (atual) | WebGPU |
|---|---|---|
| Compatibilidade | Universal (inclui Android antigo e Safari) | Chrome/Edge desktop e Android 12+; Safari recente. **[fato]** Disponível neste Edge (Intel gen-12lp). Firefox ainda parcial. |
| Maturidade no three.js 0.186 | Estável; tudo do Universe roda nele | `WebGPURenderer` funcional, com shaders em TSL. Os shaders próprios (GLSL em `onBeforeCompile`/`ShaderMaterial`: brilho, céu, fachadas, vento, pedestres, decalques, sombras de contato) **precisariam ser reescritos** em TSL. |
| Desempenho | G1 é CPU/driver: `BatchedMesh` + multi_draw já reduz | Menor custo por chamada e *compute* (culling e partículas na GPU). **Não medido aqui.** |
| Recomendação | **Manter como rota principal** | Avaliar com um protótipo isolado (o brilho e uma cena de teste), medindo o mesmo `bench-universe.mjs`. Migrar só com ganho comprovado e mantendo o WebGL 2 como rota de compatibilidade (o `WebGPURenderer` tem *fallback* para WebGL 2, mas com os shaders TSL). |

---

## 6. Preparação para personagens

**Hoje [fato]:** o visitante é o `Humanoid` do laboratório (`features/lab/scene/robots/humanoid.ts`), um
esqueleto procedural com a pose calculada de poucos números, desenhado por instâncias. Não há esqueleto
glTF, animação por clipes nem personalização.

**Requisitos [recomendação]:**
- **Um esqueleto de referência** compartilhado por humanos e robôs humanoides (nomes de ossos do padrão
  Mixamo/humanoid do VRM). As animações podem ser compartilhadas; robôs não humanoides têm esqueleto próprio.
- **Animação:**
  - clipes glTF com `AnimationMixer` (andar, correr, entrar no carro, acenar);
  - camadas: corpo inteiro e parte de cima;
  - o procedural atual vira um "clip" gerado, com a mesma interface.
- **Peças modulares** por encaixe (`slot`): cabeça, cabelo, tronco, pernas, calçado, acessórios. Cada peça
  é um glTF *skinned* no mesmo esqueleto, e as cores são parâmetros do material, não texturas novas.
- **LOD de personagem:** perto, o *skinned* completo; longe, o instanciado atual (já é barato).
- **Persistência:** a escolha é um documento pequeno e versionado, guardado hoje no `localStorage` e no
  futuro na conta.

Interfaces (contrato; nada implementado nesta fase):

```ts
/** Definição de um personagem: o que o visitante escolheu (serializável, versionado). */
interface CharacterChoice {
  version: 1;
  base: 'human' | 'robot';
  body: { height: number; build: number }; // 0..1
  parts: Partial<Record<'head' | 'hair' | 'torso' | 'legs' | 'feet' | 'accessory', { id: string; colors?: string[] }>>;
}

/** O que a cena precisa de um personagem, seja procedural ou glTF. */
interface CharacterRig {
  root: THREE.Object3D;
  /** Aplica o estado de locomoção do mundo (mesmos números do `Humanoid` hoje). */
  apply(pose: { walk: number; phase: number; time: number; action?: 'enter' | 'exit' | 'wave' }): void;
  setLod(level: 'near' | 'far'): void;
  dispose(): void;
}
```

---

## 7. Preparação para multiplayer

**Separação proposta [recomendação]**, sem implementar servidor:

| Papel | Hoje | Proposta |
|---|---|---|
| **Entrada** | `runtime.keys/joystick/buttons` lidos dentro da física | `InputCommand` por passo (eixos e ações), produzido pela página e consumido pela simulação; é o que viaja pela rede |
| **Simulação** | `useFrame` com `dt` variável | `World.step(dt = 1/60 fixo, commands)`, com acumulador, fora dos componentes; o mesmo código no cliente e no servidor futuro |
| **Estado das entidades** | Objeto único com um `walker` | `entities: Map<EntityId, EntityState>`, com os jogadores entre elas; o "visitante local" é só um `EntityId` |
| **Interações** | Funções que mudam `runtime` (`tryEnter`, `requestExit`) | Eventos (`{ type: 'enter', who, vehicle }`) validados pela simulação |
| **Desenho** | Lê `runtime` | Lê o estado e **interpola** entre dois passos (suave em qualquer taxa de quadros) |
| **Câmera e interface** | No mesmo objeto | Estado local, fora da simulação |
| **Persistência** | Nenhuma (só preferências) | Instantâneo do estado do visitante (posição, veículo, personagem) |

Interfaces (contrato; nada implementado nesta fase):

```ts
type EntityId = string;
interface InputCommand { tick: number; forward: number; side: number; lift: number; run: boolean; actions: Array<'interact' | 'handbrake' | 'boost'> }
interface EntityState { id: EntityId; kind: 'walker' | 'car' | 'hover'; x: number; y: number; z: number; heading: number; speed: number; driver?: EntityId; rev: number }
type WorldEvent = { type: 'enter' | 'exit'; who: EntityId; vehicle: EntityId; tick: number };
interface Snapshot { tick: number; entities: EntityState[]; events: WorldEvent[] }

/** Transporte futuro (WebSocket/WebTransport). Local por padrão: o jogo solo é o caso n = 1. */
interface Transport {
  send(cmd: InputCommand): void;
  onSnapshot(cb: (s: Snapshot) => void): () => void;
}
```

**Por que isso já é viável [fato]:**
- a física é pura e testada;
- o trânsito tem passo fixo;
- aéreo e pedestres são funções do tempo (sincronizáveis só pelo relógio do servidor, sem enviar posições).

**O que falta:** tirar o passo do `useFrame` (G4) e trocar o objeto único por entidades.

**Interesse por região:** cada cliente recebe as entidades das regiões perto dele (as mesmas células da
seção 5).

---

## 8. Sequência de implementação priorizada

| Ordem | Trabalho | Por quê | Risco |
|---|---|---|---|
| 1 | Troca de nível no lugar (sem `key`) | Elimina travadas de 0,7–2,5 s medidas (G2) | Médio: alvos de sombra e MSAA recriados ao vivo; testar troca em todas as direções |
| 2 | Simulação com passo fixo fora do `useFrame`, com interpolação no desenho | Corrige a câmera lenta (G4), deixa o CI estável, base de rede | Médio: câmera e transições dependem do quadro; os testes unitários existentes cobrem a física |
| 3 | `BatchedMesh` para marcos, mobiliário, placas e carros estacionados | Ataca G1 (CPU dos celulares) | Médio: o `BatchedMesh` exige mesmo material por lote; o perfil confirma o ganho |
| 4 | Sombras em cache (ou cascata estática + dinâmica perto) na Alta | G3 | Baixo |
| 5 | Teste num celular real (Redmi Note 9S ou equivalente) com `bench-universe.mjs` via CDP | Trocar estimativas por fatos (GPU Adreno) | Depende de aparelho |
| 6 | Entidades e `InputCommand` (sem rede) | Base de multiplayer e de personagens | Médio-alto: mexe em todo o `runtime` |
| 7 | Regiões (criação e liberação por raio) e HLOD | Escala da cidade e dos interiores | Alto |
| 8 | Pipeline glTF/KTX2 com um primeiro ativo (o carro do jogador) e o registro de licenças | Qualidade artística onde o olhar para | Médio: orçamento e direitos |
| 9 | Personagem com esqueleto e peças | Personalização | Alto: depende de arte |
| 10 | Protótipo WebGPU isolado, medido | Decidir com dados | Baixo (isolado) |

**Dependências:**
- 2 antes de 6;
- 6 antes de qualquer rede;
- 8 antes de 9;
- 1 e 3 são independentes e os de maior retorno imediato.

**Andamento (branch `universe-next`):**
- **1, feito:** a troca de nível acontece no mesmo canvas (o teste e2e confere que é o mesmo elemento e a mesma
  contagem de geometrias). Medido: um único quadro de 67–200 ms, contra 733 ms e mais 2 s de travadas antes.
- **2, feito:** `world/simulation.ts` roda a física a 60 passos por segundo e o desenho interpola entre os dois
  últimos passos.
- **3, testado e trocado:** o `BatchedMesh` deixou os quadros mais lentos (ver a seção 5). No lugar dele, os
  carros estacionados longe do visitante são desenhados pelos conjuntos instanciados do trânsito.
- **8, base pronta:** há encaixes para modelos de artistas e uma ponte com o Blender, que um agente pode usar
  pelo MCP do Blender (`BLENDER-PIPELINE.md`). Ainda nenhum modelo foi registrado.
- **Visitante único:** o laboratório usa o mesmo visitante do Universe: o mesmo corpo (`scene/VisitorBody.tsx`),
  o mesmo jeito de andar e correr (`world/visitor.ts`, `stepMotion`), a mesma câmera (`VISITOR_CAMERA`) e os
  mesmos controles (Shift ou o botão de toque para correr). Só continuam próprios do laboratório o anel de
  pilares, os pavilhões, o guia e o clique no piso.

---

## 9. Testes executados nesta fase

| Teste | Resultado |
|---|---|
| `npm run check` (tipos, lint, 337 testes unitários, build) | Verde (rodada antes desta fase; esta fase só adiciona documentação e scripts) |
| `bench-universe.mjs desktop` (4 níveis) | Executado; números na seção 3 |
| `bench-universe.mjs redmi` (Baixa e Média) | Executado (emulação); números na seção 3 |
| `hitches-universe.mjs ultra walk` (2 rodadas) | Reconstrução de 733 ms reproduzida nas duas |
| `leak-universe.mjs` | Sem vazamento de recursos da GPU; heap estável na faixa de 43–61 MB |
| Testes de navegador do Universe com SwiftShader (como o CI) | 5 passaram localmente |
| Suporte a WebGPU, WebGL 2 e extensões | WebGPU presente; `WEBGL_multi_draw`, compressão BC e temporizador presentes (Iris Xe/Edge) |

**Aparelhos efetivamente testados:** um notebook com Intel Iris Xe (Windows 11, Edge). Nenhum celular real.
