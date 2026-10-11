import type { Course } from '../../../types/domain.ts';
import { coursera } from './helpers.ts';

const week10 = (weeks: number) => ({
  value: weeks,
  unit: 'weeks' as const,
  note: `${weeks} ${weeks === 1 ? 'semana' : 'semanas'} a ~10 h por semana (estimativa da página)`,
});

/**
 * Coursera — páginas oficiais conferidas em 11/10/2026 (módulos, nível,
 * carga estimada e certificado). Cursos em inglês; vários têm legendas.
 */
export const courseraCourses: Course[] = [
  // ---- Saúde mental e bem-estar ---------------------------------------------------
  coursera({
    path: 'the-science-of-well-being',
    slug: 'coursera-yale-science-of-well-being',
    title: 'The Science of Well-Being',
    description:
      'Desfaz equívocos comuns sobre felicidade, mostra por que a mente nos engana nas expectativas e o que a pesquisa diz sobre o que realmente faz bem — com desafios práticos para criar hábitos de bem-estar.',
    institution: 'Yale University',
    instructors: 'Laurie Santos',
    category: 'mental-health',
    skills: ['wellbeing'],
    topics: ['Equívocos sobre felicidade', 'Por que erramos nas expectativas', 'Como superar vieses', 'O que realmente nos faz felizes', 'Estratégias na prática'],
    duration: week10(1),
  }),
  coursera({
    path: 'positive-psychology',
    slug: 'coursera-unc-positive-psychology',
    title: 'Positive Psychology',
    description:
      'Pesquisa de Barbara Fredrickson sobre emoções positivas — a teoria "ampliar e construir", a ressonância da positividade e a bondade amorosa — com aplicações práticas para uma vida mais plena.',
    institution: 'The University of North Carolina at Chapel Hill',
    instructors: 'Barbara Fredrickson',
    category: 'mental-health',
    skills: ['wellbeing', 'emotional-intelligence'],
    topics: ['Emoções positivas', 'Teoria ampliar-e-construir', 'Busca da felicidade', 'Ressonância da positividade'],
    duration: week10(1),
  }),
  coursera({
    path: 'psychological-first-aid',
    slug: 'coursera-jhu-psychological-first-aid',
    title: 'Psychological First Aid',
    description:
      'Primeiros cuidados psicológicos pelo modelo RAPID (escuta reflexiva, avaliação de necessidades, priorização, intervenção e encaminhamento), aplicável a emergências, desastres, trabalho e comunidade, incluindo autocuidado.',
    institution: 'Johns Hopkins University',
    instructors: 'George S. Everly, Jr.',
    category: 'mental-health',
    skills: ['psychological-first-aid', 'mental-health-care'],
    topics: ['Modelo RAPID', 'Escuta reflexiva', 'Avaliação e priorização', 'Intervenção e encaminhamento', 'Autocuidado'],
    duration: { value: 6, unit: 'hours' },
  }),

  // ---- Saúde ----------------------------------------------------------------------
  coursera({
    path: 'epidemiology',
    slug: 'coursera-unc-epidemiology',
    title: 'Epidemiology: The Basic Science of Public Health',
    description:
      'Introdução à epidemiologia como base da saúde pública: história da área, medidas de frequência de doenças, desenhos de estudo, medidas de associação e causalidade, com exemplos de doenças cardiovasculares e infecciosas.',
    institution: 'The University of North Carolina at Chapel Hill',
    category: 'health',
    skills: ['epidemiology', 'public-health'],
    topics: ['História da epidemiologia', 'Frequência de doenças', 'Desenhos de estudo', 'Medidas de associação', 'Causalidade'],
    duration: { value: 7, unit: 'hours' },
  }),
  coursera({
    path: 'essentials-global-health',
    slug: 'coursera-yale-essentials-global-health',
    title: 'Essentials of Global Health',
    description:
      'Visão abrangente da saúde global: de que as pessoas adoecem e morrem, quem é mais afetado e por quê, sistemas de saúde e custo-efetividade, temas transversais e os principais atores, com foco em países de baixa e média renda.',
    institution: 'Yale University',
    instructors: 'Richard Skolnik',
    category: 'health',
    skills: ['global-health', 'public-health', 'health-systems'],
    topics: ['Carga de doenças', 'Sistemas de saúde', 'Desigualdades em saúde', 'Causas críticas de adoecimento', 'Atores da saúde global'],
    duration: week10(4),
  }),

  // ---- Educação física ------------------------------------------------------------
  coursera({
    path: 'science-exercise',
    slug: 'coursera-cu-science-of-exercise',
    title: 'Science of Exercise',
    description:
      'Fisiologia do exercício: como o corpo gera energia e se ajusta ao esforço, nutrição, dor muscular e fadiga, riscos do doping e as evidências dos benefícios do exercício contra doenças cardíacas, diabetes, obesidade e depressão.',
    institution: 'University of Colorado Boulder',
    category: 'physical-education',
    skills: ['exercise-science', 'physical-activity-health'],
    topics: ['Energética do exercício', 'Sistemas fisiológicos', 'Desempenho', 'Exercício, saúde e doença'],
    duration: week10(1),
    level: 'beginner',
  }),
  coursera({
    path: 'hacking-exercise-health',
    slug: 'coursera-mcmaster-hacking-exercise',
    title: 'Hacking Exercise For Health. The surprising new science of fitness.',
    description:
      'Dois fisiologistas do exercício explicam a ciência do condicionamento cardiorrespiratório e da força e ensinam a montar treinos eficientes, inclusive intervalados, que cabem na rotina e podem ser feitos em qualquer lugar.',
    institution: 'McMaster University',
    instructors: 'Martin Gibala e Stuart Phillips',
    category: 'physical-education',
    skills: ['exercise-science', 'physical-activity-health'],
    topics: ['Fundamentos do condicionamento', 'Aptidão cardiorrespiratória', 'Força muscular', 'Combinar cardio e força'],
    duration: week10(2),
    level: 'beginner',
  }),
  coursera({
    path: 'sports-society',
    slug: 'coursera-duke-sports-and-society',
    title: 'Sports and Society',
    description:
      'Olha o esporte com lentes da antropologia, sociologia e história: jogo e origem dos esportes modernos, globalização e política, raça e identidade, gênero e esporte feminino, o megabusiness esportivo e os esportes de aventura.',
    institution: 'Duke University',
    instructors: 'Orin Starn',
    category: 'physical-education',
    skills: ['sport-society'],
    topics: ['Jogo e esporte', 'Globalização e política', 'Raça e identidade', 'Gênero e esporte feminino', 'Negócio do esporte'],
    duration: week10(1),
  }),

  // ---- Nutrição -------------------------------------------------------------------
  coursera({
    path: 'food-and-health',
    slug: 'coursera-stanford-food-and-health',
    title: 'Stanford Introduction to Food and Health',
    description:
      'Troca a conversa sobre nutrientes isolados por comida de verdade: tendências alimentares, alimentos ultraprocessados, açúcar e escolhas mais saudáveis, com uma oficina de culinária e um argumento pela volta da comida caseira.',
    institution: 'Stanford University',
    instructors: 'Maya Adam',
    category: 'nutrition',
    skills: ['healthy-eating'],
    topics: ['Nutrientes e tendências alimentares', 'Alimentos processados', 'Açúcar', 'Oficina de culinária'],
    duration: { value: 6, unit: 'hours' },
    level: 'beginner',
  }),
  coursera({
    path: 'childnutrition',
    slug: 'coursera-stanford-child-nutrition',
    title: 'Child Nutrition and Cooking',
    description:
      'Nutrição infantil e hábitos que duram a vida inteira: por que cozinhar em casa importa, o que é uma refeição equilibrada, do supermercado à escola, alimentação sustentável, rótulos e alergias — com receitas simples.',
    institution: 'Stanford University',
    instructors: 'Maya Adam',
    category: 'nutrition',
    skills: ['child-nutrition', 'healthy-eating'],
    topics: ['Comida caseira', 'Refeição equilibrada', 'Alimentação escolar', 'Alimentação sustentável', 'Rótulos e alergias'],
    duration: week10(1),
    level: 'beginner',
  }),

  // ---- Educação -------------------------------------------------------------------
  coursera({
    path: 'learning-how-to-learn',
    slug: 'coursera-learning-how-to-learn',
    title: 'Learning How to Learn: Powerful mental tools to help you master tough subjects',
    description:
      'Técnicas de aprendizagem usadas por especialistas: os modos focado e difuso do cérebro, "chunking", ilusões de aprendizado, memória, procrastinação e práticas que a pesquisa mostra serem mais eficazes. Há versão traduzida em português na plataforma.',
    institution: 'Deep Teaching Solutions',
    instructors: 'Terrence Sejnowski e Barbara Oakley',
    category: 'education',
    skills: ['learning-strategies'],
    topics: ['O que é aprender', 'Chunking', 'Procrastinação e memória', 'Aprendizagem ao longo da vida'],
    duration: week10(2),
    level: 'beginner',
  }),

  // ---- Finanças, marketing e carreira ---------------------------------------------
  coursera({
    path: 'financial-markets-global',
    slug: 'coursera-yale-financial-markets',
    title: 'Financial Markets',
    description:
      'Ideias, métodos e instituições que permitem à sociedade gerir riscos e financiar empreendimentos: mercados de ações, seguros e bancos, gestão de risco e finanças comportamentais, com foco em liderança financeiramente consciente.',
    institution: 'Yale University',
    instructors: 'Robert Shiller',
    category: 'finance',
    skills: ['financial-markets'],
    topics: ['Mercados financeiros', 'Seguros', 'Gestão de risco', 'Finanças comportamentais', 'Bancos'],
    duration: week10(3),
    level: 'beginner',
  }),
  coursera({
    path: 'wharton-marketing',
    slug: 'coursera-wharton-marketing',
    title: 'Introduction to Marketing',
    description:
      'Três pilares da fidelização de clientes ensinados pelo departamento de marketing da Wharton: construção e posicionamento de marca, centralidade no cliente e estratégias de entrada no mercado, incluindo comunicação e preço.',
    institution: 'University of Pennsylvania (Wharton)',
    instructors: 'Barbara E. Kahn, Peter Fader e Jagmohan S. Raju',
    category: 'marketing',
    skills: ['marketing-strategy'],
    topics: ['Branding e posicionamento', 'Centralidade no cliente', 'Estratégia de comunicação', 'Fundamentos de preço'],
    duration: week10(1),
  }),
  coursera({
    path: 'negotiation-skills',
    slug: 'coursera-michigan-successful-negotiation',
    title: 'Successful Negotiation: Essential Strategies and Skills',
    description:
      'As quatro etapas de uma negociação bem-sucedida — preparar a estratégia, negociar com táticas-chave, fechar um contrato e avaliar o resultado — com uma negociação real ao final. Há versão em português na plataforma.',
    institution: 'University of Michigan',
    instructors: 'George Siedel',
    category: 'career',
    skills: ['negotiation'],
    topics: ['Preparar a estratégia', 'Táticas de negociação', 'Fechar o contrato', 'Avaliar o resultado', 'Negociação prática'],
    duration: week10(2),
    level: 'beginner',
  }),

  // ---- Design ---------------------------------------------------------------------
  coursera({
    path: 'foundations-user-experience-design',
    slug: 'coursera-google-foundations-ux',
    title: 'Foundations of User Experience (UX) Design',
    description:
      'Primeiro dos sete cursos do certificado de UX do Google: o que é UX, design centrado no usuário, design thinking, acessibilidade, papéis de quem trabalha com UX, design sprints e métodos de pesquisa. Não exige experiência prévia.',
    institution: 'Google',
    category: 'design',
    skills: ['ux-design', 'design-thinking', 'user-research'],
    topics: ['Introdução ao UX', 'Pensar como designer de UX', 'Design sprints', 'Projeto de portfólio'],
    duration: week10(1),
    level: 'beginner',
    prerequisites: ['Nenhuma experiência prévia necessária'],
  }),
  coursera({
    path: 'fundamentals-of-graphic-design',
    slug: 'coursera-calarts-graphic-design',
    title: 'Fundamentals of Graphic Design',
    description:
      'Fundamentos da comunicação visual com foco na prática: criação de imagens, tipografia, forma e teoria das cores, composição e hierarquia visual. Ensina princípios, não um software específico.',
    institution: 'California Institute of the Arts',
    instructors: 'Michael Worthington',
    category: 'design',
    skills: ['graphic-design'],
    topics: ['Criação de imagens', 'Tipografia', 'Forma e cor', 'Composição e hierarquia visual'],
    duration: { value: 8, unit: 'hours' },
    level: 'beginner',
  }),

  // ---- Idiomas --------------------------------------------------------------------
  coursera({
    path: 'careerdevelopment',
    slug: 'coursera-penn-english-career-development',
    title: 'English for Career Development',
    description:
      'Inglês para quem não é nativo e quer avançar na carreira: processo seletivo nos EUA comparado ao do seu país, currículo, carta de apresentação, networking e entrevistas, ampliando vocabulário profissional.',
    institution: 'University of Pennsylvania',
    instructors: 'Brian McManus e equipe',
    category: 'languages',
    skills: ['english', 'job-search'],
    topics: ['Mercado de trabalho', 'Currículo', 'Carta de apresentação', 'Networking', 'Entrevistas'],
    duration: week10(4),
    free: true,
    license: 'CC BY 4.0 (materiais do curso, salvo indicação em contrário)',
  }),
  coursera({
    path: 'learn-chinese',
    slug: 'coursera-pku-chinese-for-beginners',
    title: 'Chinese for Beginners',
    description:
      'Introdução ao mandarim com foco na fala: fonética e expressões do dia a dia para se apresentar, falar de rotina, comida, compras, cidade, clima e hobbies — sem exigir caracteres chineses.',
    institution: 'Peking University',
    instructors: 'Xiaoyu Liu',
    category: 'languages',
    skills: ['mandarin'],
    topics: ['Fonética do mandarim', 'Apresentações', 'Rotina e escola', 'Comida e compras', 'Clima e hobbies'],
    duration: week10(2),
    level: 'beginner',
  }),

  // ---- Engenharia -----------------------------------------------------------------
  coursera({
    path: 'engineering-mechanics-statics',
    slug: 'coursera-gatech-statics',
    title: 'Introduction to Engineering Mechanics',
    description:
      'Modelagem e análise de problemas de equilíbrio estático com aplicações reais de engenharia: forças em 2D e 3D, momentos, sistemas de forças equivalentes, diagramas de corpo livre e equações de equilíbrio.',
    institution: 'Georgia Institute of Technology',
    instructors: 'Wayne Whiteman',
    category: 'industry',
    skills: ['engineering-mechanics'],
    topics: ['Forças e equilíbrio', 'Momentos', 'Sistemas de forças', 'Diagramas de corpo livre', 'Equações de equilíbrio'],
    duration: week10(2),
    prerequisites: ['Matemática e física básicas'],
  }),
];
