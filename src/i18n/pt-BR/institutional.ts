export const institutional = {
  about: {
    eyebrow: 'Sobre',
    title: 'Conhecimento só se completa quando vira criação.',
    lead: 'A Bezalel é uma plataforma de inteligência educacional: conecta pessoas a oportunidades de aprendizado confiáveis e explica, com transparência, de onde vem cada informação.',
    missionTitle: 'Missão',
    mission:
      'Ajudar pessoas a descobrir o que vale aprender, entender as competências que cada oportunidade desenvolve e construir seus caminhos com informação verificável — sem ruído, sem promessas vazias.',
    reliabilityTitle: 'Por que confiabilidade importa',
    reliability: [
      'Informações sobre cursos envelhecem rápido: preços mudam, certificados deixam de ser gratuitos, turmas encerram. Um catálogo que não diz quando foi conferido não diz quase nada.',
      'Por isso cada registro da Bezalel mostra a fonte oficial, a data da última conferência e exatamente o que foi — e o que não foi — confirmado. Quando a fonte não informa, a Bezalel também não inventa.',
    ],
    agentsTitle: 'O papel dos agentes',
    agents:
      'Agentes especializados dividem o trabalho em etapas auditáveis: o Scout descobre, o Verifier valida e publica, o Atlas relaciona competências, o Trend analisa o catálogo e o Sol ajuda a navegar. Cada ação gera um evento registrado. Nesta versão, os agentes funcionam em modo demonstração, com uma simulação local e determinística.',
    labTitle: 'O laboratório',
    lab: 'O laboratório 3D torna esse trabalho visível: estações para cada agente, fluxos de dados entre elas e uma Central de Operações que acompanha cada evento. Quando um backend com agentes reais existir, o laboratório passará a refletir a atividade real pela mesma interface de eventos.',
    commitmentsTitle: 'Compromissos de transparência',
    commitments: [
      'Toda oportunidade aponta para a fonte original.',
      'Dado real e dado de demonstração nunca se misturam e sempre são rotulados.',
      'Campos não confirmados aparecem como “Não informado”; inferências são sinalizadas.',
      'Indicadores diferentes (cursos, menções, vagas) nunca são apresentados como equivalentes.',
      'Nenhuma coleta automatizada ignora termos de uso, permissões ou limites das fontes.',
      'Limitações de cada agente são declaradas publicamente.',
    ],
    statusTitle: 'Onde estamos (v1.0)',
    statusReal: 'Real nesta versão',
    statusRealItems: ['Catálogo curado de cursos e certificações conferidos na fonte', 'Busca, filtros e páginas de detalhe', 'Insights calculados sobre o catálogo verificado', 'Assistente com regras locais transparentes'],
    statusDemoTitle: 'Demonstração nesta versão',
    statusDemoItems: ['Atividade dos agentes e eventos da Central de Operações', 'Registros fictícios do pipeline', 'Série temporal de menções'],
    cta: 'Ler a metodologia',
  },
  methodology: {
    eyebrow: 'Metodologia',
    title: 'Como cada informação chega até você',
    lead: 'Critérios explícitos, estados auditáveis e limites declarados. Esta página descreve o que a v1.0 faz de fato — e o que ainda depende de um backend.',
    toc: 'Nesta página',
    curation: {
      title: 'Curadoria e fontes',
      body: [
        'Os registros reais da v1.0 foram conferidos manualmente, em 10/10/2026, nas páginas oficiais de cada instituição. Nenhum robô coletou essas páginas.',
        'Para cada registro guardamos a URL da fonte, a data da conferência e uma nota sobre o escopo da verificação: o que foi confirmado e o que a página não informa.',
      ],
      sourcesTitle: 'Fontes consultadas',
    },
    badges: {
      title: 'O que significa cada selo',
      items: [
        { name: 'Verificado', text: 'Registro real; as informações principais foram confirmadas na fonte oficial.' },
        { name: 'Parcialmente verificado', text: 'Registro real; parte dos campos não pôde ser confirmada e aparece como “Não informado”.' },
        { name: 'Desatualizado', text: 'A última conferência passou de 180 dias. O registro continua visível, com alerta.' },
        { name: 'Demo', text: 'Dado fictício de demonstração. Nunca representa um curso, instituição ou medição real.' },
      ],
    },
    rules: {
      title: 'Regras de preenchimento',
      items: [
        'Um campo só é preenchido quando a fonte o declara. Ausência vira “Não informado”, nunca suposição.',
        'Quando o nível é deduzido dos pré-requisitos ou da proposta do curso, ele aparece com a marca “inferido”.',
        'Competências são a classificação da curadoria a partir do conteúdo declarado — não afirmações do provedor.',
        'Descrições são resumos próprios em português, não cópias do texto da fonte.',
        'Dados estruturados (schema.org) são publicados apenas para registros reais verificados, só com campos confirmados.',
      ],
    },
    pipeline: {
      title: 'Pipeline dos agentes',
      lead: 'Cada etapa tem um contrato próprio no código (domain/pipeline). Agentes reais deverão rodar no servidor implementando esses contratos.',
    },
    checks: {
      title: 'Critérios de validação',
      lead: 'Critérios bloqueantes reprovam o registro. Avisos não reprovam, mas reduzem a nota de qualidade.',
      blocking: 'Bloqueante',
      warning: 'Aviso',
      criterion: 'Critério',
      severity: 'Tipo',
      description: 'Descrição',
    },
    quality: {
      title: 'Nota de qualidade',
      body: [
        'A nota vai de 0 a 100. Até 60 pontos vêm da validação: o registro precisa passar em todos os critérios bloqueantes, e cada aviso desconta 10 pontos.',
        'Os outros 40 pontos vêm da completude: duração, certificado, competências, descrição detalhada e nível declarados valem 8 pontos cada.',
        'Um registro só pode ser publicado com todos os critérios bloqueantes atendidos e nota mínima de 70.',
      ],
    },
    states: {
      title: 'Estados de um registro',
      lead: 'Transições fora deste fluxo são recusadas pelo sistema.',
    },
    dedupe: {
      title: 'Deduplicação',
      items: [
        'Identificador estável da fonte, quando existe.',
        'URL normalizada: sem “www”, sem barra final, sem fragmento e sem parâmetros de rastreamento (utm_*, gclid, fbclid…).',
        'Impressão digital: instituição + título normalizados (sem acentos, caixa e pontuação).',
      ],
    },
    freshness: {
      title: 'Atualidade',
      body: 'Um registro é considerado atual se sua última confirmação tem no máximo 180 dias. Depois disso ele é marcado como desatualizado e volta para validação.',
    },
    collection: {
      title: 'Política de coleta (para agentes futuros)',
      items: [
        'Priorizar APIs oficiais, dados abertos autorizados e páginas institucionais.',
        'Respeitar termos de uso, robots.txt, permissões e limites de requisição de cada fonte.',
        'Nada de coleta indiscriminada: cada fonte entra no registro de confiança antes de ser consultada.',
        'Tratar todo dado externo como não confiável: nada vindo de uma fonte é executado; marcação é removida e o registro é reprovado.',
        'A coleta acontece no servidor, nunca no navegador do visitante.',
      ],
    },
    example: {
      title: 'Exemplo: execução demonstrativa do pipeline',
      lead: 'Resultado real das regras acima aplicadas a registros FICTÍCIOS de demonstração. Os estados não são escritos à mão: decorrem da validação.',
      record: 'Registro (fictício)',
      result: 'Resultado',
      reason: 'Motivo',
      score: 'Nota',
      duplicateOf: (reason: string) => `Duplicado (${reason})`,
      reasons: {
        url: 'mesma URL normalizada',
        fingerprint: 'mesma instituição e título',
        'external-id': 'mesmo identificador',
        belowMin: 'nota abaixo de 70',
        approved: 'todos os critérios atendidos',
      },
    },
    limits: {
      title: 'Limitações conhecidas',
      items: [
        'O catálogo da v1.0 é pequeno e curado manualmente; não é um levantamento completo de oportunidades.',
        'Não há reconferência automática: as datas refletem a curadoria manual.',
        'Agentes e eventos são simulados; nenhum agente autônomo está em produção.',
        'Não há fonte de vagas conectada; nenhum indicador de demanda de mercado é calculado.',
        'Hospedagem estática: não há contas de usuário, favoritos sincronizados nem notificações.',
      ],
    },
  },
  legal: {
    draftBadge: 'Rascunho preliminar',
    draftNotice:
      'Este texto é um rascunho preliminar, elaborado para a versão de demonstração. Ele deve ser revisado por profissional habilitado antes de qualquer lançamento público. A entidade responsável, o endereço e o canal de contato ainda não foram definidos.',
    updated: 'Versão do rascunho: 10/10/2026',
    tbd: 'A definir antes do lançamento',
  },
  privacy: {
    eyebrow: 'Privacidade',
    title: 'Política de privacidade',
    sections: [
      {
        title: '1. Escopo desta versão',
        body: [
          'A Bezalel v1.0 é um site estático de demonstração. Não há cadastro, login, formulários de contato, pagamentos nem coleta de dados pessoais pela plataforma.',
        ],
      },
      {
        title: '2. Dados armazenados no seu navegador',
        body: [
          'Para lembrar suas preferências, o site grava no armazenamento local do seu navegador: tema (claro/escuro), idioma, preferência de animações, o fechamento do aviso de demonstração, os temas que você marcar na abertura da página inicial e a sua “Minha estante” — os cursos que você salvar e o progresso que marcar neles — e a última trilha que você montou, para a página inicial oferecer “continue de onde parou”. A abertura animada e o modo do laboratório usam o armazenamento da sessão.',
          'As ferramentas (trilha, comparador, plano de estudos e calculadora de horas) funcionam inteiramente no seu navegador. O arquivo de agenda (.ics) do plano de estudos é gerado e baixado no próprio aparelho, sem passar por nenhum servidor.',
          'Esses dados ficam apenas no seu dispositivo, não são enviados a nenhum servidor da Bezalel e podem ser apagados limpando os dados do site no navegador.',
          'A Bezalel não usa cookies próprios, ferramentas de análise, pixels de publicidade nem rastreadores nesta versão.',
        ],
      },
      {
        title: '3. Assistente Sol',
        body: [
          'No modo de demonstração, as perguntas feitas ao Sol são processadas inteiramente no seu navegador, por regras locais, e não são enviadas nem armazenadas.',
          'Se no futuro o assistente passar a usar um serviço de backend, esta política será atualizada antes da mudança, descrevendo o que é enviado, por quanto tempo é guardado e com quem é compartilhado.',
        ],
      },
      {
        title: '4. Hospedagem',
        body: [
          'O site é publicado no GitHub Pages. Como qualquer servidor web, a infraestrutura de hospedagem pode registrar dados técnicos de acesso (como endereço IP) conforme a política de privacidade do próprio GitHub, sobre a qual a Bezalel não tem controle.',
        ],
      },
      {
        title: '5. Links externos',
        body: [
          'Os registros apontam para páginas oficiais de instituições de ensino. Ao acessá-las, você passa a estar sujeito às políticas dessas instituições. Os links abrem em nova aba e não repassam a página de origem.',
        ],
      },
      {
        title: '6. Controlador e contato',
        body: ['A pessoa ou entidade controladora dos dados e o canal de contato para exercício de direitos (LGPD) serão definidos antes do lançamento público.'],
      },
    ],
  },
  terms: {
    eyebrow: 'Termos',
    title: 'Termos de uso',
    sections: [
      {
        title: '1. Natureza do serviço',
        body: [
          'A Bezalel organiza e apresenta informações públicas sobre cursos, certificações e competências, com indicação da fonte original. É um serviço informativo: a Bezalel não oferece os cursos listados nem emite certificados.',
        ],
      },
      {
        title: '2. Exatidão das informações',
        body: [
          'As informações foram conferidas nas fontes oficiais nas datas indicadas, mas podem mudar a qualquer momento. Confirme preço, prazos, requisitos e certificação diretamente na fonte antes de se inscrever.',
          'Campos não confirmados são exibidos como “Não informado”. Nenhuma garantia é dada sobre conteúdo mantido por terceiros.',
        ],
      },
      {
        title: '3. Dados de demonstração',
        body: [
          'Registros, eventos e séries marcados com o selo Demo são fictícios e existem apenas para demonstrar o funcionamento da plataforma. Não devem ser usados para qualquer decisão.',
        ],
      },
      {
        title: '4. Sem aconselhamento profissional',
        body: ['O conteúdo e o assistente Sol não constituem aconselhamento profissional, educacional ou de carreira personalizado.'],
      },
      {
        title: '5. Propriedade intelectual',
        body: [
          'Nomes, marcas e conteúdos dos cursos pertencem às respectivas instituições. As descrições exibidas são resumos próprios, acompanhados de link para a fonte.',
          'A licença do código da plataforma ainda será definida pelo titular do projeto.',
        ],
      },
      {
        title: '6. Uso aceitável',
        body: ['Não é permitido usar a plataforma para fins ilícitos, tentar comprometer sua segurança ou sobrecarregar a infraestrutura de hospedagem.'],
      },
      {
        title: '7. Alterações, responsável e foro',
        body: [
          'Estes termos podem mudar com a evolução da plataforma. A entidade responsável, a legislação aplicável e o foro serão definidos antes do lançamento público.',
        ],
      },
    ],
  },
  notFound: {
    code: '404',
    title: 'Esta página não existe — ainda.',
    body: 'O endereço pode ter mudado ou nunca ter existido. Talvez uma destas rotas ajude:',
    home: 'Voltar ao início',
  },
  routeError: {
    title: 'Algo deu errado ao abrir esta página',
    body: 'Um erro inesperado impediu a exibição. Você pode tentar novamente ou voltar ao início.',
    reload: 'Recarregar',
    home: 'Ir para o início',
  },
};
