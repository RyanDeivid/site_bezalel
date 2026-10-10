/**
 * SÉRIE DEMONSTRATIVA — FICTÍCIA.
 *
 * Contagem simulada de "menções em fontes monitoradas" por trimestre, usada
 * apenas para demonstrar como a área de Insights exibirá evolução temporal
 * quando houver dados históricos reais. NÃO representa demanda de mercado,
 * número de vagas nem qualquer medição real. A interface rotula estes
 * números como demonstração em todos os lugares em que aparecem.
 */
export interface DemoMentionPoint {
  period: string; // "2025-T1" … "2026-T3"
  values: Record<string, number>;
}

export const DEMO_MENTION_PERIODS = ['2025-T1', '2025-T2', '2025-T3', '2025-T4', '2026-T1', '2026-T2', '2026-T3'] as const;

export const demoMentionSeries: DemoMentionPoint[] = [
  { period: '2025-T1', values: { 'ai-agents': 12, llm: 30, python: 44, 'data-analysis': 26, 'information-security': 18, 'privacy-lgpd': 9 } },
  { period: '2025-T2', values: { 'ai-agents': 17, llm: 33, python: 45, 'data-analysis': 27, 'information-security': 19, 'privacy-lgpd': 10 } },
  { period: '2025-T3', values: { 'ai-agents': 24, llm: 37, python: 43, 'data-analysis': 29, 'information-security': 21, 'privacy-lgpd': 10 } },
  { period: '2025-T4', values: { 'ai-agents': 31, llm: 40, python: 46, 'data-analysis': 28, 'information-security': 22, 'privacy-lgpd': 12 } },
  { period: '2026-T1', values: { 'ai-agents': 38, llm: 42, python: 47, 'data-analysis': 31, 'information-security': 24, 'privacy-lgpd': 13 } },
  { period: '2026-T2', values: { 'ai-agents': 44, llm: 43, python: 48, 'data-analysis': 32, 'information-security': 25, 'privacy-lgpd': 15 } },
  { period: '2026-T3', values: { 'ai-agents': 51, llm: 45, python: 49, 'data-analysis': 33, 'information-security': 27, 'privacy-lgpd': 16 } },
];

/** Consultas de exemplo exibidas na estação do Sol durante a simulação. */
export const demoAssistantQueries: string[] = [
  'cursos gratuitos de Python',
  'certificação em inteligência artificial',
  'curso de LGPD com certificado',
  'aprender Linux do zero',
  'machine learning para iniciantes',
  'desenvolvimento web gratuito',
];
