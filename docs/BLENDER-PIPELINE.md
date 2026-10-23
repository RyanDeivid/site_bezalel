# Modelos de artistas e Blender no Bezalel Universe

O Universe é procedural e continua sendo. Modelos feitos por artistas (glTF/GLB) entram por cima, de dois
jeitos:
- **substituindo uma peça num encaixe**: um marco, um veículo, um personagem;
- **acrescentando objetos posicionados no mundo.**

Sem modelo registrado, nada muda.

Este guia vale para quem modela à mão no Blender e para um agente usando o **MCP do Blender**. O MCP executa
código Python dentro do Blender; os dois scripts abaixo são o que ele roda.

## Peças

| Peça | Onde | O que faz |
|---|---|---|
| Registro | `src/features/universe/assets/models.json` | Cada modelo: `id`, encaixe (`slot`), níveis de detalhe (`lods`: arquivo, até que distância, triângulos, bytes), escala e deslocamento, sombras e **licença** (obrigatória) |
| Posições | `src/features/universe/assets/placements.json` | Objetos acrescentados: modelo, posição, giro, escala e caixa de colisão opcional |
| Regras | `src/features/universe/assets/manifest.ts` | Tipos, orçamentos por tipo de encaixe e `validateManifest` (licença, orçamento, LODs, ids) |
| Carregamento | `src/features/universe/scene/ArtistModel.tsx` | `ArtistSlot` (o modelo do encaixe ou a peça procedural) e `ArtistPlacements`. Os carregadores (GLTF, KTX2, meshopt, do próprio three.js) só são baixados se houver algum modelo. Cache compartilhado, liberação no fim, `THREE.LOD` para os níveis. |
| Encaixes já ligados | `Landmarks.tsx` | `landmark:bezalel-hq`, `landmark:ai-lab`, `landmark:products-center` |
| Conferência | `node scripts/check-models.ts` | Lê cada GLB sem dependências e confere triângulos e tamanho reais contra o declarado e o orçamento, a compressão (meshopt/Draco), o KTX2 e a licença. Também acusa arquivos sem registro. |
| Cidade para o Blender | `node scripts/export-city-layout.ts` → `art/city-layout.json` | Quadras, ruas, praça, os 442 sólidos de colisão, os locais e as posições, para modelar na escala e no lugar certos |
| Importar no Blender | `art/blender/import_city_layout.py` | Monta a cidade como referência travada (coleção "Universe (referência)") |
| Exportar do Blender | `art/blender/export_universe.py` | Gera `public/models/<id>_lod<n>.glb`, atualiza o registro e substitui as posições |

## Convenções no Blender

- **Unidades:** metros, escala 1. A origem do modelo fica no chão, no centro da base.
- **Eixos:**
  - o Universe usa as coordenadas do glTF (Y para cima, Z para o sul);
  - no Blender (Z para cima), um ponto (x, y, z) do Universe fica em (x, −z, y);
  - a frente do modelo fica para −Y no Blender (+Z no Universe).
  - O importador e o exportador fazem a conversão. Não gire o modelo para "corrigir".
- **Um modelo = uma coleção** com as propriedades personalizadas:
  - `bz_model` (o id) e `bz_slot` (ex.: `landmark:bezalel-hq`, `prop:banco-praca`);
  - `bz_license`, `bz_author`, `bz_source`, `bz_proof` (todas obrigatórias) e `bz_credit` (para CC-BY).
- **Níveis de detalhe:** objetos com o sufixo `_LOD0` (mais detalhado), `_LOD1`, `_LOD2`. Distâncias padrão:
  25, 80 e 400 m. O "longe" pode ser o procedural que já existe.
- **Colisão:** caixas `COL_*` filhas do objeto posicionado (não entram no GLB; viram a caixa de colisão no
  chão).
- **Posições:** um objeto (empty ou instância da coleção) com `bz_place = "<id do modelo>"`.
- **Materiais:** PBR metálico/rugosidade (o que o glTF exporta). Texturas em potência de 2, até 2048² nos
  marcos e 1024² nos veículos e personagens.

## Fluxo

1. Exportar a cidade: `node scripts/export-city-layout.ts`.
2. No Blender (ou pelo MCP): rodar `art/blender/import_city_layout.py`, modelar dentro da referência, marcar
   as coleções e as posições.
3. Exportar: rodar `art/blender/export_universe.py`.
4. Comprimir cada GLB (geometria em meshopt, texturas em KTX2):
   `npx @gltf-transform/cli optimize public/models/<arq>.glb public/models/<arq>.glb --compress meshopt --texture-compress ktx2`.
   Atualize `bytes` no registro (o `check-models` acusa se ficar maior que o declarado).
5. Na primeira textura KTX2, copiar `node_modules/three/examples/jsm/libs/basis/*` para `public/basis/`.
6. Conferir com `node scripts/check-models.ts`, depois `npm run check` e uma captura do lugar.

**Testado em 23/10/2026 com o Blender 5.2, em segundo plano.** A cidade importou 484 objetos de referência. Um
banco de teste com dois níveis e caixa de colisão foi exportado: 2 GLBs (124 e 28 triângulos), registro com
licença e posição convertida certa. Ele apareceu na praça do Universe, com sombra; o `check-models` aprovou.
O teste não ficou no repositório.

Para provar o ambiente (render, exportação e verificação do GLB, sem tocar em nada do site), use
`art/blender/smoke_test.py`. Os comandos validados, a avaliação do MCP e a recuperação de problemas estão
em `BLENDER-AUTOMATION.md`.

## Orçamentos (nível 0)

| Encaixe | Download | Triângulos |
|---|---|---|
| Marco | 1,5 MB | 150 mil |
| Veículo | 400 kB | 60 mil |
| Personagem | 600 kB | 25 mil |
| Objeto | 250 kB | 15 mil |

## Licenças

Entram sem análise caso a caso:
- CC0, por exemplo a Poly Haven;
- CC-BY, com o texto de crédito em `bz_credit`;
- modelo próprio ou encomendado;
- comercial com direito de redistribuição na web.

Qualquer outra licença (incluindo as "editoriais", "não comerciais" e as de lojas sem redistribuição) é recusada
pelo `validateManifest` até ser analisada. Ao baixar de uma biblioteca pelo MCP (Poly Haven, Sketchfab…),
registre a página do modelo em `bz_source` e a licença dela.

## Segurança

Os decodificadores são WebAssembly servido pela mesma origem. A CSP do site permite só compilar WebAssembly
(`'wasm-unsafe-eval'`), não `eval` de JavaScript (ver `SECURITY.md`).
