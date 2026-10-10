# Roadmap

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
