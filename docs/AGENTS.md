# Agentes e pipeline

## Os agentes

| Agente | Responsabilidade | Na v1.0 |
|---|---|---|
| **Scout** | Consulta fontes autorizadas, descobre oportunidades e normaliza registros brutos | Simulado sobre fixtures fictícias |
| **Verifier** | Deduplica, valida, atribui nota de qualidade, publica ou rejeita | Regras reais (`domain/pipeline`) aplicadas a dados fictícios |
| **Atlas** | Relaciona cursos e competências | Relações reais do catálogo curado; eventos simulados |
| **Trend** | Analisa competências mais frequentes | Contagens reais do catálogo; nunca apresentadas como demanda |
| **Sol** | Ajuda a navegar pelo catálogo | Motor de regras local real (`domain/assistant/engine.ts`) |

Nomes são provisórios e ficam só em `src/data/demo/agents.ts`. Todos têm `mode: 'demo'`: nenhum agente autônomo está em produção, e a interface mostra isso em cada estado.

## Pipeline

Contratos em [`src/domain/pipeline/contracts.ts`](../src/domain/pipeline/contracts.ts); orquestração pura em `runner.ts`.

| # | Etapa | Implementação | Contrato futuro |
|---|---|---|---|
| 1 | Descoberta de fontes | `isSourceAllowed` (só `trusted`, ou `demo` no modo demo) | `SourceDiscovery.discover()` |
| 2 | Coleta | Fixtures locais | `Collector.collect(source, { signal, since })` — **no servidor** |
| 3 | Normalização | `normalizeRecord`: preço, nível, duração, certificado, categoria; remove marcação e caracteres de controle | — |
| 4 | Deduplicação | Identificador externo → URL normalizada → impressão digital (instituição + título) | — |
| 5 | Validação | 6 critérios bloqueantes + 3 avisos | — |
| 6 | Qualidade | Nota 0–100 (60 validação + 40 completude); mínimo 70 | — |
| 7 | Publicação | Máquina de estados com transições explícitas | `Publisher.publish / markOutdated / remove` |
| 8 | Registro de eventos | Todo passo gera um `AgentEvent` | `EventLog.append` |
| 9 | Monitoramento de erros | Falha de fonte vira `agent.error`; a execução segue | `ErrorMonitor.capture` |

### Critérios de validação

Bloqueantes: título (≥ 5 caracteres), instituição identificada, URL HTTPS, fonte autorizada, conteúdo seguro (sem marcação executável), informação atual (≤ 180 dias).
Avisos (−10 pontos cada): categoria reconhecida, preço declarado, descrição suficiente (≥ 60 caracteres).
Completude (+8 cada): duração, certificado, competências, descrição detalhada (≥ 120), nível.

### Estados de um registro

```
found ──▶ validating ──▶ approved ──▶ published ──▶ outdated
  │            │             │            │             │
  └─▶ removed  └─▶ rejected ◀┘            └─▶ removed   └─▶ validating
                    │
                    └─▶ validating (reenvio) · removed
```

Transições fora da tabela lançam `InvalidTransitionError` (testado). Duplicatas vão de `found` para `removed`.

## Simulação (modo demonstração)

`services/events/scenario.ts` monta cada execução combinando:

- os eventos do **pipeline real** sobre as fixtures (os resultados — aprovado, duplicado por URL, duplicado por título, sem HTTPS, nota insuficiente, desatualizado, conteúdo inseguro — saem das regras, não de sorteio);
- consultas de exemplo do Sol com contagem calculada pela **busca real** no catálogo;
- análises do Trend e do Atlas sobre o **catálogo real**;
- uma reconferência que marca um registro fictício como desatualizado (regra de 180 dias).

O roteiro é determinístico; a única variação é programada: nas execuções ímpares a fonte fictícia "Portal Meridiano" falha por timeout, para que a interface mostre o estado "com falha". `DemoEventFeed` reproduz os eventos em ritmo legível (~2,2 s), carimbando `environmentMode: 'demo'`.

## Trocando a simulação por agentes reais

1. Implemente coletores no servidor (`Collector`) para fontes com API oficial ou permissão explícita; registre cada fonte com `trustStatus` e `collectionPolicy`.
2. Reaproveite `normalizeRecord`, `findDuplicate`, `validateRecord`, `assessQuality` e `transition` (são TypeScript puro; podem rodar em Node/Deno/Edge Functions) ou porte para Python mantendo os testes como especificação.
3. Persista `courses` e `agent_events`; publique eventos em `GET /v1/events/stream` (SSE).
4. No frontend, defina `VITE_DATA_MODE=api` e `VITE_API_BASE_URL`. A interface (laboratório, agentes, Central de Operações) passa a refletir os eventos reais **sem mudança de código**, pois consome o mesmo contrato `EventService`.

## Política de coleta

- Priorizar APIs oficiais, dados abertos autorizados e páginas institucionais.
- Respeitar termos de uso, `robots.txt`, permissões e limites de requisição; identificar o robô (User-Agent com contato).
- Nada de coleta indiscriminada; nenhuma coleta pelo navegador do visitante.
- Dado externo é não confiável: nada é executado, marcação é removida e o registro é reprovado.
- Revisão humana antes de ampliar a lista de fontes confiáveis.
