/**
 * Textos comuns, navegação, enums e metadados de rota (pt-BR — idioma base).
 * Sem imports de runtime: este arquivo também é lido pelo script de build.
 */
export const common = {
  common: {
    appName: 'Bezalel',
    slogan: 'Discover. Learn. Build.',
    tagline: 'Inteligência educacional para descobrir, aprender e construir.',
    demo: 'Demo',
    demoLong: 'Dado de demonstração',
    curated: 'Verificado',
    curatedLong: 'Registro real verificado na fonte',
    production: 'Produção',
    notInformed: 'Não informado',
    inferred: 'inferido',
    loading: 'Carregando…',
    retry: 'Tentar novamente',
    close: 'Fechar',
    back: 'Voltar',
    learnMore: 'Saiba mais',
    viewSource: 'Ver fonte original',
    opensInNewTab: '(abre em nova aba)',
    copyLink: 'Copiar link',
    linkCopied: 'Link copiado para a área de transferência.',
    copyFailed: 'Não foi possível copiar o link.',
    all: 'Todos',
    clear: 'Limpar',
    showMore: 'Mostrar mais',
    lastChecked: 'Última conferência',
    source: 'Fonte',
    updated: 'Atualizado',
    yes: 'Sim',
    no: 'Não',
    beta: 'v1.0',
    errorTitle: 'Algo não saiu como esperado',
    errorBody: 'Não foi possível carregar este conteúdo. Seus dados não foram afetados.',
    unavailableTitle: 'Indisponível nesta versão',
    emptyTitle: 'Nada por aqui ainda',
    simulation: 'Simulação local',
    count: (n: number) => (n === 1 ? '1 item' : `${n} itens`),
  },
  nav: {
    primary: 'Navegação principal',
    home: 'Início',
    explore: 'Explorar',
    trail: 'Sua trilha',
    skills: 'Constelação',
    saved: 'Minha estante',
    savedCount: (n: number) => (n === 1 ? 'Minha estante: 1 curso salvo' : `Minha estante: ${n} cursos salvos`),
    search: 'Buscar',
    searchLong: 'Buscar no site (Ctrl+K)',
    insights: 'Insights',
    agents: 'Agentes',
    lab: 'Laboratório',
    universe: 'Universe',
    assistant: 'Sol',
    assistantLong: 'Assistente Sol',
    about: 'Sobre',
    methodology: 'Metodologia',
    privacy: 'Privacidade',
    terms: 'Termos de uso',
    openMenu: 'Abrir menu',
    closeMenu: 'Fechar menu',
    skipToContent: 'Pular para o conteúdo',
    themeToLight: 'Ativar tema claro',
    themeToDark: 'Ativar tema escuro',
    themeToggle: 'Alternar tema claro/escuro',
    language: 'Idioma',
    switchLanguage: 'Switch to English',
    languageShort: 'EN',
    motionReduce: 'Reduzir animações',
    motionRestore: 'Restaurar animações',
    preferences: 'Preferências',
  },
  shelf: {
    save: (title: string) => `Salvar na estante: ${title}`,
    unsave: (title: string) => `Remover da estante: ${title}`,
    saveShort: 'Salvar',
    savedShort: 'Salvo',
  },
  banner: {
    text: 'Versão 1.0 em modo demonstração: o catálogo traz cursos reais verificados; os agentes e seus eventos são simulados localmente.',
    link: 'Como funciona',
    dismiss: 'Dispensar aviso',
  },
  footer: {
    about:
      'Plataforma de inteligência educacional que conecta pessoas a cursos, certificações e competências, com transparência sobre cada fonte.',
    product: 'Produto',
    institutional: 'Institucional',
    experiences: 'Experiências',
    experienceLinks: { forja: 'A Forja', origem: 'A origem', lion: 'O Leão de Judá' },
    transparency: 'Transparência',
    transparencyText:
      'Registros com o selo Verificado foram conferidos manualmente na fonte oficial. O selo Demo identifica dados fictícios. Nenhum agente autônomo está em produção nesta versão.',
    version: 'Versão 1.0 · modo demonstração',
    rights: 'Projeto Bezalel. Conteúdo dos cursos pertence às respectivas instituições.',
    builtWith: 'Publicado como site estático.',
  },
  enums: {
    level: {
      beginner: 'Iniciante',
      intermediate: 'Intermediário',
      advanced: 'Avançado',
      'all-levels': 'Todos os níveis',
      unknown: 'Não informado',
    },
    priceType: {
      free: 'Gratuito',
      'free-with-paid-certificate': 'Gratuito · certificado pago',
      paid: 'Pago',
      varies: 'Preço varia',
      unknown: 'Preço não informado',
    },
    modality: {
      online: 'Online',
      'online-self-paced': 'Online · no seu ritmo',
      'online-scheduled': 'Online · com turmas',
      'in-person': 'Presencial',
      hybrid: 'Híbrido',
      unknown: 'Não informado',
    },
    opportunityType: {
      course: 'Curso',
      certification: 'Certificação',
      'learning-path': 'Trilha de aprendizagem',
    },
    certificateType: {
      'free-certificate': 'Certificado gratuito',
      'paid-certificate': 'Certificado pago',
      'free-and-paid-options': 'Certificado gratuito e opção paga',
      'digital-badge': 'Selo digital (badge)',
      'professional-certification': 'Certificação profissional',
      'none-stated': 'Sem certificado',
    },
    verificationStatus: {
      verified: 'Verificado',
      'partially-verified': 'Parcialmente verificado',
      unverified: 'Não verificado',
      outdated: 'Desatualizado',
      failed: 'Falha na verificação',
    },
    verificationStatusHelp: {
      verified: 'As informações principais foram confirmadas na fonte oficial.',
      'partially-verified': 'Parte das informações foi confirmada; campos não confirmados aparecem como "Não informado".',
      unverified: 'Ainda não conferido na fonte. Use com cautela.',
      outdated: 'A última conferência passou do prazo de 180 dias.',
      failed: 'A tentativa de verificação falhou (ex.: fonte indisponível).',
    },
    publicationStatus: {
      found: 'Encontrado',
      validating: 'Em validação',
      approved: 'Aprovado',
      rejected: 'Rejeitado',
      published: 'Publicado',
      outdated: 'Desatualizado',
      removed: 'Removido',
    },
    publicationStatusHelp: {
      found: 'Identificado por um agente de descoberta; ainda não validado.',
      validating: 'Passando pelas verificações de fonte, HTTPS, atualidade, conteúdo e qualidade.',
      approved: 'Atendeu a todos os critérios bloqueantes e à nota mínima de qualidade.',
      rejected: 'Não atendeu a um critério bloqueante ou ficou abaixo da nota mínima.',
      published: 'Visível no catálogo público.',
      outdated: 'Publicado, mas sem nova conferência dentro do prazo — exibido com alerta.',
      removed: 'Retirado do catálogo (duplicado, encerrado ou a pedido da fonte).',
    },
    category: {
      'ai-ml': 'IA e Machine Learning',
      'computer-science': 'Ciência da Computação',
      'web-development': 'Desenvolvimento Web',
      data: 'Dados e Análise',
      'cloud-infra': 'Infraestrutura e Nuvem',
      'security-privacy': 'Segurança e Privacidade',
      'digital-government': 'Governo Digital',
      health: 'Saúde',
      'physical-education': 'Educação Física e Esporte',
      nutrition: 'Nutrição e Alimentação',
      'mental-health': 'Saúde Mental e Bem-estar',
      education: 'Educação e Docência',
      languages: 'Idiomas e Linguagens',
      business: 'Negócios e Empreendedorismo',
      finance: 'Finanças',
      career: 'Carreira e Liderança',
      design: 'Design e UX',
      marketing: 'Marketing e Comunicação',
      industry: 'Engenharia e Indústria',
      'agro-environment': 'Agro e Meio Ambiente',
      'public-admin-law': 'Gestão Pública e Direito',
    },
    agentStatus: {
      active: 'Ativo',
      idle: 'Ocioso',
      failed: 'Com falha',
      offline: 'Desligado',
    },
    environmentMode: {
      demo: 'Modo demonstração',
      production: 'Produção',
    },
    duration: (value: number, unit: 'hours' | 'weeks' | 'lessons' | 'modules' | 'hours-per-week') => {
      const plural = value !== 1;
      switch (unit) {
        case 'hours':
          return `${value} ${plural ? 'horas' : 'hora'}`;
        case 'weeks':
          return `${value} ${plural ? 'semanas' : 'semana'}`;
        case 'lessons':
          return `${value} ${plural ? 'aulas' : 'aula'}`;
        case 'modules':
          return `${value} ${plural ? 'módulos' : 'módulo'}`;
        case 'hours-per-week':
          return `~${value} h por semana`;
      }
    },
    language: {
      en: 'Inglês',
      'pt-BR': 'Português (Brasil)',
      'pt-PT': 'Português (Portugal)',
      es: 'Espanhol',
    } as Record<string, string>,
  },
  validationChecks: {
    'has-title': { name: 'Título presente', help: 'O registro precisa de um título com ao menos 5 caracteres.' },
    'has-provider': { name: 'Instituição identificada', help: 'A instituição responsável precisa ser conhecida.' },
    'https-url': { name: 'Link seguro (HTTPS)', help: 'A fonte original deve usar conexão segura.' },
    'trusted-source': { name: 'Fonte autorizada', help: 'Só fontes com permissão e confiança registradas são aceitas.' },
    'safe-content': { name: 'Conteúdo seguro', help: 'Textos externos com marcação executável são recusados.' },
    fresh: { name: 'Informação atual', help: 'A última atualização precisa ter no máximo 180 dias.' },
    'known-category': { name: 'Categoria reconhecida', help: 'Aviso: sem categoria, o registro é mais difícil de encontrar.' },
    'price-declared': { name: 'Preço declarado', help: 'Aviso: a condição de preço deve estar clara para o usuário.' },
    'description-length': { name: 'Descrição suficiente', help: 'Aviso: descrições muito curtas reduzem a nota de qualidade.' },
  },
  pipelineStages: {
    discovery: { name: 'Descoberta', help: 'Seleciona apenas fontes autorizadas.' },
    collection: { name: 'Coleta', help: 'Obtém registros brutos respeitando termos e limites.' },
    normalization: { name: 'Normalização', help: 'Converte textos livres em campos padronizados.' },
    deduplication: { name: 'Deduplicação', help: 'Compara identificador, URL normalizada e título.' },
    validation: { name: 'Validação', help: 'Aplica critérios bloqueantes e avisos.' },
    quality: { name: 'Qualidade', help: 'Atribui nota de 0 a 100 (mínimo 70).' },
    publication: { name: 'Publicação', help: 'Publica apenas o que atende aos critérios.' },
    'event-log': { name: 'Registro de eventos', help: 'Toda ação gera um evento auditável.' },
    monitoring: { name: 'Monitoramento', help: 'Falhas são registradas e tentadas novamente.' },
  },
  meta: {
    siteName: 'Bezalel',
    defaultDescription:
      'Bezalel é uma plataforma de inteligência educacional que conecta pessoas a cursos gratuitos, certificações e competências, com agentes de IA e fontes verificáveis.',
    home: {
      title: 'Bezalel — Discover. Learn. Build.',
      description:
        'Descubra cursos e certificações verificados na fonte, entenda competências em evidência e conheça o laboratório dos agentes de IA da Bezalel.',
    },
    trail: {
      title: 'Descubra sua trilha',
      description: 'Responda quatro perguntas e receba uma trilha curta de cursos reais e verificados, com carga horária, plano de estudos e link para compartilhar.',
    },
    saved: {
      title: 'Minha estante',
      description: 'Seus cursos salvos e o progresso que você marcou, guardados só no seu navegador — com comparador, plano de estudos e calculadora de horas.',
    },
    skills: {
      title: 'Constelação de competências',
      description: 'As competências do catálogo verificado como um céu: estrelas ligadas pelos cursos que as ensinam juntas. Os cursos que você salva acendem a sua parte e sugerem o próximo passo.',
    },
    compare: {
      title: 'Comparar cursos',
      description: 'Compare até três cursos lado a lado: preço, certificado, carga horária, nível, idioma, competências e verificação na fonte.',
    },
    explore: {
      title: 'Explorar oportunidades',
      description: 'Catálogo de cursos, certificações e trilhas com busca, filtros e indicadores de verificação na fonte oficial.',
    },
    insights: {
      title: 'Inteligência de competências',
      description: 'Competências e categorias observadas no catálogo verificado, com metodologia e limites explícitos.',
    },
    agents: {
      title: 'Ecossistema de agentes',
      description: 'Conheça Scout, Verifier, Vigia, Atlas, Trend e Sol: funções, estados, limitações e eventos recentes (modo demonstração).',
    },
    lion: {
      title: 'O Leão da tribo de Judá',
      description: 'Apocalipse 5 em luz, ao rolar: o livro dos sete selos e o Leão da tribo de Judá formado de poeira de luz — com o texto, o contexto e a interpretação artística.',
    },
    universe: {
      title: 'Bezalel Universe',
      description: 'Pilote um carro voador por uma cidade 3D e visite a sede, o laboratório de IA e o centro de produtos da Bezalel — com um mapa 2D para quem prefere sem 3D.',
    },
    lab: {
      title: 'Laboratório 3D',
      description: 'Explore em 3D as estações de trabalho dos agentes da Bezalel e acompanhe a Central de Operações em tempo real (simulação).',
    },
    assistant: {
      title: 'Assistente Sol',
      description: 'Converse com o Sol para encontrar cursos do catálogo e entender verificações. Respostas baseadas em regras locais e transparentes.',
    },
    about: {
      title: 'Sobre a Bezalel',
      description: 'Missão, significado do nome e compromisso com informações confiáveis e fontes verificáveis.',
    },
    methodology: {
      title: 'Metodologia',
      description: 'Como a Bezalel verifica, valida, publica e mantém registros de cursos e certificações.',
    },
    privacy: {
      title: 'Política de privacidade (preliminar)',
      description: 'Rascunho preliminar da política de privacidade da Bezalel, sujeito a revisão antes do lançamento público.',
    },
    terms: {
      title: 'Termos de uso (preliminar)',
      description: 'Rascunho preliminar dos termos de uso da Bezalel, sujeito a revisão antes do lançamento público.',
    },
    notFound: {
      title: 'Página não encontrada',
      description: 'O endereço acessado não existe na Bezalel.',
    },
    courseDescription: (title: string, provider: string) =>
      `${title}, oferecido por ${provider}. Detalhes, preço, certificado e estado de verificação na Bezalel.`,
  },
};
