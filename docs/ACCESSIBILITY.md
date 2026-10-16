# Acessibilidade (v2 · Fase 6)

Meta: **WCAG 2.2 nível AA** em todas as páginas, nos dois temas, no desktop e
no celular.

## O que é verificado automaticamente

`tests/e2e/a11y.spec.ts` roda o [axe-core](https://github.com/dequelabs/axe-core)
(regras WCAG 2.0, 2.1 e 2.2 A/AA) em toda rota pública — inclusive curso,
trilha pronta, comparador, constelação com competência aberta, 404 — nos temas
escuro e claro e nos projetos desktop e celular. Também audita estados que só
existem depois de uma interação: a paleta Ctrl+K com resultados e o menu do
celular aberto. A estante vem preenchida, para que as partes pessoais
("Continue de onde parou", constelação acesa, estante) também passem pela
auditoria.

Qualquer violação falha o CI, com a lista do que corrigir na mensagem.

Os testes de navegador também cobrem: anúncio de rota, foco visível, `<dialog>`
nativo, teclado na paleta (combobox + listbox), slider da manivela, movimento
reduzido e ausência de rolagem horizontal acidental.

## Primeira auditoria (15/10/2026)

58 de 80 combinações de página × tema × tela falhavam. Tudo foi corrigido:

| Problema | Onde | Correção |
|---|---|---|
| Contraste do texto secundário (4,0–4,4:1) | `--fg-subtle` em todo o site, nos dois temas | Novos valores: `#8f9aab` no escuro e `#526075` no claro — 4,5:1 ou mais em todas as superfícies, inclusive painéis translúcidos |
| Cores dos agentes como texto no tema claro (1,6–2,3:1) | Função de cada agente em `/agents` | Variantes escurecidas no tema claro (4,6:1 ou mais), mantendo o matiz |
| Selo "Verificado" no marfim (4,4:1) | Catálogo e curso | `--ok` claro → `#17604a` |
| Nome acessível diferente do texto visível | Buscar (cabeçalho), Salvar/Salvo, dias da semana do planejador, grafo competência→curso, lista da constelação | O nome passa a começar pelo texto visível (importa para quem usa comando de voz: "clicar em Salvo") |
| Área com rolagem sem acesso por teclado | Trilhos da home no celular, fluxo dos agentes, tabelas e diagrama da metodologia | `scrollRegion()` (`lib/scroll-region.ts`): `tabIndex=0`, `role="region"` e nome — as setas rolam a área |
| `<dl>` com `<p>` dentro | Escopo em `/insights` | Título fora da lista de definição |

## O que o automático não pega (conferir à mão a cada fase)

O axe encontra cerca de um terço dos problemas reais. Antes de publicar algo
novo, conferir:

1. **Só teclado**: dá para chegar a tudo, a ordem do foco faz sentido e o foco
   nunca some atrás do cabeçalho fixo ou de uma barra do polegar.
2. **Leitor de tela** (NVDA + Firefox/Edge no Windows; VoiceOver no iPhone): os
   rótulos fazem sentido fora de contexto, mudanças ao vivo são anunciadas
   (`aria-live`) sem repetir demais.
3. **Zoom de 200% e texto de 400%** (reflow a 320 px): nada cortado nem
   sobreposto.
4. **Movimento reduzido**: o sistema operacional e o botão do site desligam
   animações; nada importante depende de animação.
5. **Gráficos e cenas**: toda visualização tem a mesma informação em texto ou
   tabela (Insights: "ver em tabela"; laboratório: Central de Operações em 2D;
   constelação: lista por tema; Forja: modo em cartões).
6. **Cor nunca sozinha**: estados têm forma, ícone ou texto além da cor.

## Decisões de desenho

- **Gráficos interativos em SVG** (grafo de Insights, constelação): quando há
  dezenas de pontos, o mapa responde a ponteiro e a navegação por teclado fica
  na lista equivalente — 104 paradas de Tab num mapa seriam um labirinto.
- **Canvas 3D** (laboratório, Forja) fica fora da auditoria do axe; o conteúdo
  equivalente existe em HTML e é auditado.
