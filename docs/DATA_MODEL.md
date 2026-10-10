# Modelo de dados

Tipos em [`src/types/domain.ts`](../src/types/domain.ts). Este documento descreve as entidades, seus relacionamentos e as regras de preenchimento.

## Relacionamentos

```
Source 1 ──── * Course (via sourceUrl / sourceName)
Course * ──── * Skill  (Course.skills → Skill.id; Skill.relatedCourseIds é DERIVADO)
Skill  * ──── 1 Category
Course * ──── 1 Category
Agent  1 ──── * AgentEvent (AgentEvent.agentId)
AgentEvent * ── 1 entidade (entityType + entityId: course | source | skill | query | agent)
```

## Course

| Campo | Tipo | Regra |
|---|---|---|
| `id`, `slug` | string | Únicos (testado). `slug` forma a URL `/course/:slug`. |
| `title`, `description` | string | Descrição é resumo próprio em português, não cópia. |
| `provider` | `{ name, url? }` | Instituição responsável (certificadora). |
| `contentAuthor` | string? | Autor do conteúdo quando diferente (ex.: ITS Rio, Universidade de Oxford). |
| `category` | `CategoryId` | Uma das 7 categorias da taxonomia. |
| `skills` | string[] | IDs da taxonomia — **classificação da curadoria**, não afirmação do provedor. |
| `type` | `course` \| `certification` \| `learning-path` | |
| `level` | `beginner` \| `intermediate` \| `advanced` \| `all-levels` \| `unknown` | |
| `levelSource` | `stated` \| `inferred` | Obrigatório se `level ≠ unknown`. "Inferido" é exibido com marca. |
| `priceType` | `free` \| `free-with-paid-certificate` \| `paid` \| `varies` \| `unknown` | Conforme a fonte. |
| `priceAmount`, `currency` | number?, string? | Só quando conhecidos e fixos (ISO 4217). |
| `priceNote` | string? | Ex.: "preço do exame varia por país". |
| `duration` | `{ value, unit, note? }`? | Unidades: horas, semanas, aulas, módulos, horas/semana. |
| `certificateType` | enum? | **Ausente = não confirmado** → "Não informado". |
| `certificateNote` | string? | Regras declaradas (nota mínima, validade…). |
| `prerequisites`, `topics`, `languages` | string[] | Conforme a fonte. |
| `license` | string? | Licença do material, quando declarada. |
| `modality` | `online` \| `online-self-paced` \| … \| `unknown` | `online` = ritmo não declarado. |
| `sourceUrl`, `sourceName` | string | URL HTTPS da página oficial consultada. |
| `sourceVerifiedAt` | ISO date? | Data em que a informação foi confirmada na fonte. |
| `lastCheckedAt` | ISO date | Última conferência (base da regra de 180 dias). |
| `verificationStatus` | `verified` \| `partially-verified` \| `unverified` \| `outdated` \| `failed` | |
| `verificationNote` | string | O que foi e o que não foi confirmado. |
| `publicationStatus` | `found` \| `validating` \| `approved` \| `rejected` \| `published` \| `outdated` \| `removed` | Ver máquina de estados em `docs/AGENTS.md`. |
| `origin` | `curated` \| `demo` \| `production` | Sempre exibida. |
| `createdAt`, `updatedAt` | ISO date | |

## Agent

`id` (`scout` \| `verifier` \| `atlas` \| `trend` \| `sol`), `name` (provisório, centralizado em `data/demo/agents.ts`), `role`, `description` (pt/en), `status` (`active` \| `idle` \| `failed` \| `offline`), `mode` (`demo` \| `production`), `lastActivityAt?`, `taskTypes`, `dataSources`, `limitations`, `taskCount?`.

Na interface, `status`, `lastActivity` e contagem de tarefas são **derivados da trilha de eventos** (`domain/operations.ts`): ativo se houve evento nos últimos 9 s; com falha se o último erro tem menos de 25 s e não houve sucesso depois; ocioso caso contrário.

## AgentEvent

`id`, `agentId`, `type` (15 tipos: `source.checked`, `opportunity.discovered`, `record.normalized`, `record.duplicate`, `validation.started`, `validation.passed`, `validation.failed`, `quality.scored`, `record.published`, `record.rejected`, `record.outdated`, `trend.analyzed`, `graph.linked`, `assistant.query`, `agent.error`), `timestamp`, `summary`, `entityType`, `entityId`, `entityLabel?`, `sourceUrl?`, `result` (`success` \| `failure` \| `warning` \| `info`), `environmentMode` (`demo` \| `production`), `runId?`, `recordStatus?`, `meta?` (dados estruturados para montar o texto em qualquer idioma).

## Skill

`id`, `name` (pt/en), `category`, `description` (pt/en), `relatedCourseIds` (derivado dos cursos publicados), `evidenceSources[{ kind: catalog | job-postings | mentions, label, origin }]`.

## Source

`id`, `name`, `url`, `sourceType` (`official-site` \| `public-api` \| `institutional-page` \| `open-courseware` \| `demo-fixture`), `trustStatus` (`trusted` \| `under-review` \| `blocked` \| `demo`), `lastCheckedAt?`, `collectionPolicy` (`manual-curation` \| `official-api` \| `not-collected` \| `demo`), `origin`.

## Onde ficam os dados

| Arquivo | Conteúdo | Origem |
|---|---|---|
| `src/data/catalog/courses.ts` | 19 registros reais | Conferência manual em 10/10/2026 |
| `src/data/catalog/sources.ts` | 13 fontes oficiais | idem |
| `src/data/catalog/taxonomy.ts` | 7 categorias, 41 competências | Curadoria |
| `src/data/demo/pipeline-fixtures.ts` | 4 fontes e 10 registros **fictícios** (`example.org`) | Demonstração |
| `src/data/demo/agents.ts` | Perfis dos agentes (modo demo) | Demonstração |
| `src/data/demo/mentions.ts` | Série de menções **fictícia** e consultas de exemplo | Demonstração |

O registro de demonstração exibido no catálogo (com "Incluir registros de demonstração") é a **saída real do pipeline** aplicado às fixtures — não há estados escritos à mão.

## Regras de curadoria (resumo)

1. Só preencher o que a fonte declara; ausência vira "Não informado".
2. Sinalizar inferências (`levelSource: 'inferred'`).
3. Competências são classificação da curadoria.
4. Dados estruturados (schema.org/Course) só para registros reais verificados e só com campos confirmados.
5. Reconferir em até 180 dias; depois disso o registro é tratado como desatualizado.

## Como adicionar um curso real

1. Abra a página oficial e confirme cada campo.
2. Adicione o registro em `src/data/catalog/courses.ts` com `lastCheckedAt`/`sourceVerifiedAt` = data da conferência e uma `verificationNote` precisa.
3. Se for uma nova instituição, inclua a fonte em `sources.ts`.
4. `npm test` valida unicidade, HTTPS, categoria, competências e consistência de nível/preço.
5. `npm run export:data` atualiza a semente do backend.
