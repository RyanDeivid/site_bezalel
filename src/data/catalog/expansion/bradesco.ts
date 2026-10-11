import type { Course } from '../../../types/domain.ts';
import { bradesco } from './helpers.ts';

/** Fundação Bradesco — Escola Virtual: páginas conferidas em 11/10/2026. */
export const bradescoCourses: Course[] = [
  bradesco({
    path: 'educacao-financeira',
    slug: 'fb-educacao-financeira',
    title: 'Educação Financeira',
    description:
      'Ajuda a entender o próprio perfil financeiro, analisar e controlar gastos, e conhecer os conceitos básicos de investimentos e de consumo sustentável. Cada módulo segue uma jornada curta com desafio, missão prática e quiz.',
    partner: 'Instituto Crescer',
    category: 'finance',
    skills: ['personal-finance'],
    topics: ['Perfil financeiro', 'Análise e controle financeiro', 'Investimentos', 'Sustentabilidade'],
    hours: 4,
    level: 'beginner',
    minAge: 14,
    noPrereq: true,
  }),
  bradesco({
    path: 'Construindo-minha-Protecao-Financeira',
    slug: 'fb-construindo-minha-protecao-financeira',
    title: 'Construindo minha Proteção Financeira',
    description:
      'Curso curto para organizar as finanças com planejamento: mapear ganhos, gastos e compromissos, refletir sobre hábitos de consumo e construir uma vida financeira mais segura para atingir objetivos.',
    partner: 'Bradesco Seguros',
    category: 'finance',
    skills: ['personal-finance'],
    topics: ['Como administrar minhas finanças', 'Mapeamento de gastos e ganhos', 'Abundância financeira e segura'],
    hours: 2,
    level: 'beginner',
    minAge: 14,
  }),
  bradesco({
    path: 'conceitos-de-aprendizagem-criativa',
    slug: 'fb-conceitos-de-aprendizagem-criativa',
    title: 'Conceitos de Aprendizagem Criativa',
    description:
      'Apresenta a aprendizagem criativa como abordagem pedagógica — ambientes que estimulam criatividade, imaginação e colaboração — passando por metodologias ativas, ensino mão na massa, a espiral e os 4 Ps e os micromundos.',
    category: 'education',
    skills: ['creative-learning', 'active-learning', 'teacher-training'],
    topics: ['Metodologias ativas', 'Ensino mão na massa', 'Espiral e os 4 Ps', 'Micromundos'],
    hours: 6,
    level: 'beginner',
    minAge: 18,
    noPrereq: true,
  }),
  bradesco({
    path: 'comunicacao-empresarial',
    slug: 'fb-comunicacao-empresarial',
    title: 'Comunicação Empresarial',
    description:
      'Por que a comunicação define a imagem de uma organização e como se expressar bem por escrito e oralmente no trabalho: comunicação nas organizações, documentos empresariais e interpretação de dados.',
    category: 'marketing',
    skills: ['institutional-communication', 'interpersonal-communication'],
    topics: ['Comunicação nas organizações', 'Documentos empresariais', 'Interpretando dados'],
    hours: 12,
    level: 'beginner',
    minAge: 16,
    noPrereq: true,
  }),
  bradesco({
    path: 'Como-Conseguir-um-Novo-Emprego',
    slug: 'fb-como-conseguir-um-novo-emprego',
    title: 'Como Conseguir um Novo Emprego',
    description:
      'Passo a passo para se destacar na busca de emprego: onde encontrar boas vagas, como montar um currículo atrativo, como se preparar para entrevistas e como criar um perfil no LinkedIn.',
    category: 'career',
    skills: ['job-search'],
    topics: ['A busca', 'O currículo', 'A entrevista', 'O LinkedIn'],
    hours: 4,
    level: 'beginner',
    minAge: 16,
    noPrereq: true,
  }),
  bradesco({
    path: 'comunicacao_escrita',
    slug: 'fb-comunicacao-escrita',
    title: 'Comunicação Escrita: Ortografia, Gramática e Texto',
    description:
      'Fortalece a escrita com clareza e correção: verbos, pronomes e nomes, conexão e coesão, abreviaturas e siglas, ortografia, acentuação, crase e pontuação conforme o Novo Acordo Ortográfico, com muitos exercícios práticos.',
    category: 'languages',
    skills: ['portuguese-writing'],
    topics: ['Escrita com qualidade', 'Verbos e pronomes', 'Coesão textual', 'Ortografia', 'Acentuação, crase e pontuação'],
    hours: 16,
    level: 'beginner',
    minAge: 16,
  }),
];
