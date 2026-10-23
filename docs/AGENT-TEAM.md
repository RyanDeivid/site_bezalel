# Equipe de desenvolvimento (subagentes do Claude Code)

Agentes que ajudam a **construir** o Bezalel. Ficam em `.claude/agents/` (um arquivo por agente: nome,
descrição, ferramentas e instruções). **Não são os agentes de produto do site** (Scout, Verifier, Vigia,
Atlas, Trend e Sol, descritos em `docs/AGENTS.md`), que são personagens e serviços do produto, hoje em
modo de demonstração.

## Os oito

| Agente | Arquivo | Faz | Ferramentas |
|---|---|---|---|
| Chief Architect | `chief-architect.md` | Decisões que cruzam sistemas, plano incremental, coordenação, registro das decisões | leitura, busca, terminal, edição |
| Art Director | `art-director.md` | Identidade, composição, materiais, luz; revisa a partir de capturas | leitura, busca, terminal (capturas) |
| Blender Specialist | `blender-specialist.md` | Modelagem e exportação por scripts, validação de ativos e licenças | leitura, busca, terminal, edição |
| World Architect | `world-architect.md` | Cidade, edifícios, interiores, Torre: escala, circulação, colisões | leitura, busca, terminal, edição |
| Graphics Engineer | `graphics-engineer.md` | Renderização, LOD, carregamento, memória, desempenho medido | leitura, busca, terminal, edição |
| Experience Designer | `experience-designer.md` | Navegação, interação, HUD, toque, acessibilidade | leitura, busca, terminal, edição |
| QA & Security | `qa-security.md` | Testes, integridade, dependências, permissões, privacidade | leitura, busca, terminal, edição (testes) |
| Technical Mentor | `technical-mentor.md` | Explica o que foi feito ao proprietário, passo a passo | só leitura |

Permissões mínimas: quem só revisa ou explica não edita. Nenhum agente faz commit, push, publicação ou
instalação sem a autorização do proprietário (a regra está no arquivo de cada um e vale acima dele).

## Protocolo de colaboração

1. **O Chief Architect coordena.** Lê o estado real (git, docs, código), propõe a menor mudança segura e
   escolhe os especialistas da tarefa. Nem toda tarefa usa todos.
2. **Análise em paralelo, edição coordenada.** Especialistas podem investigar ao mesmo tempo; dois nunca
   editam o mesmo arquivo ao mesmo tempo. Trabalho isolado (experimentos) vai numa árvore de trabalho
   separada (`git worktree`) ou numa pasta temporária.
3. **Prova antes de "pronto".** Cada especialista entrega a evidência: teste, captura ou medição (ver
   `docs/BEZALEL-STUDIO-STANDARD.md`). O QA & Security confere antes da publicação.
4. **O Technical Mentor fecha.** Depois de uma entrega relevante, explica ao proprietário o problema, a
   solução, os arquivos, os conceitos, como validar, as limitações e o que estudar em seguida.

### Quem chamar

| Tarefa | Especialistas |
|---|---|
| Novo andar ou setor na Torre | World Architect → Experience Designer → Graphics Engineer → QA |
| Modelo 3D de artista | Blender Specialist → Graphics Engineer (orçamento, LOD) → Art Director → QA |
| Lentidão num aparelho | Graphics Engineer (medição) → Chief Architect (se mexer em mais de um sistema) |
| Revisão visual de um ambiente | Art Director (com capturas) |
| Dependência ou integração nova (inclusive MCP) | QA & Security → Chief Architect → decisão do proprietário |

## Como usar

No Claude Code, peça pelo nome ("use o graphics-engineer para medir...") ou deixe o agente principal
escolher pela descrição. Para ver e editar os agentes: comando `/agents`.

**Situação (23/10/2026):** os arquivos seguem o formato documentado do Claude Code 2.1. O reconhecimento
pelo `/agents` não foi conferido nesta sessão, que roda sem terminal interativo: confira ao abrir uma
sessão nova no repositório.
