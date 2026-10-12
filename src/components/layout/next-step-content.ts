import type { Locale } from '@/types/domain';

/**
 * Textos dos fechamentos "Próximo passo" das páginas internas. Ficam fora do
 * i18n global (que vai no JS inicial): só as páginas internas os baixam.
 */
const pt = {
  eyebrow: 'Próximo passo',
  explore: {
    title: 'Não sabe por onde começar?',
    lead: 'Quatro perguntas montam uma trilha curta com estes mesmos cursos verificados — e dizem por que cada um entrou.',
    primary: 'Descobrir minha trilha',
    secondary: 'Perguntar ao Sol',
  },
  course: {
    title: (theme: string) => `Siga em ${theme}`,
    lead: 'Monte uma trilha com este e outros cursos verificados do mesmo tema, ou compare-o lado a lado com os relacionados.',
    primary: (theme: string) => `Montar trilha em ${theme}`,
    secondary: 'Comparar com os relacionados',
  },
  insights: {
    title: 'Transforme isso em um caminho',
    lead: 'As competências mais frequentes do catálogo viram uma trilha de estudo com cursos verificados.',
    primary: 'Descobrir minha trilha',
    secondary: 'Explorar o catálogo',
  },
  agents: {
    title: 'Veja os agentes trabalhando',
    lead: 'No laboratório 3D, cada evento vira um robô levando um registro de um setor a outro — e há um tour guiado.',
    primary: 'Entrar no laboratório',
    secondary: 'Ler a metodologia',
  },
  methodology: {
    title: 'Agora, use o catálogo',
    lead: 'Cada registro mostra a fonte oficial, a data da conferência e o que foi — e o que não foi — confirmado.',
    primary: 'Explorar o catálogo',
    secondary: 'Descobrir minha trilha',
  },
  about: {
    title: 'Comece a construir',
    lead: 'Descobrir, aprender, construir: monte sua primeira trilha em quatro perguntas.',
    primary: 'Descobrir minha trilha',
    secondary: 'Explorar o catálogo',
  },
};

type NextStepContent = typeof pt;

const en: NextStepContent = {
  eyebrow: 'Next step',
  explore: {
    title: 'Not sure where to start?',
    lead: 'Four questions build a short path with these same verified courses — and say why each one is there.',
    primary: 'Find my path',
    secondary: 'Ask Sol',
  },
  course: {
    title: (theme: string) => `Keep going in ${theme}`,
    lead: 'Build a path with this and other verified courses on the same topic, or compare it side by side with the related ones.',
    primary: (theme: string) => `Build a path in ${theme}`,
    secondary: 'Compare with related',
  },
  insights: {
    title: 'Turn this into a path',
    lead: 'The most frequent skills in the catalog become a study path with verified courses.',
    primary: 'Find my path',
    secondary: 'Explore the catalog',
  },
  agents: {
    title: 'Watch the agents at work',
    lead: 'In the 3D lab, every event becomes a robot carrying a record from one sector to another — and there is a guided tour.',
    primary: 'Enter the lab',
    secondary: 'Read the methodology',
  },
  methodology: {
    title: 'Now, use the catalog',
    lead: 'Every record shows the official source, the check date and what was — and was not — confirmed.',
    primary: 'Explore the catalog',
    secondary: 'Find my path',
  },
  about: {
    title: 'Start building',
    lead: 'Discover, learn, build: put together your first path in four questions.',
    primary: 'Find my path',
    secondary: 'Explore the catalog',
  },
};

export const nextStepContent: Record<Locale, NextStepContent> = { 'pt-BR': pt, en };
