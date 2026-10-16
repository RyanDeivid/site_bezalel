# Roadmap

## v2 — plano aprovado em 11/10/2026

Executado fase a fase; cada fase é publicada ao terminar.

| Fase | Escopo | Estado |
|---|---|---|
| 0 · Performance no celular | Pré-renderização completa + hidratação, dados no primeiro render, partículas em Web Worker, animações só de compositor, `content-visibility`, revelação ao rolar sem esconder o HTML, fontes pré-carregadas, home mais curta (trilhos deslizantes), barra de ações no celular, service worker, orçamento de tamanho e Lighthouse no CI | **Concluída** (medições em `ARCHITECTURE.md`) |
| 1 · "A Forja" | Animação 3D ao rolar: a estrutura da Bezalel construída em atos (faísca → descobrir → verificar → conectar → construir → entrar), com braços robóticos feitos em código, grafo real curso↔competência e personalização pelos interesses escolhidos (até 3 temas); modo em cartões para movimento reduzido/aparelho fraco/sem JS | **Concluída** |
| 2 · Catálogo ampliado | Catálogo e competências fora do JS inicial (chunk próprio pré-carregado); de 7 para **21 áreas em 7 temas** (saúde, educação física, nutrição, saúde mental, educação, idiomas, negócios, finanças, carreira, design, marketing, engenharia, agro e meio ambiente, gestão pública e direito); de 19 para **105 cursos reais** (Escola Virtual.Gov, Fundação Bradesco, Coursera), cada um conferido na página oficial; home, filtros, Insights e Forja organizados por temas | **Concluída** |
| 2b · "A origem" (Sobre) | Manivela que o visitante gira (arrastar, teclado, botões ou "girar para mim"): cada volta ergue um capítulo da história de Bezalel numa planta em canvas — nome, dons, materiais, o Tabernáculo com as medidas do texto, o ensino, as letras e o cubo que vira o símbolo; acessível (slider, movimento reduzido, lista sem JS) | **Concluída** |
| 3 · Laboratório 2.0 | Campus ~3× maior (raio 16 → 28 m) com 6 setores e entrada ao sul; robôs humanoides articulados feitos em código (pernas, braços, mãos com dedos) — operadores nos consoles e carregadores levando cada registro de setor em setor a cada evento; máquina própria e três monitores por setor; PBR com reflexos (mapa de ambiente procedural); bloom só em aparelho forte; novo agente **Vigia** (reconferência de 180 dias com as datas reais do catálogo); **tour guiado** pela Central e pelos setores; **"seguir um curso"**: um registro real passando pelas etapas, com os dados verdadeiros dele em cada parada (também a partir da página do curso); links diretos `/lab?setor=` e `/lab?curso=` | **Concluída** (medições em `ARCHITECTURE.md`) |
| 4 · Ferramentas | "Descubra sua trilha", trilhas com progresso, favoritos e comparador, planejador de estudos (.ics), calculadora de horas complementares, Ctrl+K, busca por voz, constelação de competências, trilha compartilhável | **Em andamento** — feito: "Descubra sua trilha" (4 perguntas → trilha de cursos reais, explicada e compartilhável por link), "Minha estante" (salvar + progresso, só no navegador), comparador de até 3 cursos, planejador de estudos (.ics), calculadora de horas complementares, paleta Ctrl+K e a aba "Constelação" (`/skills`: 104 competências ligadas pelos cursos que as ensinam juntas; a estante acende o que você já tem e sugere vizinhas). Falta: busca por voz (aguarda decisão de privacidade) |
| 5 · Psicologia aplicada (ética) | Pico-final, curiosidade, progresso, poucas escolhas por tela, polegar; prova social só com números reais — nada de escassez ou contador falso | **Concluída** (`docs/ETHICS.md`; medições em `ARCHITECTURE.md`) — guarda ética automática sobre todos os textos; pico-final ao concluir curso e trilha e um "Próximo passo" no fim das páginas internas (catálogo, curso, Insights, agentes, metodologia, Sobre); "Continue de onde parou" para quem volta; contagens reais ao vivo no questionário; filtros do catálogo com 7 temas que se abrem sob demanda e "Mais filtros"; barras na zona do polegar na home, no catálogo, no curso e na trilha; teste de que os números da home são contagens reais |
| 6 · Qualidade | Testes de tudo que for novo, auditoria de acessibilidade, documentação | **Em andamento** — auditoria automática WCAG 2.2 AA (axe-core) em todas as rotas, nos dois temas e tamanhos de tela, no CI; primeira rodada corrigida (contraste do texto secundário e das cores dos agentes, nomes acessíveis, rolagem por teclado, `<dl>`) — ver `docs/ACCESSIBILITY.md` |

---

Estado em 10/10/2026 (v1.0).

## Implementado

- Identidade visual: símbolo geométrico, logotipo, tokens de cor/tipografia/raio/elevação/movimento, temas claro e escuro.
- Home com abertura da marca, hero cinematográfico (partículas conectadas, núcleo geométrico, fluxos luminosos), busca e 11 seções.
- Catálogo com 19 registros reais verificados na fonte, busca com sinônimos pt/en, filtros que alteram resultados, ordenação, "carregar mais", visualização rápida e filtros na URL.
- Página de detalhe com "Não informado", nível inferido sinalizado, estado de verificação, fonte e relacionados; JSON-LD apenas para registros reais.
- Insights: competências por número de cursos, categorias, composição, grafo competência→curso, visão em tabela para todo gráfico.
- Agentes: perfis, estados derivados de eventos, diagrama de fluxo, trilha filtrável, painel lateral.
- Laboratório 3D (R3F): estações com robôs, telas de dados, Central de Operações holográfica, fluxos com pulsos por evento, teclado/clique/toque, câmera confortável, minimapa, prompt de proximidade, pausa de efeitos, qualidade adaptativa, fallback 2D completo.
- Assistente Sol com regras locais transparentes, citação de fonte e recusa explícita fora do escopo.
- Pipeline de validação real e testado (normalização, deduplicação, validação, qualidade, máquina de estados).
- i18n pt-BR/en, acessibilidade (navegação por teclado, foco visível, anúncio de rota, `<dialog>` nativo, movimento reduzido).
- HTML pré-gerado por rota, sitemap, robots, CSP, imagem Open Graph.
- 98 testes unitários/componentes, 36 cenários de navegador (desktop e mobile), CI e deploy no GitHub Pages.
- Backend de referência (FastAPI) com 13 testes e arquivos de deploy para Oracle Cloud.

## Parcialmente implementado

- **Modo API**: cliente HTTP, guards e canal SSE prontos; backend de referência serve catálogo e insights, mas não agentes nem menções.
- **Insights temporais**: visualização pronta; sem histórico real de coletas.
- **Internacionalização**: interface completa em inglês; descrições dos cursos apenas em português.
- **Métricas de desempenho**: orçamento de bundle medido; Core Web Vitals ainda não medidos em produção.

## Simulado

- Atividade dos agentes, eventos da Central de Operações e estados ativo/ocioso/com falha.
- Registros do pipeline (fontes e cursos fictícios em `example.org`).
- Série de menções por trimestre.

## Planejado

1. Publicar e medir Lighthouse/PageSpeed; ajustar LCP do hero se necessário.
2. Ampliar o catálogo curado (meta: 60+ registros) com reconferência trimestral.
3. Coletores reais no servidor para fontes com API oficial; persistência (Postgres/Supabase) e trilha de eventos real.
4. Reconferência automática com alerta de registros desatualizados.
5. Assistente com LLM no servidor (RAG sobre o catálogo), mantendo citação de fonte e recusa fora do escopo.
6. Páginas por competência e trilhas de aprendizagem sugeridas pelo Atlas.
7. Favoritos locais e comparação de cursos.
8. Descrições em inglês e URLs por idioma.
9. Revisão jurídica de privacidade e termos; definição da entidade responsável e da licença.

## Dependente de serviços externos

| Item | Depende de |
|---|---|
| Agentes autônomos, eventos reais, tempo real | Backend hospedado (ex.: VM Oracle Cloud) + banco |
| Indicador de vagas por competência | Fonte autorizada de anúncios de emprego |
| Série real de menções | Coleta autorizada e armazenamento histórico |
| Assistente com modelo de linguagem | Provedor de LLM e chave no servidor |
| Domínio próprio, HSTS e cabeçalhos HTTP | Registro de domínio/CDN |
| Analytics (se desejado) | Ferramenta com consentimento e atualização da política de privacidade |
