# Bezalel Autonomous Company OS

A infraestrutura em que os funcionários digitais do Bezalel vão trabalhar. Ela é independente da
interface visual (a Torre Bezalel só representa) e dos agentes individuais: agentes, tarefas, execuções,
ferramentas, eventos, aprovações, avaliações, agendamentos e métricas são sistemas reais do backend.

Esta é a primeira versão. O núcleo funciona, foi testado e tem um primeiro funcionário real: o Site
Intelligence Agent, que é somente leitura. A autonomia cresce com evidência de confiabilidade, não com a
quantidade de agentes.

Documentos:
- [`AGENT-RUNTIME.md`](AGENT-RUNTIME.md): armazenamento, estados, executor, recuperação, limites, provedor
  de modelos e API.
- [`AGENT-TOOLS.md`](AGENT-TOOLS.md): ferramentas, níveis, contratos e como acrescentar uma com segurança.
- [`AGENT-OPERATIONS.md`](AGENT-OPERATIONS.md): rodar, configurar, operar e se recuperar de falhas.
- [`AGENT-GOVERNANCE.md`](AGENT-GOVERNANCE.md): níveis de autonomia e requisitos, agora aplicados em código.

## 1. Estado inicial (auditoria de 23/10/2026)

| Item | O que havia |
|---|---|
| Repositório | `C:\bezalel` (main em 737ca19, limpo). Trabalho no branch `company-os`, na árvore `C:\bezalel-fase3` |
| Versões | Python 3.14.6, Node.js 26.11.1, Claude Code 2.1.282; FastAPI 0.137.2 e Pydantic 2.13.4 instalados (o `requirements.txt` fixa 0.143.0 e 2.14.0) |
| Backend `server/` | API FastAPI **somente leitura** do catálogo (332 linhas, 13 testes passando). `/v1/events` devolve vazio de propósito; `/v1/assistant` responde 501 sem provedor. Sem banco, sem autenticação (não precisava: só leitura pública) |
| Agentes de produto | Scout, Verifier, Vigia, Atlas, Trend e Sol: `mode: 'demo'` no frontend e no backend |
| Contratos | `src/domain/pipeline/contracts.ts` (descoberta, coleta, publicação, `EventLog`, `ErrorMonitor`) e o tipo `AgentEvent`. Implementação só simulada no navegador |
| Torre Bezalel | Protótipo vertical com `SectorStatus` local, todo `demo` ou `planned` |
| Subagentes do Claude Code | 8 definições em `.claude/agents/`, preservadas sem duplicar |
| Testes antes de começar | Frontend: 360 unitários e 209 e2e, verdes no CI de 737ca19. Backend: 13 passando |
| Variáveis de ambiente | `ALLOWED_ORIGINS`, `BEZALEL_ENV`, `BEZALEL_DATA_FILE`, `LLM_API_KEY` (opcional, sem uso real). Nenhum valor secreto no repositório |
| Infraestrutura | Nenhuma VM em produção. Há `server/deploy/` (systemd, Caddy) pronto para uma instância única |

Desencontros entre a documentação e o código:
- o README do backend fala em 0.143.0, mas a máquina tem 0.137.2;
- `LLM_API_KEY` aparece no `.env.example`, mas nada a usa de fato.

## 2. Conceitos (cada um no seu lugar)

| Conceito | O que é | Onde |
|---|---|---|
| Agent Definition | Identidade, missão, ferramentas permitidas, nível de autonomia, limites, critérios de sucesso e de avaliação, política de recuperação, versão | `runtime/agents.py`; cópia de cada versão em `agent_definitions` |
| Task | Unidade de trabalho: objetivo, agente (e versão), entrada validada, estado, tentativas, resultado, erro, correlação, custo | tabela `tasks`, `runtime/store.py` |
| Execution | Uma tentativa concreta: worker, início, fim, passos, chamadas e tokens de modelo, custo, erro | tabela `executions` |
| Tool | Operação com contrato de entrada, nível e tempo limite. A única coisa que um agente faz | `runtime/tools.py`, `runtime/site_checks.py` |
| Event | Registro de cada mudança de estado, passo de ferramenta e resultado. Só se acrescenta | tabela `events` |
| Approval | Decisão humana registrada, presa ao hash de ação + parâmetros + destino | tabela `approvals`, `runtime/approvals.py` |
| Evaluation | Medida independente do trabalho, feita por outro código ou por uma pessoa, nunca pelo agente | tabela `evaluations`, `runtime/evaluation.py` |
| Schedule | Regra persistente de quando uma tarefa pode começar (intervalo de no mínimo 1 h) | tabela `schedules`, `runtime/schedules.py` |
| Business Metric | Indicador com fonte identificada e cálculo reproduzível. Nenhuma fonte de negócio está ligada: a lista é vazia | `runtime/metrics.py` (contrato) |

## 3. Arquitetura

```
 Torre Bezalel (frontend) ──lê──▶ GET /v1/runtime/tower ─┐        (só representa; não decide estado)
 Pessoa (CLI ou API, com token) ─▶ POST /v1/runtime/tasks │
                                                          ▼
                    ┌──────────────────── server/app/runtime ────────────────────┐
                    │ api.py (FastAPI)  auth.py (token, papel, local)            │
                    │ store.py (tarefas, execuções, eventos, transições)         │
                    │ approvals.py  evaluation.py  schedules.py  metrics.py       │
                    │ db.py (SQLite, WAL, migrações) ── var/runtime.db            │
                    └───────────────▲───────────────────────────┬────────────────┘
                                    │ pega a tarefa (posse)     │ grava eventos e resultado
                    ┌───────────────┴───────────────────────────▼────────────────┐
                    │ executor.py (worker): limites, recuperação, cancelamento    │
                    │   └─ site_agent.py (plano fixo) ─▶ tools.py ─▶ site_checks  │
                    │                                   └─▶ project.run_check (lista fixa)
                    │                                   └─▶ model.summarize (só com credencial)
                    │ llm.py: provedor de modelos (chave só no servidor, orçamento) │
                    └─────────────────────────────────────────────────────────────┘
```

A API não executa trabalho: ela registra pedidos e lê estado. O worker executa, com as ferramentas da
lista fixa.

## 4. O que é real, o que depende de credencial, o que é proposta

| | Situação |
|---|---|
| Registro de agentes, tarefas, execuções, eventos, aprovações, avaliações, agendamentos | **Real**, persistente, testado |
| Executor com posse, recuperação, tempo limite, tentativas com espera, cancelamento, desligamento gracioso | **Real**, testado e provado com um worker morto no meio de uma tarefa real (`AGENT-RUNTIME.md` › Prova) |
| API autenticada com papéis | **Real**. Fica fechada (503) até que tokens sejam configurados |
| Site Intelligence Agent | **Real**, somente leitura, sobre o build e as verificações do projeto. Avaliado: v1 com precisão de 0,625 (3 falsos positivos achados na revisão), v2 com 1,0 contra o mesmo gabarito |
| Resumo por modelo de IA | **Depende de credencial**: `BEZALEL_LLM_PROVIDER=anthropic`, a chave, os preços e o orçamento diário. Sem isso, o relatório registra "não rodou" |
| Aprovações | O **mecanismo** é real e testado. **Nenhuma ação externa** está ligada a ele |
| Painel da Torre lendo o runtime | O **endpoint** existe (`/v1/runtime/tower`). O frontend **ainda não o consome**: os painéis continuam com os dados de demonstração, marcados como tal |
| Business Metrics | Só o contrato. Nenhuma fonte de negócio ligada |
| Agentes de SEO ativo, conteúdo, anúncios, vendas, finanças | **Proposta**. Nada implementado nem ligado |

## 5. Lacunas de segurança e decisões

| Lacuna ou risco | Decisão agora | Para depois |
|---|---|---|
| O runtime aceita escrita pela rede | Escrita só da própria máquina, a menos que `BEZALEL_RUNTIME_ALLOW_REMOTE_WRITES=1` seja definido conscientemente | Atrás do Caddy com TLS, com tokens por pessoa e rotação |
| Sem tokens, o runtime ficaria aberto | Fechado por padrão (503) | — |
| Um agente pedindo mais permissão ou orçamento | Não existe caminho: definições, limites e tokens só mudam no código ou na configuração, por pessoa | Fluxo de mudança de definição com revisão |
| Comando de terminal a pedido do modelo | Não existe: só `npm run <script>` de uma lista fixa, sem shell, sem os segredos no ambiente filho, com tempo limite e matando a árvore de processos | — |
| Instrução maliciosa em conteúdo lido (HTML de páginas) | O conteúdo é tratado como dado. Nada nele é executado, e o modelo recebe o relatório como dado delimitado, com instrução explícita para ignorar instruções contidas | Ferramentas que leiam conteúdo de terceiros (coleta) passam pelo mesmo padrão e por uma lista de domínios |
| SQLite com vários workers em máquinas diferentes | Fora do escopo: uma instância, um worker | PostgreSQL com `SELECT … FOR UPDATE SKIP LOCKED` (`AGENT-RUNTIME.md` › Evolução) |
| Estado do limite de frequência em memória | Aceito: um processo de API | Limite no proxy ou num armazenamento compartilhado |

## 6. Próximos passos

1. Ligar o painel de Engenharia da Torre ao `/v1/runtime/tower`, com o modo demonstração como alternativa
   quando o backend estiver indisponível.
2. Rodar o Site Intelligence Agent sobre o build de produção (`npm run build:pages`) num agendamento
   diário, e avaliar cada execução contra a anterior (reprodutibilidade).
3. Publicar o runtime na VM (instância única, TLS, tokens por pessoa) **só com autorização**.
4. Segundo agente, ainda de nível A: uma conferência periódica das fontes do catálogo (o Vigia de
   verdade), usando os contratos de `src/domain/pipeline`.
5. Primeira ação de nível C, com aprovação: uma proposta de correção como *pull request* em rascunho,
   que uma pessoa revisa. Nunca publicação direta.
