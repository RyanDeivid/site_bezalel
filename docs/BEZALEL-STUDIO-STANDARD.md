# Padrão Bezalel Studio

O que "pronto" quer dizer neste repositório. Cada item tem um jeito de ser conferido. Onde não há meta
numérica, é porque ela depende da plataforma e da cena: o que vale é medir antes e depois e registrar.

## 1. Honestidade do que é mostrado

| Regra | Como se confere |
|---|---|
| Dado de demonstração aparece marcado na tela ("Demonstração", "Dados de demonstração", selo `demo`) | Busca no código por `source: 'demo'` / `mode: 'demo'` e captura da tela que o exibe |
| Nada é apresentado como operacional sem estar (agente, câmera, serviço) | `SECTOR_STATUS` sem `source: 'live'` (teste em `tests/unit/tower.test.ts`) |
| Câmera virtual diz que é virtual | Texto na tela da presidência; o teste garante que a câmera fica num andar existente |
| Andar, setor ou produto ainda não feito aparece como "em planejamento" e não leva a uma tela vazia | Painel do elevador com os botões desabilitados (teste e2e) |
| Resultado de aparelho real só com teste no aparelho; emulação é chamada de emulação | Relatórios e documentos dizem "emulado" |

## 2. Arquitetura de software

- **TypeScript estrito**, sem `any` solto. Tipos de domínio explícitos (`TowerFloor`, `SectorStatus`,
  `ModelEntry`) e dados declarativos em registros, não espalhados em componentes.
- **Lógica pura separada da cena**: o que decide (física, elevador, trânsito, pipeline) fica em `world/`
  ou `domain/`, testável sem navegador; a cena só desenha e lê estado.
- **Uma responsabilidade por módulo**. Nenhum componente monta a cidade, os andares, as câmeras e os
  agentes juntos.
- **Evolução, não reescrita**: um segundo sistema de navegação, física ou carregamento só com necessidade
  medida e documentada.
- Conferência: `npm run typecheck`, `npm run lint` (0 erros), revisão do diff.

## 3. Qualidade visual

- Paleta de base: `#101B2B`, `#263B54`, `#C7A86A`, `#F2E8D5`; cada ambiente distribui a seu modo.
- Legibilidade espacial antes do efeito: o visitante sabe onde está e para onde ir (placa, diretório,
  caminho, HUD com o lugar e o andar).
- Nada estourado pelo brilho (bloom) a ponto de esconder forma ou texto; texto legível nas telas a 1,5–3 m.
- Conferência: capturas de tela do percurso (scripts em `scripts/`), revistas antes de aprovar. **Sem
  captura, não há aprovação visual.**

## 4. Modelos 3D

| Regra | Onde |
|---|---|
| Metros, escala 1, origem no chão no centro da base; eixos do glTF (Y para cima) | `docs/BLENDER-PIPELINE.md` |
| Nomes previsíveis: `<id>_lod<n>.glb`, coleções com `bz_model`/`bz_slot`, colisões `COL_*` | `art/blender/export_universe.py` |
| Licença completa e verificável (fonte, autor, prova; crédito para CC-BY) | `validateManifest` |
| Dentro do orçamento do tipo de encaixe (triângulos e bytes do nível 0) | `MODEL_BUDGET` em `manifest.ts` |
| Comprimido (meshopt) e com texturas KTX2 | `node scripts/check-models.ts` |
| Todo volume que bloqueia tem um sólido de colisão | testes de colisão |

## 5. Desempenho mensurável

- O gargalo medido do Universe nos celulares é o **processador** (enviar o desenho). Toda otimização
  apresenta a contagem antes e depois (`scripts/gl-counts-universe.mjs`, que dá o mesmo número em toda
  rodada) e, quando possível, o tempo em A/B alternado (`scripts/bench-redmi.mjs`, versões lado a lado).
- O que não está à vista não é desenhado (interiores por região, câmeras de setor a poucos quadros por
  segundo, nada reconstruído ao trocar de andar ou de nível).
- Orçamento de tamanho no CI (`scripts/check-budget.ts`); subir um teto exige justificativa no script.
- Classes de hardware de referência: computador com placa integrada, celular intermediário (Redmi Note 9S
  como referência) e renderização sem placa de vídeo (perfil de software). O jogo precisa ser utilizável
  nas três, com níveis diferentes.

## 6. Acessibilidade e orientação

- Teclado, mouse, toque e controle para toda ação; a ação do momento num botão visível e na tecla E.
- Diálogos com foco preso, Esc e caber em 320 × 568; contraste AA (auditoria axe no CI).
- Movimento reduzido respeitado (cortes em vez de voos; câmera calma); som pausa fora da tela.

## 7. Segurança, privacidade e permissões

- Sem segredos no repositório ou no bundle. CSP sem `eval` de JavaScript (`docs/SECURITY.md`).
- Dependência, extensão ou servidor MCP novo: avaliar origem, manutenção, permissões e superfície de
  ataque antes; instalar só com autorização do proprietário.
- Dados pessoais: nenhum coletado pelas experiências 3D; preferências ficam no próprio navegador.
- Ações externas (publicar, pagar, enviar) seguem `docs/AGENT-GOVERNANCE.md`.

## 8. Testes reproduzíveis

- Lógica: Vitest (`tests/unit`). Fluxos: Playwright no build servido em `/site_bezalel/`
  (`tests/e2e`), desktop e celular, pelo gancho de inspeção quando o 3D é lento no navegador de teste.
- Teste intermitente é defeito a corrigir, nunca algo a repetir até passar ou a desligar.
- Antes de publicar: `npm run check`, `npx playwright test`, `npm run build && node scripts/check-budget.ts`.

## 9. Decisões documentadas

- Decisões de arquitetura e medições em `docs/` (por exemplo `UNIVERSE-FOUNDATION.md`,
  `BEZALEL-TOWER-ARCHITECTURE.md`), com o porquê, as alternativas descartadas e os números.
- Commits em português, explicando o que muda e por quê.
