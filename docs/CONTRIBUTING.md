# Contribuição

## Fluxo

1. Crie uma branch a partir da `main` (`feat/…`, `fix/…`, `docs/…`).
2. Rode `npm run check` (tipos, lint, testes e build) e, se tocar em UI, `npm run build:pages && npm run test:e2e`.
3. Abra um pull request; o CI repete tudo, incluindo Playwright e os testes do backend.

Mensagens de commit no imperativo, em português ou inglês, descrevendo o *porquê* quando não for óbvio.

## Convenções de código

- **TypeScript estrito**; sem `any` (o lint recusa). Tipos de domínio em `src/types/domain.ts`.
- **Camadas**: componentes → hooks → `useServices()` → serviços → domínio. Componentes nunca importam `src/data` diretamente (exceções documentadas: taxonomia e nomes de agentes, que são constantes de interface).
- **Lógica pura em `src/domain`**, sempre com teste em `tests/unit`.
- **Textos da interface**: os globais (navegação, rótulos comuns, metadados) em `src/i18n` — adicione a chave em `pt-BR/` e o tipo obrigará o inglês; textos de uma página ou ferramenta ficam num módulo de conteúdo dela (ex.: `features/tools/content.ts`), no chunk da página, para não pesar o JS inicial. Todo módulo de texto novo entra na varredura de `tests/unit/ethics.test.ts`.
- **Ética** (`docs/ETHICS.md`): nada de escassez, urgência, prova social inventada, contadores falsos ou recusa que envergonha. Números exibidos são reais e conferíveis; sem dado, "Não informado".
- **Acessibilidade** (`docs/ACCESSIBILITY.md`): WCAG 2.2 AA. A auditoria do axe roda com os testes de navegador (`tests/e2e/a11y.spec.ts`); rota nova entra na lista `ROUTES`. O nome acessível de um controle começa pelo texto visível; área com rolagem própria usa `scrollRegion()`; cor nunca sozinha; todo gráfico tem equivalente em texto. Depois, conferir à mão só com teclado e com leitor de tela.
- **Cores e medidas por tokens** (`src/styles/tokens.css`); nada de hex em componentes, exceto contextos sem CSS (canvas/WebGL), centralizados em `AGENT_HEX` e nas texturas.
- **Acessibilidade**: elementos interativos nativos (`button`, `a`, `dialog`), rótulos em ícones (`IconButton` exige `label`), foco visível, nada que dependa só de cor ou só de hover.
- **Movimento**: respeitar `reducedMotion` (de `usePreferences`) em animações por JavaScript; CSS já é coberto globalmente.
- **React Compiler / hooks**: sem `setState` síncrono em efeitos e sem ler `ref.current` durante a renderização (o lint aponta). Estado por quadro do 3D vive no `LabRuntime`, fora do React.
- **Dados**: real (`origin: 'curated'`) só com conferência na fonte; fictício sempre `origin: 'demo'` e domínios `example.org`.

## Estrutura de testes

| Pasta | Ferramenta | Cobre |
|---|---|---|
| `tests/unit/*.test.ts` | Vitest | busca, filtros, pipeline, eventos, assistente, insights, integridade dos dados, i18n |
| `tests/unit/app.test.tsx` | Vitest + Testing Library | rotas, filtros na interface, detalhe, fallback 2D, agentes, troca de idioma |
| `tests/e2e/*.spec.ts` | Playwright | deep links no subcaminho, metadados estáticos, console limpo, 3D, mobile, rolagem horizontal |
| `server/tests` | pytest | contrato da API |

## Design

Antes de criar um componente, procure em `src/components/ui` (Button, Badge, Chip, Dialog, Tabs, Tooltip, Toast, StateView, ExternalLink) e `src/components/data` (OriginBadge, VerificationBadge, PublicationBadge, FieldValue). Gráficos: `ChartFrame` exige visão em tabela; cores categóricas vêm de `--series-1…6` (validadas para daltonismo e contraste) e seguem a entidade, nunca a posição.
