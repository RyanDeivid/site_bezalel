import { normalizeText, tokenize } from '@/lib/text';
import type { CategoryId, Course, Level, OpportunityType, PriceType } from '@/types/domain';
import { explorePath } from '../catalog/query-params';
import type { CatalogQuery, CatalogResult } from '../catalog/search';

/**
 * Motor de respostas do Sol — REGRAS LOCAIS E TRANSPARENTES.
 *
 * Não há modelo de linguagem aqui. Cada resposta informa a regra que a
 * produziu (`rule`). Quando os dados do catálogo não bastam, o Sol diz isso
 * em vez de improvisar. Integração futura com LLM: services/assistant/http.ts.
 */

export interface EngineStrings {
  greeting: string[];
  help: string[];
  platform: { verification: string[]; agents: string[]; lab: string[]; demo: string[]; sources: string[] };
  outOfScope: { career: string[]; realtime: string[]; jobs: string[] };
  results: (count: number, shown: number) => string;
  resultsFiltersApplied: (labels: string) => string;
  noResults: string[];
  courseIntro: (title: string, provider: string) => string;
  courseField: {
    price: (value: string) => string;
    certificate: (value: string) => string;
    duration: (value: string) => string;
    level: (value: string) => string;
    prerequisites: (value: string) => string;
    notStated: (field: string) => string;
    verified: (date: string, status: string) => string;
  };
  fieldNames: { price: string; certificate: string; duration: string; level: string; prerequisites: string };
  suggestions: {
    openExplore: string;
    openFiltered: string;
    browseCategory: (name: string) => string;
    methodology: string;
    agents: string;
    lab: string;
    freeCourses: string;
    withCertificate: string;
    openCourse: (title: string) => string;
  };
  rules: Record<'greeting' | 'help' | 'platform' | 'out-of-scope' | 'course-detail' | 'catalog-search' | 'no-results', string>;
}

export interface EngineContext {
  strings: EngineStrings;
  courses: Course[];
  search: (query: CatalogQuery) => CatalogResult;
  labels: {
    category: Record<CategoryId, string>;
    level: Record<Level, string>;
    price: Record<PriceType, string>;
    certificate: Record<string, string>;
    verification: Record<string, string>;
    duration: (value: number, unit: NonNullable<Course['duration']>['unit']) => string;
    formatDate: (iso: string) => string;
  };
}

export interface EngineReply {
  kind: 'answer' | 'insufficient-data' | 'out-of-scope' | 'greeting' | 'help';
  rule: keyof EngineStrings['rules'];
  paragraphs: string[];
  courses: Course[];
  suggestions: Array<{ label: string; to: string }>;
  sources: Array<{ name: string; url: string }>;
}

const has = (text: string, re: RegExp) => re.test(text);

const CATEGORY_KEYWORDS: Array<[RegExp, CategoryId]> = [
  [/\b(ia|ai|inteligencia artificial|artificial intelligence|machine learning|aprendizado de maquina|deep learning|llm|agentes de ia|ai agents)\b/, 'ai-ml'],
  [/\b(web|html|css|javascript|front.?end|full.?stack|react)\b/, 'web-development'],
  [/\b(dados|data|planilha|excel|analise de dados|data analysis)\b/, 'data'],
  [/\b(seguranca|security|privacidade|privacy|lgpd)\b/, 'security-privacy'],
  [/\b(linux|nuvem|cloud|infraestrutura|redes|networking)\b/, 'cloud-infra'],
  [/\b(governo|government|setor publico|public sector)\b/, 'digital-government'],
  [/\b(saude mental|mental health|ansiedade|anxiety|bem.?estar|well.?being|felicidade|happiness|emocional|emotional|mindfulness)\b/, 'mental-health'],
  [/\b(educacao fisica|physical education|exercicio\w*|exercise|esporte\w*|sports?|fitness|atividade fisica)\b/, 'physical-education'],
  [/\b(nutricao|nutrition|alimentacao|alimentos|food|dieta|diet|culinaria|cooking)\b/, 'nutrition'],
  [/\b(financ\w*|dinheiro|money|investiment\w*|invest\w*|orcamento|budget)\b/, 'finance'],
  [/\b(saude|health|sus|epidemiologia|epidemiology|vigilancia sanitaria)\b/, 'health'],
  [/\b(professor\w*|teacher\w*|docencia|teaching|pedagog\w*|educacao|education|aprender a aprender|learning how to learn)\b/, 'education'],
  [/\b(idioma\w*|language\w*|ingles|mandarim|chines|chinese|libras|portugues|gramatica|grammar)\b/, 'languages'],
  [/\b(empreend\w*|entrepreneur\w*|negocio\w*|business|startup|gestao de projetos|project management|scrum|agil|agile)\b/, 'business'],
  [/\b(carreira|career|lideranca|leadership|negociacao|negotiation|emprego|job|curriculo|resume)\b/, 'career'],
  [/\b(design|ux|experiencia do usuario|user experience|design grafico|graphic design)\b/, 'design'],
  [/\b(marketing|comunicacao|communication|redes sociais|social media|marca|brand)\b/, 'marketing'],
  [/\b(engenharia|engineering|industria|industry|obras|construction|bim|energia|energy)\b/, 'industry'],
  [/\b(agro|agricultura|agriculture|meio ambiente|environment|clima|climate|sustentab\w*|sustainab\w*|agua|water)\b/, 'agro-environment'],
  [/\b(licitac\w*|procurement|direito|law|lei|etica|ethics|transparencia|transparency|direitos humanos|human rights)\b/, 'public-admin-law'],
];

/** Palavras que indicam intenção, mas não devem virar termo de busca. */
const INTENT_WORDS = new Set([
  'quero', 'queria', 'gostaria', 'procuro', 'busco', 'buscar', 'encontrar', 'encontre', 'achar', 'tem', 'tenho', 'existe', 'existem', 'algum',
  'alguma', 'alguns', 'algumas', 'me', 'mostre', 'mostra', 'liste', 'listar', 'indique', 'recomende', 'sugira', 'aprender', 'estudar', 'fazer',
  'gratuito', 'gratuitos', 'gratuita', 'gratuitas', 'gratis', 'free', 'certificado', 'certificados', 'certificacao', 'certificacoes', 'certificate',
  'certification', 'iniciante', 'iniciantes', 'beginner', 'beginners', 'basico', 'intermediario', 'intermediate', 'avancado', 'advanced', 'zero',
  'portugues', 'portuguese', 'ingles', 'english', 'online', 'want', 'find', 'show', 'learn', 'looking', 'any', 'some', 'trilha', 'trilhas', 'path',
  'opcoes', 'opcao', 'options', 'pago', 'pagos', 'paid', 'please', 'favor', 'quais', 'qual', 'which', 'what', 'onde', 'where', 'como', 'how', 'pra',
]);

interface ParsedIntent {
  query: CatalogQuery;
  terms: string[];
  appliedLabels: string[];
  portugueseOnly: boolean;
}

export function parseIntent(question: string, ctx: EngineContext): ParsedIntent {
  const t = normalizeText(question);
  const query: CatalogQuery = { sort: 'relevance', pageSize: 6 };
  const applied: string[] = [];

  if (has(t, /\b(gratuit\w*|gratis|free|sem custo|de graca)\b/)) {
    query.priceTypes = ['free', 'free-with-paid-certificate'];
    applied.push(ctx.labels.price.free);
  } else if (has(t, /\b(pago|pagos|paid)\b/)) {
    query.priceTypes = ['paid', 'varies'];
    applied.push(ctx.labels.price.paid);
  }
  if (has(t, /\b(certificado\w*|certificate\w*)\b/)) {
    query.withCertificate = true;
    applied.push(ctx.strings.fieldNames.certificate);
  }
  if (has(t, /\b(certificacao|certificacoes|certification)\b/)) {
    query.types = ['certification' as OpportunityType];
  }
  if (has(t, /\b(iniciante\w*|beginner\w*|basico|do zero|from scratch|introdut\w*)\b/)) {
    query.levels = ['beginner', 'all-levels'];
    applied.push(ctx.labels.level.beginner);
  } else if (has(t, /\b(intermediario|intermediate)\b/)) {
    query.levels = ['intermediate', 'all-levels'];
    applied.push(ctx.labels.level.intermediate);
  } else if (has(t, /\b(avancado|advanced)\b/)) {
    query.levels = ['advanced', 'all-levels'];
    applied.push(ctx.labels.level.advanced);
  }
  const category = CATEGORY_KEYWORDS.find(([re]) => re.test(t))?.[1];
  const portugueseOnly = has(t, /\b(em portugues|in portuguese|portugues)\b/);

  const terms = tokenize(question).filter((w) => !INTENT_WORDS.has(w));
  // Sem termos específicos, a categoria detectada vira filtro.
  if (category && terms.length <= 2) {
    query.categories = [category];
    applied.push(ctx.labels.category[category]);
    query.q = '';
  } else {
    query.q = terms.join(' ');
  }
  return { query, terms, appliedLabels: applied, portugueseOnly };
}

function findMentionedCourse(question: string, courses: Course[]): Course | null {
  const t = normalizeText(question);
  const distinctive: Array<[RegExp, string]> = [
    [/\bcs50\s*ai\b|\bcs50 ai\b|inteligencia artificial com python|artificial intelligence with python/, 'crs-harvard-cs50-ai'],
    [/\bcs50p\b|programming with python|programacao com python/, 'crs-harvard-cs50p'],
    [/\bcs50x?\b/, 'crs-harvard-cs50x'],
    [/\blfs101\b|introduction to linux|introducao ao linux/, 'crs-lf-lfs101'],
    [/fast\.?ai|practical deep learning/, 'crs-fastai-practical-dl'],
    [/\bkaggle\b/, 'crs-kaggle-intro-ml'],
    [/\b6\.?0001\b|\bmit\b/, 'crs-mit-ocw-6-0001'],
    [/elements of ai/, 'crs-elements-of-ai'],
    [/hugging ?face|agents course/, 'crs-hf-agents-course'],
    [/odin project/, 'crs-odin-project'],
    [/\bai.?90\d\b|azure ai/, 'crs-ms-azure-ai-fundamentals'],
    [/crash course|\bmlcc\b/, 'crs-google-mlcc'],
    [/fluencia/, 'crs-fb-fluencia-ia'],
    [/excel na pratica/, 'crs-fb-excel-na-pratica'],
  ];
  for (const [re, id] of distinctive) {
    if (re.test(t)) return courses.find((c) => c.id === id) ?? null;
  }
  // Título citado literalmente.
  return courses.find((c) => normalizeText(c.title).length > 8 && t.includes(normalizeText(c.title))) ?? null;
}

const DETAIL_RE = /\b(quanto custa|preco|custa|valor|price|cost|certificad\w*|certificate|duracao|carga horaria|quanto tempo|horas|duration|how long|pre.?requisit\w*|prerequisit\w*|requisitos|nivel|level|explique|explica|detalhes|sobre o|sobre a|details|explain|tell me about)\b/;

export function answerQuestion(question: string, ctx: EngineContext): EngineReply {
  const s = ctx.strings;
  const t = normalizeText(question);
  const reply = (r: Partial<EngineReply> & Pick<EngineReply, 'kind' | 'rule' | 'paragraphs'>): EngineReply => ({
    courses: [],
    suggestions: [],
    sources: [],
    ...r,
  });

  if (!t) return reply({ kind: 'help', rule: 'help', paragraphs: s.help });

  if (has(t, /^(oi|ola|ola sol|bom dia|boa tarde|boa noite|hello|hi|hey|e ai)\b/) && t.split(' ').length <= 4) {
    return reply({
      kind: 'greeting',
      rule: 'greeting',
      paragraphs: s.greeting,
      suggestions: [
        { label: s.suggestions.freeCourses, to: explorePath({ priceTypes: ['free'] }) },
        { label: s.suggestions.withCertificate, to: explorePath({ withCertificate: true }) },
      ],
    });
  }

  // Fora do escopo: aconselhamento de carreira, vagas/salários e dados em tempo real.
  if (has(t, /\b(salario\w*|salary|salaries|quanto ganha|vagas?|emprego\w*|jobs?|hiring|mercado de trabalho|job market)\b/)) {
    return reply({
      kind: 'out-of-scope',
      rule: 'out-of-scope',
      paragraphs: s.outOfScope.jobs,
      suggestions: [{ label: s.suggestions.methodology, to: '/methodology' }],
    });
  }
  if (has(t, /\b(devo|deveria|qual carreira|minha carreira|should i|my career|vale a pena|worth it|me aconselh\w*|conselho)\b/)) {
    return reply({
      kind: 'out-of-scope',
      rule: 'out-of-scope',
      paragraphs: s.outOfScope.career,
      suggestions: [{ label: s.suggestions.openExplore, to: '/explore' }],
    });
  }
  if (has(t, /\b(hoje|agora|noticias?|news|today|latest|ultimas novidades|tempo real|real time)\b/)) {
    return reply({ kind: 'out-of-scope', rule: 'out-of-scope', paragraphs: s.outOfScope.realtime });
  }

  // Perguntas sobre a própria plataforma.
  if (has(t, /\b(verifica\w*|verified|valida\w*|confiavel|confiaveis|trust\w*)\b/) && !findMentionedCourse(question, ctx.courses)) {
    return reply({ kind: 'help', rule: 'platform', paragraphs: s.platform.verification, suggestions: [{ label: s.suggestions.methodology, to: '/methodology' }] });
  }
  if (has(t, /\b(agente\w*|agents?|scout|verifier|atlas|trend)\b/)) {
    return reply({ kind: 'help', rule: 'platform', paragraphs: s.platform.agents, suggestions: [{ label: s.suggestions.agents, to: '/agents' }] });
  }
  if (has(t, /\b(laboratorio|lab|3d)\b/)) {
    return reply({ kind: 'help', rule: 'platform', paragraphs: s.platform.lab, suggestions: [{ label: s.suggestions.lab, to: '/lab' }] });
  }
  if (has(t, /\b(demo|demonstracao|simulad\w*|ficticio\w*|simulation)\b/)) {
    return reply({ kind: 'help', rule: 'platform', paragraphs: s.platform.demo, suggestions: [{ label: s.suggestions.methodology, to: '/methodology' }] });
  }
  if (has(t, /\b(fontes?|sources?|de onde vem|where .* from)\b/)) {
    return reply({ kind: 'help', rule: 'platform', paragraphs: s.platform.sources, suggestions: [{ label: s.suggestions.methodology, to: '/methodology' }] });
  }
  if (has(t, /\b(ajuda|help|o que voce faz|what can you do|como funciona|how does it work|bezalel)\b/)) {
    return reply({ kind: 'help', rule: 'help', paragraphs: s.help });
  }

  // Detalhes de um curso específico.
  const mentioned = findMentionedCourse(question, ctx.courses);
  if (mentioned && (DETAIL_RE.test(t) || tokenize(question).length <= 4)) {
    return describeCourse(mentioned, t, ctx);
  }

  // Busca no catálogo.
  const intent = parseIntent(question, ctx);
  const result = ctx.search({ ...intent.query, page: 1 });
  let hits = result.hits.map((h) => h.course);
  if (intent.portugueseOnly) hits = hits.filter((c) => c.languages.some((l) => l.startsWith('pt')));

  if (hits.length === 0) {
    return reply({
      kind: 'insufficient-data',
      rule: 'no-results',
      paragraphs: s.noResults,
      suggestions: [
        { label: s.suggestions.openExplore, to: '/explore' },
        ...(intent.query.categories?.[0]
          ? [{ label: s.suggestions.browseCategory(ctx.labels.category[intent.query.categories[0]]), to: explorePath({ categories: intent.query.categories }) }]
          : []),
      ],
    });
  }

  const shown = hits.slice(0, 4);
  const paragraphs = [s.results(hits.length, shown.length)];
  if (intent.appliedLabels.length) paragraphs.push(s.resultsFiltersApplied(intent.appliedLabels.join(' · ')));
  return reply({
    kind: 'answer',
    rule: 'catalog-search',
    paragraphs,
    courses: shown,
    suggestions: [{ label: s.suggestions.openFiltered, to: explorePath({ ...intent.query, pageSize: undefined, page: undefined }) }],
    sources: dedupeSources(shown),
  });
}

function dedupeSources(courses: Course[]) {
  const seen = new Set<string>();
  return courses
    .filter((c) => (seen.has(c.sourceUrl) ? false : (seen.add(c.sourceUrl), true)))
    .map((c) => ({ name: c.sourceName, url: c.sourceUrl }));
}

function describeCourse(course: Course, t: string, ctx: EngineContext): EngineReply {
  const s = ctx.strings;
  const f = s.courseField;
  const L = ctx.labels;
  const asks = {
    price: /\b(quanto custa|preco|custa|valor|price|cost|gratuito|free)\b/.test(t),
    certificate: /\b(certificad\w*|certificate)\b/.test(t),
    duration: /\b(duracao|carga horaria|quanto tempo|horas|duration|how long)\b/.test(t),
    level: /\b(nivel|level|iniciante|beginner)\b/.test(t),
    prerequisites: /\b(pre.?requisit\w*|prerequisit\w*|requisitos)\b/.test(t),
  };
  const askedSomething = Object.values(asks).some(Boolean);
  const want = (k: keyof typeof asks) => !askedSomething || asks[k];

  const paragraphs = [s.courseIntro(course.title, course.provider.name)];
  let missing = 0;
  if (want('price')) {
    if (course.priceType === 'unknown') {
      paragraphs.push(f.notStated(s.fieldNames.price));
      missing++;
    } else paragraphs.push(f.price(`${L.price[course.priceType]}${course.priceNote ? ` — ${course.priceNote}` : ''}`));
  }
  if (want('certificate')) {
    if (!course.certificateType) {
      paragraphs.push(f.notStated(s.fieldNames.certificate));
      missing++;
    } else paragraphs.push(f.certificate(`${L.certificate[course.certificateType] ?? ''}${course.certificateNote ? ` — ${course.certificateNote}` : ''}`));
  }
  if (want('duration')) {
    if (!course.duration) {
      paragraphs.push(f.notStated(s.fieldNames.duration));
      missing++;
    } else paragraphs.push(f.duration(course.duration.note ?? L.duration(course.duration.value, course.duration.unit)));
  }
  if (want('level')) {
    if (course.level === 'unknown') {
      paragraphs.push(f.notStated(s.fieldNames.level));
      missing++;
    } else paragraphs.push(f.level(L.level[course.level]));
  }
  if (want('prerequisites') && (asks.prerequisites || course.prerequisites?.length)) {
    if (!course.prerequisites?.length) {
      paragraphs.push(f.notStated(s.fieldNames.prerequisites));
      missing++;
    } else paragraphs.push(f.prerequisites(course.prerequisites.join('; ')));
  }
  paragraphs.push(f.verified(L.formatDate(course.lastCheckedAt), L.verification[course.verificationStatus] ?? course.verificationStatus));

  return {
    kind: askedSomething && missing > 0 && missing === Object.values(asks).filter(Boolean).length ? 'insufficient-data' : 'answer',
    rule: 'course-detail',
    paragraphs,
    courses: [course],
    suggestions: [{ label: s.suggestions.openCourse(course.title), to: `/course/${course.slug}` }],
    sources: [{ name: course.sourceName, url: course.sourceUrl }],
  };
}
