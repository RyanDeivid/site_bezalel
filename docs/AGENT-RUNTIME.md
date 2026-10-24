# Runtime de agentes

O código está em `server/app/runtime/` (Python, FastAPI, SQLite da biblioteca padrão; nenhuma
dependência nova). Os testes estão em `server/tests/test_runtime.py`.

## Armazenamento

- **Banco:** SQLite em `server/var/runtime.db` (configurável por `BEZALEL_RUNTIME_DB`). Fica fora do
  frontend e dos dados de demonstração, e o git o ignora.
- **WAL e espera:**
  - `journal_mode=WAL`: leitores não bloqueiam o escritor;
  - `busy_timeout=10 s`: dois processos esperam um ao outro em vez de falhar;
  - `foreign_keys=ON`.
- **Transações explícitas:** `BEGIN IMMEDIATE` pega a trava de escrita na hora. Toda mudança de estado e o
  evento que a descreve vão na mesma transação.
- **Migrações versionadas:** a tabela `schema_version` e a lista `MIGRATIONS` em `db.py`. Uma migração
  aplicada nunca se edita; cria-se a próxima.
- **Por que SQLite:** uma instância, um processo de API e um worker, o mesmo padrão de implantação do
  backend. Os testes provam que dois workers concorrentes não pegam a mesma tarefa.

## Estados da tarefa

```
queued ──▶ running ──▶ succeeded
  │          │ │ └──▶ failed
  │          │ └────▶ queued          (nova tentativa, com espera; ou desligamento do worker)
  │          └──────▶ waiting_approval ──▶ queued | cancelled | failed
  └──────────────────▶ cancelled
```

`succeeded`, `failed` e `cancelled` são finais. Nenhuma transição sai deles; para repetir, cria-se uma
tarefa nova, com o mesmo `correlation_id` se for o caso. Uma transição inválida levanta
`InvalidTransition`.

## Executor (worker)

| Garantia | Como |
|---|---|
| Sem execução duplicada | A tarefa é pega com uma posse (`lease_owner`, `lease_until`) numa transação de escrita, e o UPDATE só vale se o estado ainda for `queued`. A posse é renovada a cada passo. Teste: dois workers em threads, um só ganha |
| Sem duplicar quem pede | `dedupe_key`: pedir de novo, com a anterior ainda ativa, devolve a mesma tarefa (índice único parcial) |
| Recuperação | Posse vencida quer dizer worker morto. `recovery='retry'` (agente idempotente) volta à fila e gasta uma tentativa; `'manual'` termina `failed` à espera de uma pessoa. Rodar a recuperação duas vezes não muda nada |
| Tempo limite | `timeout_s` da execução, conferido entre passos e repassado aos comandos (que são encerrados com a árvore de processos) |
| Tentativas | `max_attempts`, com espera exponencial (`backoff_base_s · 2^(n-1)`, até 1 h) |
| Passos | `max_steps` por execução: o plano é fixo e não há laço que chame o modelo para "melhorar a resposta" |
| Cancelamento | Na fila: na hora. Rodando: no próximo passo seguro, nunca no meio de uma ferramenta |
| Desligamento gracioso | Ctrl+C ou SIGTERM: a tarefa em curso para no próximo passo e volta à fila sem gastar tentativa |
| Concorrência | Uma tarefa por vez por worker e `max_running_per_agent` (1) por agente |
| Erros permanentes | Ferramenta não permitida, entrada inválida e orçamento estourado não são tentados de novo |

## Provedor de modelos

`llm.py` tem a abstração `ModelProvider` e o `AnthropicProvider` (Messages API, por `urllib`).

- **A chave fica só no servidor** (`ANTHROPIC_API_KEY`). Nunca em `VITE_*`, no frontend ou no repositório.
- **Disponível só com tudo configurado:** provedor, chave, preço por milhão de tokens (entrada e saída) e
  orçamento diário maior que zero. Sem isso, `available()` é falso e a etapa que depende do modelo
  registra "não rodou". **Nada é simulado.**
- **Antes da chamada:**
  - o custo máximo estimado (entrada + o teto de saída) precisa caber no orçamento da tarefa
    (`max_cost_usd`) e no do dia;
  - há um limite de chamadas por execução (`max_model_calls`).
- **Depois da chamada:** modelo, tokens e custo vão para `usage_ledger` e para a execução.
- **Falhas:** HTTP 429 e 5xx viram `ModelError(retryable=True)`; resposta fora do formato é recusada.

## API (`/v1/runtime`)

Todas as rotas exigem `Authorization: Bearer <token>` e um papel. Sem tokens configurados, a resposta é
503.

| Rota | Papel | O que faz |
|---|---|---|
| `GET /status` | reader | Versão do esquema, provedor disponível?, último evento do worker |
| `GET /agents` | reader | Definições, com a disponibilidade calculada |
| `POST /tasks` | operator (escrita) | Cria tarefa. A entrada é validada pelo esquema do agente (422 se inválida; 404 para agente desconhecido) |
| `GET /tasks` | reader | Lista paginada (`limit` ≤ 200, `offset`), sem o relatório |
| `GET /tasks/{id}` | reader | A tarefa com o relatório |
| `GET /tasks/{id}/executions` | reader | As tentativas |
| `POST /tasks/{id}/cancel` | operator (escrita) | Cancela; 409 se já terminou |
| `GET /events` | reader | Trilha paginada por cursor (`after`, `limit` ≤ 500), filtrável por tarefa |
| `GET /approvals`, `POST /approvals/{id}/decision`, `POST /approvals/{id}/revoke` | reader / approver (escrita) | Aprovações |
| `GET /metrics` | reader | Indicadores operacionais (ambiente `live`) |
| `GET /evaluations` | reader | Avaliações registradas |
| `GET /tower` | reader | O que o painel de um setor da Torre pode mostrar: só dados reais do runtime |

- **Escritas:** só da própria máquina, salvo `BEZALEL_RUNTIME_ALLOW_REMOTE_WRITES=1`, e com limite de 30
  por minuto por token.
- **O que não existe na API:** rota que execute código, comando ou ferramenta livre.

## Ambientes `live` e `test`

Tarefas e eventos guardam o ambiente: os testes gravam `test`, e os indicadores e a Torre contam só
`live`. A trilha do runtime nunca aceita `demo`: os dados de demonstração do frontend são outra fonte,
sempre marcada.

## Prova (23/10/2026, repositório real, ambiente `live`)

1. Enfileirada uma tarefa do Site Intelligence Agent com typecheck, lint, test, check:models e
   check:budget.
2. Worker iniciado. Na terceira verificação do projeto, o worker foi **morto à força** com a árvore de
   processos (`taskkill /F /T`, 20 processos).
3. A tarefa ficou `running`, com a posse válida. Um worker novo (`worker --once`) **não a pegou**: não
   houve execução duplicada.
4. Depois que a posse venceu, o worker novo recuperou a tarefa (`task.queued` "execução interrompida") e
   a executou de novo. Ela terminou `succeeded` na tentativa 2, em 80,5 s, com 10 verificações e 8 achados.
   - execução 1: `interrupted`;
   - execução 2: `succeeded`.
5. A revisão humana do relatório, achado a achado, encontrou 3 falsos positivos (precisão 0,625). Eles
   foram corrigidos na v2 do agente, que alcançou precisão 1,0 e revocação 1,0 contra o mesmo gabarito
   (1,3 s, sem as verificações do projeto). As duas avaliações estão gravadas em `evaluations`.

## Testes

`cd server && python -m pytest -q`: os 13 testes da API de catálogo e os do runtime. Cobrem:
- registro de agentes;
- validação de tarefas, transições válidas e inválidas;
- persistência depois de reinício;
- dois workers concorrentes;
- recuperação idempotente e recuperação manual;
- tempo limite de comando e de execução, tentativas com espera;
- cancelamento e desligamento;
- ferramenta fora da lista e nível acima da autonomia;
- ausência de credenciais e falha do provedor;
- custo e orçamento (antes da chamada e no dia);
- aprovação expirada, revogada, com parâmetros diferentes, usada duas vezes e "aprovada" por agente;
- agendamento sem duplicar;
- autenticação e autorização por ação, escrita remota recusada;
- execução completa do agente contra um site de teste com problemas conhecidos (precisão, revocação,
  reprodutibilidade) e o caso sem build, que não inventa nada;
- separação entre demonstração e operação.

## Evolução

- **Vários workers ou máquinas:** PostgreSQL. Pegar a tarefa com `SELECT … FOR UPDATE SKIP LOCKED`, a
  mesma posse e o mesmo esquema. As migrações viram arquivos SQL, e o contrato de `store.py` não muda.
- **Paralelismo dentro de uma execução:** só com ferramentas sem efeito colateral e com um limite de
  concorrência no executor.
- **Comparar versões:** as avaliações já guardam `agent_version`; um relatório de regressão compara as
  médias por versão.
