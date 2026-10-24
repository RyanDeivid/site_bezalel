# Ferramentas dos agentes

Uma ferramenta é a única forma de um agente agir. Cada uma tem:
- nome;
- nível (A, B, C ou D, ver `AGENT-GOVERNANCE.md`);
- contrato de entrada (Pydantic, validado no servidor a cada chamada);
- tempo limite;
- implementação.

O registro está em `server/app/runtime/tools.py`.

## A porta única: `call_tool`

A cada chamada, o servidor confere, na ordem:
1. A ferramenta existe **e** está na lista `tools` da definição do agente. Se não, `ToolNotAllowed`, com
   um evento `tool.denied`.
2. O nível dela não passa do nível de autonomia do agente. Se passar, `ToolNotAllowed`.
3. Não há cancelamento nem desligamento pedidos (senão, `Cancelled`), e os passos não estouraram
   `max_steps`.
4. Ainda há tempo na execução (senão, `ToolTimeout`).
5. A entrada é válida pelo contrato (senão, `ToolInputError`).

Depois, registra `tool.started`, executa e registra `tool.finished` ou `tool.failed`, com a duração e o
estado.

## As ferramentas de hoje (todas de nível A)

| Ferramenta | Faz | Lê | Limite |
|---|---|---|---|
| `site.build_artifacts` | Confere `index.html`, os assets e a data do build contra o código-fonte | `dist/`, datas de `src/` | 30 s |
| `site.pages_meta` | Título, descrição, canonical, idioma, robots e duplicados por página | HTML de `dist/` | 60 s |
| `site.sitemap_robots` | sitemap.xml e robots.txt contra as páginas do build | `dist/` | 30 s |
| `site.internal_links` | Links internos com destino no build. Os externos só são contados, nunca acessados | HTML de `dist/` | 60 s |
| `site.a11y_static` | Imagem sem alt, h1, botões e links sem nome no HTML pré-renderizado | HTML de `dist/` | 60 s |
| `project.run_check` | Um script da lista fixa: `typecheck`, `lint`, `test`, `check:models`, `check:budget` | o repositório | 120–900 s |
| `model.summarize` | Resumo em texto do relatório | o relatório (dado) | 90 s, 1 chamada, orçamento |

**Estados de uma verificação:**
- `passed`: rodou, sem problema relevante;
- `failed`: rodou e achou problema, com evidência;
- `not_run`: não pôde rodar, com o motivo (sem build, sem npm, sem tempo, sem credencial);
- `error`: começou e não terminou, com o motivo (tempo limite, exceção).

## O comando de terminal (`project.run_check`)

- O nome do script é um `Literal` do contrato; o argv é montado pelo servidor (`[npm, "run", script]`).
- `shell=False`: nada é interpretado por um shell.
- As variáveis com KEY, TOKEN, SECRET, PASSWORD, CREDENTIAL ou AUTH no nome não vão para o processo filho.
- O processo roda num grupo próprio. No tempo limite, a árvore inteira é encerrada (`taskkill /T` no
  Windows, `killpg` no Linux).
- A saída é truncada (6 kB) antes de ir para o relatório.
- Nada que o projeto rode altera arquivos versionados. `build` fica de fora, porque escreve `dist/`.

## Conteúdo externo e instruções maliciosas

- O HTML lido é dado. O analisador só extrai atributos e texto, e nada é executado nem seguido.
- Para o modelo, o relatório vai delimitado (`<relatorio>…</relatorio>`), com instrução de sistema para
  ignorar instruções dentro dele.
- A saída do modelo nunca vira ação: é texto, limitado a 4.000 caracteres, marcado como gerado por modelo
  e separado dos achados.
- Ferramentas futuras que leiam conteúdo de terceiros seguem o mesmo padrão e ganham uma lista de
  domínios permitidos.

## Como acrescentar uma ferramenta

1. Defina o contrato de entrada (Pydantic) com os campos mínimos e os limites de tamanho.
2. Escolha o nível pelo **risco da ação**:
   - A: só lê;
   - B: muda algo interno e reversível, com histórico;
   - C: ação externa, exige aprovação;
   - D: recorrente e autorizada.
3. Implemente sem caminho arbitrário vindo da tarefa: confine as leituras ao repositório ou a uma pasta
   isolada.
4. Nível C: a ferramenta recebe um `approval_id` e chama `approvals.consume(...)` com a ação, os
   parâmetros e o destino exatos antes de agir; depois, `record_execution_result`.
5. Acrescente ao `TOOLS` e à lista `tools` só dos agentes que precisam dela.
6. Escreva testes: o caso feliz, a entrada inválida, o tempo limite, a negação de permissão e, no nível C,
   a aprovação expirada ou diferente.
