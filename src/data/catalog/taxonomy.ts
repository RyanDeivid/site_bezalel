import type { Category, CategoryId, LocalizedText } from '../../types/domain.ts';

/** Categorias de conhecimento usadas no catálogo e nos insights. */
export const categories: Category[] = [
  {
    id: 'ai-ml',
    name: { 'pt-BR': 'IA e Machine Learning', en: 'AI & Machine Learning' },
    description: {
      'pt-BR': 'Fundamentos de IA, aprendizado de máquina, deep learning, LLMs e agentes.',
      en: 'AI fundamentals, machine learning, deep learning, LLMs and agents.',
    },
  },
  {
    id: 'computer-science',
    name: { 'pt-BR': 'Ciência da Computação', en: 'Computer Science' },
    description: {
      'pt-BR': 'Programação, algoritmos, estruturas de dados e pensamento computacional.',
      en: 'Programming, algorithms, data structures and computational thinking.',
    },
  },
  {
    id: 'web-development',
    name: { 'pt-BR': 'Desenvolvimento Web', en: 'Web Development' },
    description: {
      'pt-BR': 'HTML, CSS, JavaScript, frameworks e desenvolvimento full stack.',
      en: 'HTML, CSS, JavaScript, frameworks and full-stack development.',
    },
  },
  {
    id: 'data',
    name: { 'pt-BR': 'Dados e Análise', en: 'Data & Analytics' },
    description: {
      'pt-BR': 'Planilhas, análise e visualização de dados.',
      en: 'Spreadsheets, data analysis and visualization.',
    },
  },
  {
    id: 'cloud-infra',
    name: { 'pt-BR': 'Infraestrutura e Nuvem', en: 'Cloud & Infrastructure' },
    description: {
      'pt-BR': 'Sistemas operacionais, linha de comando, redes e nuvem.',
      en: 'Operating systems, command line, networking and cloud.',
    },
  },
  {
    id: 'security-privacy',
    name: { 'pt-BR': 'Segurança e Privacidade', en: 'Security & Privacy' },
    description: {
      'pt-BR': 'Proteção de dados, LGPD, segurança da informação e governança.',
      en: 'Data protection, privacy law, information security and governance.',
    },
  },
  {
    id: 'digital-government',
    name: { 'pt-BR': 'Governo Digital', en: 'Digital Government' },
    description: {
      'pt-BR': 'Transformação digital, IA responsável e serviços públicos.',
      en: 'Digital transformation, responsible AI and public services.',
    },
  },
];

export interface SkillDefinition {
  id: string;
  name: LocalizedText;
  category: CategoryId;
  description: LocalizedText;
}

const s = (id: string, category: CategoryId, pt: string, en: string, dPt: string, dEn: string): SkillDefinition => ({
  id,
  category,
  name: { 'pt-BR': pt, en },
  description: { 'pt-BR': dPt, en: dEn },
});

/**
 * Taxonomia de competências. As relações competência → curso NÃO ficam aqui:
 * são derivadas dos registros do catálogo (services/skills).
 */
export const skillDefinitions: SkillDefinition[] = [
  s('python', 'computer-science', 'Python', 'Python', 'Linguagem de programação de uso geral, base de ciência de dados e IA.', 'General-purpose language, foundation of data science and AI.'),
  s('algorithms', 'computer-science', 'Algoritmos', 'Algorithms', 'Procedimentos para resolver problemas de forma correta e eficiente.', 'Procedures to solve problems correctly and efficiently.'),
  s('data-structures', 'computer-science', 'Estruturas de dados', 'Data structures', 'Formas de organizar dados em memória: listas, árvores, tabelas hash.', 'Ways to organize data in memory: lists, trees, hash tables.'),
  s('c-language', 'computer-science', 'Linguagem C', 'C language', 'Linguagem de baixo nível que expõe memória e ponteiros.', 'Low-level language exposing memory and pointers.'),
  s('sql', 'data', 'SQL', 'SQL', 'Consulta e modelagem de bancos de dados relacionais.', 'Querying and modeling relational databases.'),
  s('software-testing', 'computer-science', 'Testes de software', 'Software testing', 'Testes unitários e práticas de verificação de código.', 'Unit tests and code verification practices.'),
  s('oop', 'computer-science', 'Orientação a objetos', 'Object-oriented programming', 'Modelagem de software com classes, objetos e encapsulamento.', 'Modeling software with classes, objects and encapsulation.'),
  s('regex', 'computer-science', 'Expressões regulares', 'Regular expressions', 'Padrões para busca e validação de texto.', 'Patterns for searching and validating text.'),
  s('search-algorithms', 'ai-ml', 'Algoritmos de busca', 'Search algorithms', 'Busca em grafos e espaços de estados, base de muitos sistemas de IA.', 'Graph and state-space search, the basis of many AI systems.'),
  s('ai-fundamentals', 'ai-ml', 'Fundamentos de IA', 'AI fundamentals', 'O que é IA, suas possibilidades, limites e impactos.', 'What AI is, its possibilities, limits and impacts.'),
  s('machine-learning', 'ai-ml', 'Machine learning', 'Machine learning', 'Modelos que aprendem padrões a partir de dados.', 'Models that learn patterns from data.'),
  s('model-validation', 'ai-ml', 'Validação de modelos', 'Model validation', 'Medir desempenho e evitar overfitting.', 'Measuring performance and avoiding overfitting.'),
  s('data-preparation', 'data', 'Preparação de dados', 'Data preparation', 'Tratamento de dados numéricos e categóricos para modelos.', 'Handling numerical and categorical data for models.'),
  s('neural-networks', 'ai-ml', 'Redes neurais', 'Neural networks', 'Modelos inspirados em neurônios, base do deep learning.', 'Neuron-inspired models, the basis of deep learning.'),
  s('deep-learning', 'ai-ml', 'Deep learning', 'Deep learning', 'Redes neurais profundas aplicadas a visão, texto e dados.', 'Deep neural networks applied to vision, text and data.'),
  s('computer-vision', 'ai-ml', 'Visão computacional', 'Computer vision', 'Modelos que interpretam imagens.', 'Models that interpret images.'),
  s('nlp', 'ai-ml', 'Processamento de linguagem natural', 'Natural language processing', 'Modelos que interpretam e geram texto.', 'Models that interpret and generate text.'),
  s('pytorch', 'ai-ml', 'PyTorch', 'PyTorch', 'Biblioteca de deep learning em Python.', 'Deep learning library for Python.'),
  s('llm', 'ai-ml', 'Grandes modelos de linguagem', 'Large language models', 'Modelos de linguagem em larga escala e suas aplicações.', 'Large-scale language models and their applications.'),
  s('ai-agents', 'ai-ml', 'Agentes de IA', 'AI agents', 'Sistemas que usam modelos e ferramentas para executar tarefas.', 'Systems that use models and tools to perform tasks.'),
  s('generative-ai', 'ai-ml', 'IA generativa', 'Generative AI', 'Modelos que produzem texto, imagem e outros conteúdos.', 'Models that produce text, images and other content.'),
  s('prompt-engineering', 'ai-ml', 'Escrita de prompts', 'Prompt writing', 'Formular instruções eficazes para modelos de linguagem.', 'Writing effective instructions for language models.'),
  s('responsible-ai', 'ai-ml', 'IA responsável e ética', 'Responsible AI & ethics', 'Equidade, riscos e uso ético e confiável de IA.', 'Fairness, risks and ethical, trustworthy AI use.'),
  s('ai-governance', 'digital-government', 'Governança de IA', 'AI governance', 'Políticas e controles para sistemas de IA confiáveis.', 'Policies and controls for trustworthy AI systems.'),
  s('digital-transformation', 'digital-government', 'Transformação digital', 'Digital transformation', 'Redesenho de serviços e organizações com tecnologia.', 'Redesigning services and organizations with technology.'),
  s('html-css', 'web-development', 'HTML e CSS', 'HTML & CSS', 'Estrutura e apresentação de páginas web.', 'Structure and presentation of web pages.'),
  s('responsive-design', 'web-development', 'Design responsivo', 'Responsive design', 'Interfaces que se adaptam a qualquer tamanho de tela.', 'Interfaces that adapt to any screen size.'),
  s('javascript', 'web-development', 'JavaScript', 'JavaScript', 'Linguagem da web para interatividade no navegador e no servidor.', 'The web language for browser and server interactivity.'),
  s('react', 'web-development', 'React', 'React', 'Biblioteca para construir interfaces com componentes.', 'Library for building component-based interfaces.'),
  s('nodejs', 'web-development', 'Node.js', 'Node.js', 'JavaScript no servidor.', 'Server-side JavaScript.'),
  s('ruby-on-rails', 'web-development', 'Ruby on Rails', 'Ruby on Rails', 'Framework web full stack em Ruby.', 'Full-stack web framework in Ruby.'),
  s('spreadsheets', 'data', 'Planilhas', 'Spreadsheets', 'Organização, fórmulas e automação em planilhas.', 'Organizing, formulas and automation in spreadsheets.'),
  s('data-analysis', 'data', 'Análise de dados', 'Data analysis', 'Explorar, resumir e visualizar dados para decisões.', 'Exploring, summarizing and visualizing data for decisions.'),
  s('data-governance', 'security-privacy', 'Governança de dados', 'Data governance', 'Políticas de qualidade, acesso e uso de dados.', 'Policies for data quality, access and use.'),
  s('privacy-lgpd', 'security-privacy', 'Privacidade e LGPD', 'Privacy & LGPD', 'Proteção de dados pessoais conforme a legislação brasileira.', 'Personal data protection under Brazilian law.'),
  s('information-security', 'security-privacy', 'Segurança da informação', 'Information security', 'Controles para proteger sistemas e informações.', 'Controls to protect systems and information.'),
  s('linux', 'cloud-infra', 'Linux', 'Linux', 'Sistema operacional dominante em servidores e nuvem.', 'The dominant operating system in servers and cloud.'),
  s('command-line', 'cloud-infra', 'Linha de comando', 'Command line', 'Operar sistemas pelo terminal.', 'Operating systems through the terminal.'),
  s('bash-scripting', 'cloud-infra', 'Scripts Bash', 'Bash scripting', 'Automação de tarefas no shell.', 'Automating tasks in the shell.'),
  s('networking', 'cloud-infra', 'Redes', 'Networking', 'Conceitos e operações de rede.', 'Networking concepts and operations.'),
  s('cloud-azure', 'cloud-infra', 'Microsoft Azure', 'Microsoft Azure', 'Serviços de nuvem da Microsoft.', 'Microsoft cloud services.'),
];

export const categoryIds: CategoryId[] = categories.map((c) => c.id);
