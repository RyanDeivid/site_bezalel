# Operação dos agentes

Como rodar, configurar e operar o runtime no desenvolvimento local. A produção ainda não existe e só
entra com autorização.

## Primeiros passos (local)

```bash
cd server
python -m venv .venv && .venv/Scripts/activate     # Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q                                # 40 testes

python -m app.runtime.cli migrate                  # cria server/var/runtime.db
python -m app.runtime.cli enqueue site-intelligence                      # só o build (rápido)
python -m app.runtime.cli enqueue site-intelligence --check typecheck --check lint --check test
python -m app.runtime.cli worker --once            # recupera interrompidas e roda uma tarefa
python -m app.runtime.cli report <id-da-tarefa>    # o relatório em texto
python -m app.runtime.cli evaluate <id> [--previous <id>]   # avaliação independente (e reprodutibilidade)
python -m app.runtime.cli show <id>                # estado, execuções e eventos (JSON)
```

O agente lê `dist/`. Rode o build antes: `npm run build`, ou `npm run build:pages` para os endereços de
produção. O relatório diz quando o build é mais antigo que o código.

## API local

```bash
python -m app.runtime.cli token ryan admin         # mostra o token uma vez e a linha para o .env
# server/.env:  BEZALEL_RUNTIME_TOKENS=ryan:admin:<sha256>
uvicorn app.main:app --port 8100
curl -H "Authorization: Bearer <token>" http://localhost:8100/v1/runtime/tasks
```

Papéis: `reader`, `operator`, `approver`, `admin`. Dê a cada pessoa o menor que basta.

## Configuração (variáveis de ambiente do servidor)

| Variável | Para quê | Padrão |
|---|---|---|
| `BEZALEL_RUNTIME_DB` | Caminho do banco | `server/var/runtime.db` |
| `BEZALEL_RUNTIME_TOKENS` | `nome:papel:sha256`, separados por vírgula | vazio (runtime fechado) |
| `BEZALEL_RUNTIME_ALLOW_REMOTE_WRITES` | `1` libera escrita vinda da rede (só atrás de TLS) | desligado |
| `BEZALEL_LLM_PROVIDER` | `anthropic` para ligar o provedor | desligado |
| `ANTHROPIC_API_KEY` | Chave do provedor (só no servidor) | — |
| `BEZALEL_LLM_MODEL` | Modelo | `claude-sonnet-5` |
| `BEZALEL_LLM_PRICE_IN_PER_MTOK` / `_OUT_PER_MTOK` | Preço por milhão de tokens (US$), exigido para calcular o custo | 0 (provedor indisponível) |
| `BEZALEL_LLM_DAILY_BUDGET_USD` | Teto de gasto por dia | 0 (nenhuma chamada paga) |
| `BEZALEL_LLM_MAX_TOKENS`, `BEZALEL_LLM_TIMEOUT_S` | Limites da chamada | 800 e 60 |

Sem as variáveis do provedor, tudo funciona, exceto o resumo por modelo, que aparece como "não rodou".

## Agendamentos

```bash
python -m app.runtime.cli schedule site-intelligence --every-hours 24
```

- **Onde fica:** no banco. O worker em execução cria a tarefa quando vence.
- **Sem duplicar:** se a anterior ainda estiver ativa, não cria outra.
- **Intervalo:** no mínimo 1 h.
- **Nenhum serviço é instalado:** o worker roda enquanto um terminal o mantiver ligado. Torná-lo um
  serviço da máquina (`server/deploy/`) é decisão do proprietário.

## Aprovações

Nenhuma ação externa usa aprovações ainda. Quando uma usar:
1. A pessoa vê o pedido em `GET /v1/runtime/approvals`, com a ação, os parâmetros exatos, o destino, os
   riscos e os efeitos.
2. Ela decide: `POST /v1/runtime/approvals/{id}/decision`, com `{"approve": true|false, "note": "..."}`.
   O papel exigido é `approver`.
3. A ferramenta só age se a aprovação estiver concedida, dentro da validade, ainda não usada e com hash
   idêntico ao da ação.
4. Revogar a qualquer momento antes do uso: `POST …/revoke`.

## Retenção

```bash
python -m app.runtime.cli retention --dry-run      # o que seria apagado
python -m app.runtime.cli retention                # eventos de 90 dias, tarefas terminadas de 180, consumo de 400
```

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Tarefa parada em `running` | O worker morreu | Rode `worker --once` (ou `recover`): depois de a posse vencer (60 s), ela volta à fila, se o agente for idempotente |
| Tarefa em `queued` que não começa | Esperando o tempo de nova tentativa (`not_before`), ou nenhum worker rodando | `show <id>`; ligue um worker |
| `503` na API | `BEZALEL_RUNTIME_TOKENS` vazio | Gere um token com `cli token` |
| `403` numa escrita | Papel insuficiente, ou chamada vinda da rede | Use o papel certo, a partir da própria máquina |
| Resumo "não rodou" | Provedor, preço ou orçamento não configurados, ou orçamento esgotado | Configure, se quiser gastar; o resto do relatório não depende dele |
| `database is locked` | Outro processo segurou a escrita por mais de 10 s | Confira se há dois workers rodando comandos longos fora da transação. Não deveria acontecer: as transações são curtas |

## Monitoramento

- `GET /v1/runtime/metrics`: tarefas por estado, sucesso e duração em 30 dias, custo do dia e dos 30 dias,
  eventos de falha em 24 h.
- `GET /v1/runtime/status`: o último `worker.started` ou `worker.stopped`.
- Falha sempre vira evento (`result: failure`), nunca silêncio.
