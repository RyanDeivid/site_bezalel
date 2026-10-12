# Design ético (v2 · Fase 5)

A Bezalel usa o que se sabe sobre atenção e motivação **a favor de quem
aprende** — nunca para empurrar decisões. A regra prática: todo recurso tem
que continuar honesto se o visitante souber exatamente como ele funciona.

## O que usamos

| Princípio | Onde | Como fica honesto |
|---|---|---|
| **Pico-final** (lembramos mais do auge e do fim) | Concluir um curso ("mais uma peça da sua construção"); concluir a trilha (resumo + próximo passo: aprofundar no tema ou montar outra); o resultado do questionário; o fim da Forja | O progresso é o que **o próprio visitante** marcou; o resumo usa as horas declaradas pelas fontes. Nada de confete em troca de clique |
| **Gradiente de meta** (perto do fim, a gente acelera) | "x de y concluídos · faltam n" na trilha; "Continue de onde parou" na home | Só aparece para quem já tem estante ou trilha **neste navegador**; quem chega pela primeira vez não vê nada inventado para "parecer ativo" |
| **Curiosidade com números reais** | No questionário, cada tema mostra quantos cursos tem, e as preferências mostram, ao vivo, quantos sobram | São contagens do catálogo verificado, recalculadas a cada escolha — e evitam o beco sem saída de uma trilha vazia |
| **Poucas escolhas por tela** (lei de Hick) | Questionário com uma pergunta por tela; 7 temas em vez de 21 áreas; comparador com no máximo 3 cursos | Sempre dá para voltar e mudar; nada é escondido para forçar um caminho |
| **Zona do polegar** | Barras de ação no rodapé do celular (home, curso, trilha), que só aparecem depois que as mesmas ações do topo saem da tela | Nunca cobrem conteúdo novo; somem no rodapé; não se repetem em telas grandes |
| **Prova social só com números reais** | "105 cursos verificados", instituições, datas de conferência | Não temos contas nem analytics: qualquer "N pessoas estão vendo" seria mentira — e é proibido |

## O que recusamos (e um teste garante)

`tests/unit/ethics.test.ts` percorre todos os textos da interface em pt-BR e
en — inclusive os gerados por funções — e falha se encontrar:

- **Escassez e urgência fabricadas**: "últimas vagas", "restam 3", "só hoje", "por tempo limitado", "corra", "não perca", "only 2 left", "hurry"…
- **Prova social inventada**: "N pessoas estão vendo", "mais vendido", "people are viewing"…
- **Confirmshaming**: recusas que envergonham ("Não, prefiro continuar sem aprender").

E, por desenho:

- **Sem contadores falsos** nem cronômetros de oferta.
- **Sem caixas pré-marcadas** nem opt-in escondido: preferências da trilha começam desmarcadas.
- **Sem armadilha de saída**: tudo o que a estante guarda dá para apagar ali mesmo; não há conta para "cancelar".
- **Sem rolagem infinita** nem reprodução automática que prenda: o tour do laboratório só avança sozinho se o visitante pedir, e pausa a qualquer momento.
- **Sem coleta**: estante, progresso e última trilha ficam só no navegador (ver Política de privacidade).

## Ao criar um recurso novo

1. Ele ainda funciona se o visitante souber como foi feito?
2. Os números são reais e conferíveis? Se não houver dado, mostre "Não informado" — não arredonde para cima.
3. Recusar é tão fácil quanto aceitar?
4. Alguém com movimento reduzido, leitor de tela ou só teclado recebe a mesma informação?
