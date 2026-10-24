# Governança dos agentes operacionais

Regras para quando os agentes de produto do Bezalel (hoje Scout, Verifier, Vigia, Atlas, Trend e Sol, e
os futuros dos setores da Torre) passarem a executar tarefas de verdade. **Hoje nenhum executa nada fora
do navegador do visitante**: todos estão em modo de demonstração (`mode: 'demo'`), e a Torre só os
representa.

A representação visual (o robô na Torre, o painel do setor) é separada do serviço que executa. A tela não
decide o estado do agente: ela lê o estado de uma fonte própria (`SectorStatus`, ver
`BEZALEL-TOWER-ARCHITECTURE.md`). Um agente não "fica pronto" porque ganhou um andar.

## Níveis de autonomia

O nível é dado pelo **risco da ação**, não pelo setor. Um agente pode ter ações de níveis diferentes.

| Nível | O que pode | Exemplos | Exige |
|---|---|---|---|
| 0 | Representação e demonstração | Robôs da Torre, simulação do laboratório | Marcar como demonstração |
| 1 | Consultar e analisar, sem ação externa | Ler fontes autorizadas, resumir, classificar | Fontes listadas e registro do que foi lido |
| 2 | Tarefas internas controladas e reversíveis | Preparar um rascunho, atualizar um registro interno com histórico | Desfazer disponível, registro de auditoria, limites de execução |
| 3 | Ações externas com aprovação humana | Publicar um conteúdo, enviar um e-mail, abrir uma tarefa num serviço de terceiros | Aprovação explícita de uma pessoa a cada ação, com o conteúdo exato à vista |
| 4 | Automações recorrentes limitadas | Um relatório semanal publicado sozinho | Autorização por escrito, escopo fechado, monitoramento, alertas, revogação a qualquer momento |

Atividade jurídica, financeira ou de saúde nunca passa do nível 2 sem revisão de profissional habilitado.
A IA organiza e analisa; ela não substitui o profissional.

## Em código (runtime, desde 23/10/2026)

Os níveis desta página são aplicados pelo runtime de agentes (`server/app/runtime`, ver
`AGENT-RUNTIME.md` e `AGENT-TOOLS.md`). Lá eles se chamam A (consulta; nível 1 daqui), B (mudança interna
reversível; 2), C (ação externa com aprovação; 3) e D (recorrente autorizada; 4). O nível 0 não roda no
runtime: é a representação visual, no frontend.

| Requisito | Onde é aplicado |
|---|---|
| Nível pelo risco da ação | Cada ferramenta tem um nível; o servidor recusa a ferramenta acima da autonomia do agente (`call_tool`) |
| Permissões mínimas | Cada definição de agente lista as ferramentas dela; fora da lista, recusa e evento `tool.denied` |
| O agente não aumenta o próprio nível, permissões nem orçamento | Não existe rota nem ferramenta para isso: definições, limites e tokens só mudam por código ou configuração, por pessoa |
| Autenticação e autorização | Token por pessoa, guardado só como hash; papéis por ação (reader, operator, approver, admin); fechado sem tokens |
| Auditoria | Toda transição, chamada de ferramenta e decisão vira evento, na mesma transação da mudança |
| Custos e limites | Tempo, passos, tentativas, chamadas de modelo e custo por tarefa e por dia, conferidos antes da chamada |
| Aprovação de ação externa | Presa ao hash de ação + parâmetros + destino, com validade, uso único e revogação; agente não aprova |
| Segredos | Só em variáveis do servidor; o processo filho dos comandos não os recebe |
| Retenção | `cli retention` (eventos 90 dias, tarefas 180, consumo 400) |
| Avaliação independente | O agente não avalia o próprio trabalho (`record_evaluation` recusa avaliador `agent:`) |

O primeiro funcionário real, o Site Intelligence Agent, é de nível A: só lê o build e roda verificações da
lista fixa do projeto. Os agentes de produto do site (Scout e os demais) continuam em demonstração.

## Requisitos (a partir do nível 1)

| Tema | Requisito |
|---|---|
| Autenticação e autorização | Cada agente tem identidade própria e permissões por ação. Nenhuma credencial é compartilhada entre agentes |
| Permissões mínimas | O agente só acessa as fontes e ferramentas da tarefa dele; a lista é revisada a cada mudança |
| Segregação de dados | Dados de demonstração, de teste e reais ficam em lugares separados, e o agente sabe em qual está |
| Auditoria | Toda ação gera um evento: quem, o quê, quando, com quais dados, resultado. O registro é imutável (o `AgentEvent` do pipeline já segue esse modelo) |
| Custos | Teto por agente e por período (chamadas de modelo, APIs pagas), com alerta antes do teto e parada no teto |
| Limites de execução | Tempo máximo, número máximo de passos e de itens por execução. Nada de laço sem fim |
| Erros | Falha vira evento visível (`agent.error`). A execução segue ou para de forma segura, nunca em silêncio |
| Ações externas | Nível 3: fila de aprovação com o conteúdo exato. Nada sai sem um "sim" registrado |
| Revogação | Desligar um agente ou uma permissão vale na hora e fica registrado |
| Segredos | Num cofre do servidor, nunca no navegador, no repositório ou no prompt. Rotação periódica |
| Privacidade e LGPD | Base legal definida, coleta mínima, prazo de retenção, atendimento ao titular. Nada de dado pessoal em logs de modelo |
| Revisão humana | Obrigatória no nível 3 e em todo tema regulado (jurídico, saúde, finanças) |

## O que nunca fazer

- Mostrar como concluída uma tarefa que não foi executada.
- Criar um agente "operacional" na interface sem o serviço por trás.
- Ligar pagamento, publicação em contas externas ou automação comercial sem um pedido específico do
  proprietário.
