import type { Agent } from '../../types/domain.ts';

/**
 * Perfis dos agentes. Os NOMES são provisórios e centralizados aqui para
 * serem alterados facilmente (a interface nunca escreve o nome à mão).
 *
 * Nesta versão TODOS os agentes estão em modo `demo`: suas atividades são
 * produzidas por uma simulação local e determinística no navegador. Nenhum
 * agente autônomo está em produção.
 */
export const demoAgents: Agent[] = [
  {
    id: 'scout',
    name: 'Scout',
    role: { 'pt-BR': 'Descoberta de oportunidades', en: 'Opportunity discovery' },
    description: {
      'pt-BR':
        'Consulta fontes autorizadas, identifica cursos, certificações e oportunidades e entrega registros brutos para normalização.',
      en: 'Queries authorized sources, identifies courses, certifications and opportunities, and hands raw records over for normalization.',
    },
    status: 'idle',
    mode: 'demo',
    taskTypes: [
      { 'pt-BR': 'Consultar fontes autorizadas', en: 'Query authorized sources' },
      { 'pt-BR': 'Identificar novas oportunidades', en: 'Identify new opportunities' },
      { 'pt-BR': 'Normalizar dados brutos', en: 'Normalize raw data' },
    ],
    dataSources: [
      { 'pt-BR': 'Fontes oficiais e APIs públicas autorizadas (futuro)', en: 'Official sources and authorized public APIs (future)' },
      { 'pt-BR': 'Fontes fictícias de demonstração (atual)', en: 'Fictional demo sources (current)' },
    ],
    limitations: [
      { 'pt-BR': 'Não acessa a internet: nesta versão lê apenas fixtures locais.', en: 'No internet access: in this version it only reads local fixtures.' },
      { 'pt-BR': 'Nunca coletará fontes sem permissão ou que proíbam automação.', en: 'Will never collect sources lacking permission or forbidding automation.' },
    ],
  },
  {
    id: 'verifier',
    name: 'Verifier',
    role: { 'pt-BR': 'Validação e qualidade', en: 'Validation & quality' },
    description: {
      'pt-BR':
        'Aplica critérios explícitos de validação, deduplica registros, atribui nota de qualidade e decide se um registro pode ser publicado.',
      en: 'Applies explicit validation criteria, deduplicates records, assigns a quality score and decides whether a record can be published.',
    },
    status: 'idle',
    mode: 'demo',
    taskTypes: [
      { 'pt-BR': 'Deduplicar por URL, identificador e título', en: 'Deduplicate by URL, identifier and title' },
      { 'pt-BR': 'Validar fonte, HTTPS, atualidade e conteúdo', en: 'Validate source, HTTPS, freshness and content' },
      { 'pt-BR': 'Calcular nota de qualidade', en: 'Compute quality score' },
      { 'pt-BR': 'Publicar ou rejeitar registros', en: 'Publish or reject records' },
    ],
    dataSources: [
      { 'pt-BR': 'Registros normalizados pelo Scout', en: 'Records normalized by Scout' },
      { 'pt-BR': 'Registro de confiança das fontes', en: 'Source trust registry' },
    ],
    limitations: [
      { 'pt-BR': 'Não confirma informações na fonte original nesta versão.', en: 'Does not confirm information at the original source in this version.' },
      { 'pt-BR': 'Critérios automáticos não substituem revisão humana.', en: 'Automatic criteria do not replace human review.' },
    ],
  },
  {
    id: 'vigia',
    name: 'Vigia',
    role: { 'pt-BR': 'Reconferência periódica', en: 'Periodic re-checking' },
    description: {
      'pt-BR':
        'Acompanha a idade de cada conferência: avisa quando um registro se aproxima de 180 dias sem confirmação na fonte, marca como desatualizado quando o prazo passa e o devolve ao Verifier para nova validação.',
      en: 'Tracks the age of every check: warns when a record nears 180 days without confirmation at the source, marks it outdated once the deadline passes and hands it back to Verifier for revalidation.',
    },
    status: 'idle',
    mode: 'demo',
    taskTypes: [
      { 'pt-BR': 'Calcular a idade de cada conferência', en: 'Compute the age of every check' },
      { 'pt-BR': 'Montar a fila dos próximos 30 dias', en: 'Build the next-30-days queue' },
      { 'pt-BR': 'Marcar desatualizados e devolver à validação', en: 'Mark outdated records and send them back to validation' },
    ],
    dataSources: [
      { 'pt-BR': 'Datas de conferência do catálogo curado (dado real)', en: 'Check dates of the curated catalog (real data)' },
      { 'pt-BR': 'Registros fictícios do pipeline (demonstração)', en: 'Fictional pipeline records (demonstration)' },
    ],
    limitations: [
      { 'pt-BR': 'Não abre a página da fonte: só calcula prazos a partir das datas registradas.', en: 'Does not open the source page: it only computes deadlines from the recorded dates.' },
      { 'pt-BR': 'A reconferência em si continua manual nesta versão.', en: 'The re-check itself is still manual in this version.' },
    ],
  },
  {
    id: 'atlas',
    name: 'Atlas',
    role: { 'pt-BR': 'Mapa de competências', en: 'Skills map' },
    description: {
      'pt-BR':
        'Organiza as relações entre competências, cursos e caminhos de aprendizado, formando um grafo navegável do conhecimento disponível.',
      en: 'Organizes relationships between skills, courses and learning paths into a navigable knowledge graph.',
    },
    status: 'idle',
    mode: 'demo',
    taskTypes: [
      { 'pt-BR': 'Relacionar cursos a competências', en: 'Link courses to skills' },
      { 'pt-BR': 'Identificar competências relacionadas', en: 'Identify related skills' },
    ],
    dataSources: [
      { 'pt-BR': 'Catálogo curado Bezalel', en: 'Bezalel curated catalog' },
      { 'pt-BR': 'Taxonomia de competências', en: 'Skills taxonomy' },
    ],
    limitations: [
      { 'pt-BR': 'Relações se baseiam na classificação da curadoria, não em avaliação de aprendizagem.', en: 'Relationships rely on curatorial classification, not learning assessment.' },
    ],
  },
  {
    id: 'trend',
    name: 'Trend',
    role: { 'pt-BR': 'Análise de tendências', en: 'Trend analysis' },
    description: {
      'pt-BR':
        'Analisa quais competências aparecem com mais frequência no catálogo e, no futuro, em fontes autorizadas de vagas e publicações.',
      en: 'Analyzes which skills appear most often in the catalog and, in the future, in authorized job and publication sources.',
    },
    status: 'idle',
    mode: 'demo',
    taskTypes: [
      { 'pt-BR': 'Contar competências no catálogo', en: 'Count skills in the catalog' },
      { 'pt-BR': 'Comparar períodos (quando houver histórico)', en: 'Compare periods (when history exists)' },
    ],
    dataSources: [
      { 'pt-BR': 'Catálogo curado (dado real)', en: 'Curated catalog (real data)' },
      { 'pt-BR': 'Série de menções demonstrativa (fictícia)', en: 'Demonstration mentions series (fictional)' },
    ],
    limitations: [
      { 'pt-BR': 'Não mede demanda de mercado: não há fonte de vagas conectada.', en: 'Does not measure market demand: no job source is connected.' },
      { 'pt-BR': 'Contagem de cursos não equivale a número de vagas.', en: 'Course counts are not equivalent to job counts.' },
    ],
  },
  {
    id: 'sol',
    name: 'Sol',
    role: { 'pt-BR': 'Assistente de navegação', en: 'Navigation assistant' },
    description: {
      'pt-BR':
        'Ajuda a encontrar cursos do catálogo, explica informações e sugere filtros, sempre apontando a fonte e avisando quando os dados não bastam.',
      en: 'Helps find catalog courses, explains information and suggests filters, always citing the source and warning when data is insufficient.',
    },
    status: 'idle',
    mode: 'demo',
    taskTypes: [
      { 'pt-BR': 'Buscar no catálogo', en: 'Search the catalog' },
      { 'pt-BR': 'Explicar cursos e verificações', en: 'Explain courses and verifications' },
      { 'pt-BR': 'Sugerir filtros e categorias', en: 'Suggest filters and categories' },
    ],
    dataSources: [
      { 'pt-BR': 'Catálogo local e regras transparentes', en: 'Local catalog and transparent rules' },
    ],
    limitations: [
      { 'pt-BR': 'Não há modelo de linguagem conectado: respostas vêm de regras locais.', en: 'No language model connected: answers come from local rules.' },
      { 'pt-BR': 'Não oferece aconselhamento profissional personalizado.', en: 'Does not provide personalized career advice.' },
    ],
  },
];
