# Torre Bezalel: arquitetura

A Torre Bezalel é a sede da cidade do Bezalel Universe percorrida por dentro. Não é outro prédio nem
outra cena: é o mesmo edifício (pódio de pedra, torre de vidro champanhe, fenda de luz dourada, o cubo no
topo), no mesmo lugar, com o mesmo visitante, a mesma física, a mesma câmera e a mesma interação (tecla E
e o botão da ação).

**Legenda:** ✅ feito e testado · 📄 só documentado (proposta).

## 1. Implantação e escala

| | Medida | Onde |
|---|---|---|
| Pódio (recepção) | 40 × 26 m, do chão da quadra (0,3 m) a 9,3 m, centrado em (0, −80) | `TOWER.podium` |
| Saguão | Vidro recuado em z = −68,4, de frente para a praça e a avenida; porta de 4,4 m no centro, com balizas que deixam gente passar e barram carro | `TOWER.lobby`, `towerStreetSolids` |
| Torre | Afunila de 22 × 16 m (9,3 m) a 19 × 13,5 m (57,3 m), centrada em (0, −82) | `TOWER.footprint`, `footprintAt` |
| Andares | Térreo no pódio + 12 andares de 4 m (3,55 m livres) | `floorY`, `ceilingY` |
| Núcleo | 6 × 6 m no centro, com a cabina de 2,5 × 3,3 m e a porta de 1,7 m voltada para o sul | `TOWER.core`, `TOWER.cabin` |

A escala é a da cidade: o visitante tem 0,45 m de raio e os olhos a ~1,55 m; os carros e as ruas são os
mesmos de fora. ✅

## 2. Distribuição dos andares

Registro declarativo (`FLOORS` em `world/tower.ts`). Um andar novo é uma linha no registro e um interior
na cena; o elevador, o painel, o diretório e as colisões leem a lista.

| Andar | Setor | Estado | Por quê |
|---|---|---|---|
| Térreo | Recepção | ✅ aberto | Entrada oficial, diretório, apresentação |
| 1–2 | livres | planejado | Perto do chão, reservados para o que mais receber visitantes (atendimento, eventos) |
| 3 | Engenharia e Construção | ✅ aberto | O primeiro andar operacional, perto do chão: é quem constrói os demais |
| 4 | Educação e Cursos | planejado | Produto já existente no site (catálogo curado): próximo candidato |
| 5 | Comercial e Produtos | planejado | |
| 6 | Marketing, SEO e Growth | planejado | |
| 7 | Conteúdo, Vídeo e Redes Sociais | planejado | |
| 8 | Inteligência e Notícias | planejado | Os agentes Scout, Verifier e Vigia já existem no site (em demonstração) |
| 9 | Jurídico e Privacidade | planejado | |
| 10–11 | livres | planejado | Crescimento |
| 12 | Presidência | ✅ aberto | A vista panorâmica e o centro de comando |

O número de andares vem da altura real da torre que já existia (48 m de vidro acima do pódio, a 4 m por
andar). Não foi escolhido por conta. Os andares planejados existem no prédio e no painel do elevador,
marcados "em planejamento". Não há tela vazia atrás deles.

## 3. Navegação e colisões ✅

- **Na rua e no térreo:** a lista de sólidos da cidade. A sede ganhou `collision`, com o pódio oco, o
  vidro, a porta, as balizas, a laje, o núcleo e o balcão. Os volumes grossos (`solids`) continuam valendo
  para o clique, o mapa e o afastamento das árvores. A torre acima do pódio é maciça para quem voa.
- **Num andar da torre:** só as paredes daquele andar (a fachada por dentro, o núcleo, os móveis).
  O chão é fixo (`stepWalker(..., floor)`). Um visitante num andar alto só sai dele pelo elevador: se algo o
  puser fora da planta, ele volta para dentro.
- **Na cabina:** as paredes dela e a porta. O visitante sobe junto com a cabina.
- **Câmera:**
  - fora da cabina, colide com as paredes do andar e não passa do teto nem do piso;
  - fora da cabina, o núcleo inteiro é parede para ela, para não entrar no poço pela porta aberta;
  - dentro da cabina, ela fica no fundo, à altura dos olhos, olhando a porta.
- **Física:** a parede só tira velocidade, nunca dá. A correção vale para a cidade toda: antes, um
  empurrão grande podia arremessar o visitante através da parede.

Testes: `tests/unit/tower.test.ts`, com o percurso a pé saguão → presidência → térreo, a porta que não
abre, a porta que reabre com alguém no vão e o carro barrado. No navegador, o teste e2e "Torre Bezalel".

## 4. Elevador ✅

Máquina de estados pura (`ElevatorState`, `stepElevator`):

```
parada ──chamada/destino──▶ fechando ──▶ andando ──▶ abrindo ──▶ aberta ──(tempo, sem ninguém no vão)──▶ fechando
```

- **Movimento:** acelera, cruza a 7 m/s e freia (v² = 2·a·d) para parar exatamente no andar. Do térreo à
  presidência leva cerca de 10 s, com as portas.
- **Estados inválidos:**
  - andar em planejamento ou inexistente: `unavailable`, e o painel explica;
  - pedido com a cabina andando: `busy`;
  - alguém no vão: a porta volta a abrir.
- **Retorno ao visitante:**
  - mostrador com o andar e a seta, na cabina e sobre a porta de cada andar;
  - sinal sonoro na chegada e som na porta;
  - HUD com "Torre Bezalel · andar · setor".
- **Alternativa acessível:** o painel é um diálogo com um botão por andar (teclado, leitor de tela e
  `aria-current` no andar atual). A viagem acontece mesmo assim: há cabina, porta, movimento e chegada,
  nunca um corte de câmera sem contexto.

## 5. Interiores e carregamento por região ✅

`scene/TowerInterior.tsx` é um pedaço de código à parte. O visitante que não se aproxima da torre não o
baixa: ele é pedido em segundo plano alguns segundos depois de a cidade ficar pronta, e montado com a
câmera a ~120 m dela.

| Ambiente | Quando é desenhado | Conteúdo |
|---|---|---|
| Recepção | Câmera a até 70 m e abaixo da torre | Piso, paredes, forro com luz, vidro e portas de correr, balcão com a marca, diretório (do registro), painel de boas-vindas, espera, núcleo com portas e mostrador |
| Cabina | Perto da torre | Paredes, luz, botões, mostrador, portas |
| Engenharia (3º) | Visitante no 3º, ou na presidência (só para a câmera) | Bancadas, monitores, quadro de arquitetura, três robôs trabalhando (representação), a câmera ENG-01 |
| Presidência (12º) | Visitante no 12º | Mesa de frente para a cidade, reuniões, estações, telas gigantes |

- **Fachada:** de longe, o saguão continua sendo a imagem de sempre (barata). De perto, ela some e
  aparecem o vidro e a recepção de verdade.
- **Vista:** a fachada da torre só tem a face de fora, então de dentro a cidade real aparece pelas janelas.
  Por cima vão um vidro interno, os montantes e um pilar diante da fenda dourada.
- **Peças estáticas:** viram poucas malhas (`mergeStatic`). Nada é recriado ao trocar de andar ou de
  qualidade.

**Custo medido** (chamadas WebGL por quadro, tela do Redmi, Média, `scripts/gl-counts-universe.mjs`):

| Cena | Chamadas | Desenhos |
|---|---|---|
| Chegada (fora da torre) | 1006 | 157 |
| Recepção | 949 | 142 |
| Presidência (com a câmera ENG-01) | 1231 | 191 |

Fora da torre, o custo não mudou. A presidência custa mais porque do alto a cidade inteira está na vista.

## 6. Câmeras dos setores ✅ (uma) e 📄 (o resto)

- **Registro:** `SECTOR_CAMERAS`, com id, setor, andar, posição, alvo e campo de visão. O teste garante que
  toda câmera fica dentro de um andar aberto.
- **ENG-01:** imagem real do ambiente 3D, renderizada num alvo de 512 × 288, 4 vezes por segundo, só com o
  visitante na presidência. O andar dela é desenhado numa camada (3) que a câmera principal não vê, e o
  mapa de sombras não é refeito para essa vista. A tela diz "Câmera virtual do ambiente 3D".
- **Alternativas avaliadas:**
  - todas as câmeras ao vivo: descartada, porque cada uma é um quadro inteiro a mais;
  - **uma ao vivo por vez, as outras em miniatura de baixa frequência:** é a recomendada para quando
    houver várias;
  - imagem fixa: só como último recurso.
- 📄 **Proposta:** escolher a câmera na tela da presidência (clique ou E), abrir em tela maior e ir ao andar
  dela pelo elevador.

## 7. Centro de comando e estado dos setores

- ✅ **Contrato `SectorStatus`:** setor, disponibilidade (`planned`, `demo`, `operational`, `unavailable`),
  agentes ligados (os de produto), tarefas, alertas, `updatedAt` e `source` (`demo`, `live`, `none`).
- ✅ **Hoje:** a fonte é uma lista local, toda `demo` ou `planned`, e a tela mostra "DADOS DE
  DEMONSTRAÇÃO". Um teste impede `live` ou `operational` nela.
- 📄 **Depois:** um serviço do backend (`server/`) publica o mesmo contrato, com autenticação e
  `updatedAt` reais; a cena só lê. A Torre representa; ela não decide se um agente está ativo (ver
  `AGENT-GOVERNANCE.md`).

## 8. Gerenciamento de ativos 📄

Os interiores de hoje são procedurais. Para trocar uma peça por um modelo de artista, use o mesmo
caminho do resto da cidade: um encaixe `prop:`/`landmark:` no registro (`assets/manifest.ts`), GLB por
nível de detalhe e licença (`BLENDER-PIPELINE.md`). A próxima etapa natural é um encaixe por andar
(`interior:<andar>`) carregado com o interior.

## 9. Próximos passos 📄

| Ordem | Trabalho |
|---|---|
| 1 | Medir a Torre num celular real (Redmi Note 9S): subir, presidência, câmera |
| 2 | Escolher câmera na presidência e abrir em tela maior |
| 3 | Educação e Cursos no 4º andar, ligado ao catálogo real do site |
| 4 | Estado dos setores servido pelo backend (ainda sem ações externas) |
| 5 | Encaixe `interior:<andar>` para modelos de artista |
| 6 | Escadas de emergência como segunda rota (acessibilidade e coerência do prédio) |

**Multiplayer:** sem implementação. O que o prepara:
- o estado do elevador é dado puro e serializável (`ElevatorState`), então pode ser a autoridade do servidor;
- o visitante em cada andar é só (x, y, z, andar).

## 10. Produtos, acesso e monetização futura 📄

Nada disso está implementado. Nenhum pagamento, publicação externa ou automação comercial foi ligado.

| Linha | Como a arquitetura comporta | Cuidados |
|---|---|---|
| Notícias e relatórios por assinatura | Setor Inteligência e Notícias; o pipeline de agentes já registra fonte, data e correção (`AgentEvent`) | Rastreabilidade de fontes, histórico de correções, atribuição, revisão editorial humana antes de publicar |
| Curadoria de cursos com links de afiliado | O catálogo curado já tem fonte e data de conferência | Link de afiliado sempre identificado na tela; a recomendação não depende da comissão |
| Aprendizagem interativa com IA | Setor Educação; o assistente local (Sol) é a base | Dizer o que é IA; não inventar fonte; dados do estudante protegidos |
| Cursos próprios e produtos digitais | Setor Comercial e Produtos; o registro de produtos (`world/products.ts`) | Autoria, atualização e preço claros |
| Planos e permissões por produto | Um contrato de acesso (plano → produtos → permissões) no backend | A Torre mostra o que o visitante pode acessar; ela não guarda segredos |
| Pagamentos | Integração futura, só no servidor, com provedor certificado | Nunca no navegador; só com pedido específico do proprietário |

Separações que valem desde já:
- conteúdo gratuito × pago;
- demonstração × real;
- recomendação afiliada × produto próprio.

Atividades jurídicas e de privacidade usam a IA como apoio à organização, nunca como substituta de
profissional habilitado.
