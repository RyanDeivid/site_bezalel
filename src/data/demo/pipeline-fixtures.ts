import type { RawRecord } from '../../domain/pipeline/types.ts';
import type { Source } from '../../types/domain.ts';

/**
 * DADOS DE DEMONSTRAÇÃO — FICTÍCIOS.
 *
 * Instituições, cursos e URLs abaixo NÃO existem. Os domínios usam
 * `example.org`, reservado pela IANA para documentação. Servem apenas para
 * exercitar o pipeline na simulação do laboratório; a interface os marca
 * sempre com o selo DEMO.
 *
 * Cada registro foi desenhado para exercitar um caminho do pipeline — o
 * resultado vem das regras de validação, não de sorteio:
 *   aprovado · duplicado por URL · duplicado por título · HTTPS ausente ·
 *   nota insuficiente · registro desatualizado · conteúdo inseguro.
 */

export const demoSources: Source[] = [
  {
    id: 'demo-src-aurora',
    name: 'Instituto Aurora (fictício)',
    url: 'https://aurora.example.org',
    sourceType: 'demo-fixture',
    trustStatus: 'demo',
    collectionPolicy: 'demo',
    origin: 'demo',
  },
  {
    id: 'demo-src-horizonte',
    name: 'Academia Horizonte (fictícia)',
    url: 'https://horizonte.example.org',
    sourceType: 'demo-fixture',
    trustStatus: 'demo',
    collectionPolicy: 'demo',
    origin: 'demo',
  },
  {
    id: 'demo-src-meridiano',
    name: 'Portal Meridiano (fictício)',
    url: 'https://meridiano.example.org',
    sourceType: 'demo-fixture',
    trustStatus: 'demo',
    collectionPolicy: 'demo',
    origin: 'demo',
  },
  {
    id: 'demo-src-sem-permissao',
    name: 'Agregador Sem Permissão (fictício)',
    url: 'https://agregador.example.org',
    sourceType: 'demo-fixture',
    trustStatus: 'blocked',
    collectionPolicy: 'not-collected',
    origin: 'demo',
  },
];

/** Datas relativas ao "agora" da simulação, para que a demo nunca envelheça. */
export function buildDemoRawRecords(now: Date): Map<string, RawRecord[]> {
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
  const collectedAt = now.toISOString();

  return new Map<string, RawRecord[]>([
    [
      'demo-src-aurora',
      [
        {
          externalId: 'AUR-101',
          sourceId: 'demo-src-aurora',
          url: 'https://aurora.example.org/cursos/analise-de-dados-python',
          title: 'Fundamentos de Análise de Dados com Python',
          provider: 'Instituto Aurora (fictício)',
          description:
            'Curso fictício de demonstração que percorre leitura de dados, limpeza, estatística descritiva e visualização com Python, com exercícios guiados e um projeto final de análise.',
          categoryHint: 'Dados',
          levelText: 'Iniciante',
          priceText: 'Gratuito',
          durationText: '12 horas',
          certificateText: 'Certificado gratuito',
          skills: ['python', 'data-analysis'],
          language: 'pt-BR',
          collectedAt,
          updatedAtSource: daysAgo(20),
        },
        {
          externalId: 'AUR-204',
          sourceId: 'demo-src-aurora',
          url: 'https://aurora.example.org/cursos/redes-neurais',
          title: 'Introdução a Redes Neurais',
          provider: 'Instituto Aurora (fictício)',
          description:
            'Curso fictício de demonstração sobre perceptrons, retropropagação, regularização e redes convolucionais, com notebooks práticos e estudos de caso em classificação de imagens.',
          categoryHint: 'Inteligência Artificial',
          levelText: 'Intermediário',
          priceText: 'Gratuito, certificado pago opcional',
          durationText: '6 semanas',
          certificateText: 'Certificado verificado pago',
          skills: ['neural-networks', 'deep-learning'],
          language: 'pt-BR',
          collectedAt,
          updatedAtSource: daysAgo(45),
        },
        {
          // Mesmo curso do AUR-101, com parâmetros de rastreamento → duplicado por URL.
          sourceId: 'demo-src-aurora',
          url: 'https://www.aurora.example.org/cursos/analise-de-dados-python/?utm_source=newsletter&utm_medium=email',
          title: 'Análise de Dados com Python — turma de outubro',
          provider: 'Instituto Aurora (fictício)',
          description: 'Divulgação fictícia de nova turma do mesmo curso.',
          priceText: 'Gratuito',
          collectedAt,
          updatedAtSource: daysAgo(2),
        },
        {
          externalId: 'AUR-310',
          sourceId: 'demo-src-aurora',
          url: 'http://aurora.example.org/oficinas/prompts',
          title: 'Oficina de Escrita de Prompts',
          provider: 'Instituto Aurora (fictício)',
          description:
            'Oficina fictícia de demonstração sobre como estruturar instruções para modelos de linguagem, com exemplos comentados e exercícios de reescrita.',
          categoryHint: 'IA',
          levelText: 'Iniciante',
          priceText: 'Gratuito',
          durationText: '3 horas',
          skills: ['prompt-engineering'],
          language: 'pt-BR',
          collectedAt,
          updatedAtSource: daysAgo(10),
        },
      ],
    ],
    [
      'demo-src-horizonte',
      [
        {
          externalId: 'HZ-SEG-01',
          sourceId: 'demo-src-horizonte',
          url: 'https://horizonte.example.org/trilhas/seguranca-essencial',
          title: 'Segurança da Informação Essencial',
          provider: 'Academia Horizonte (fictícia)',
          description:
            'Curso fictício de demonstração com fundamentos de segurança da informação: ameaças comuns, controles de acesso, criptografia básica, resposta a incidentes e boas práticas para equipes.',
          categoryHint: 'Segurança',
          levelText: 'Básico',
          priceText: 'R$ 89,90',
          durationText: '20h',
          certificateText: 'Certificado incluso',
          skills: ['information-security'],
          language: 'pt-BR',
          collectedAt,
          updatedAtSource: daysAgo(30),
        },
        {
          // Mesmo provedor + mesmo título em outra URL → duplicado por impressão digital.
          sourceId: 'demo-src-horizonte',
          url: 'https://horizonte.example.org/promocoes/seguranca-essencial-2',
          title: 'Segurança da Informação Essencial',
          provider: 'Academia Horizonte (fictícia)',
          description: 'Página promocional fictícia do mesmo curso.',
          priceText: 'R$ 69,90',
          collectedAt,
          updatedAtSource: daysAgo(1),
        },
        {
          externalId: 'HZ-WEB-07',
          sourceId: 'demo-src-horizonte',
          url: 'https://horizonte.example.org/trilhas/web-moderno',
          title: 'Desenvolvimento Web Moderno',
          provider: 'Academia Horizonte (fictícia)',
          description: 'Página fictícia com poucas informações.',
          categoryHint: 'Web',
          priceText: 'Consulte',
          skills: ['javascript'],
          language: 'pt-BR',
          collectedAt,
          updatedAtSource: daysAgo(15),
        },
        {
          externalId: 'HZ-GOV-03',
          sourceId: 'demo-src-horizonte',
          url: 'https://horizonte.example.org/trilhas/governanca-de-dados',
          title: 'Governança de Dados no Setor Público',
          provider: 'Academia Horizonte (fictícia)',
          description:
            'Curso fictício de demonstração sobre políticas de dados, qualidade, catálogos e papéis de governança em órgãos públicos, com estudos de caso.',
          categoryHint: 'Governo',
          levelText: 'Intermediário',
          priceText: 'Gratuito',
          durationText: '16 horas',
          certificateText: 'Certificado gratuito',
          skills: ['data-governance'],
          language: 'pt-BR',
          collectedAt,
          // Última atualização da fonte há mais de 180 dias → reprovado por desatualização.
          updatedAtSource: daysAgo(420),
        },
      ],
    ],
    [
      'demo-src-meridiano',
      [
        {
          externalId: 'MER-55',
          sourceId: 'demo-src-meridiano',
          url: 'https://meridiano.example.org/c/visualizacao-de-dados',
          title: 'Visualização de Dados para Iniciantes',
          provider: 'Portal Meridiano (fictício)',
          description:
            'Curso fictício de demonstração sobre escolha de gráficos, percepção visual, cores acessíveis e construção de painéis claros, com exercícios em planilhas.',
          categoryHint: 'Análise de dados',
          levelText: 'Iniciante',
          priceText: 'Free',
          durationText: '8 horas',
          certificateText: 'Badge digital',
          skills: ['data-analysis', 'spreadsheets'],
          language: 'pt-BR',
          collectedAt,
          updatedAtSource: daysAgo(12),
        },
        {
          externalId: 'MER-56',
          sourceId: 'demo-src-meridiano',
          url: 'https://meridiano.example.org/c/automacao',
          title: 'Automação de Tarefas com Scripts',
          provider: 'Portal Meridiano (fictício)',
          // Marcação executável em dado externo → reprovado por conteúdo inseguro.
          description:
            'Curso fictício de demonstração sobre automação com scripts de shell. <script>alert("x")</script> Inclui exercícios práticos de linha de comando.',
          categoryHint: 'Linux',
          levelText: 'Iniciante',
          priceText: 'Gratuito',
          durationText: '10 horas',
          skills: ['bash-scripting'],
          language: 'pt-BR',
          collectedAt,
          updatedAtSource: daysAgo(5),
        },
      ],
    ],
  ]);
}
