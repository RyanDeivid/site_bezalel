import type { Category, CategoryGroup, CategoryGroupId, CategoryId, LocalizedText } from '../../types/domain.ts';

const g = (id: CategoryGroupId, pt: string, en: string, tPt: string, tEn: string): CategoryGroup => ({
  id,
  name: { 'pt-BR': pt, en },
  tagline: { 'pt-BR': tPt, en: tEn },
});

/**
 * Grupos de áreas. A home e a Forja mostram primeiro os grupos (7 escolhas)
 * em vez das 21 áreas de uma vez — menos sobrecarga de escolha.
 */
export const categoryGroups: CategoryGroup[] = [
  g('tech', 'Tecnologia', 'Technology', 'Programação, IA, dados, nuvem e segurança.', 'Programming, AI, data, cloud and security.'),
  g('health', 'Saúde e bem-estar', 'Health & well-being', 'Saúde pública, movimento, alimentação e mente.', 'Public health, movement, food and mind.'),
  g('learning', 'Educação e idiomas', 'Education & languages', 'Ensinar, aprender e se comunicar em outras línguas.', 'Teaching, learning and communicating in other languages.'),
  g('business', 'Negócios e carreira', 'Business & career', 'Empreender, cuidar do dinheiro e crescer no trabalho.', 'Starting ventures, managing money and growing at work.'),
  g('creative', 'Design e comunicação', 'Design & communication', 'Experiência do usuário, design e comunicação.', 'User experience, design and communication.'),
  g('production', 'Indústria e meio ambiente', 'Industry & environment', 'Engenharia, energia, água, clima e campo.', 'Engineering, energy, water, climate and farming.'),
  g('public', 'Governo e direito', 'Government & law', 'Serviço público digital, leis, ética e transparência.', 'Digital public services, law, ethics and transparency.'),
];

const c = (id: CategoryId, group: CategoryGroupId, pt: string, en: string, dPt: string, dEn: string): Category => ({
  id,
  group,
  name: { 'pt-BR': pt, en },
  description: { 'pt-BR': dPt, en: dEn },
});

/**
 * Áreas de conhecimento usadas no catálogo e nos insights. A ordem segue os
 * grupos: áreas vizinhas recebem cores vizinhas na Forja.
 */
export const categories: Category[] = [
  c('ai-ml', 'tech', 'IA e Machine Learning', 'AI & Machine Learning', 'Fundamentos de IA, aprendizado de máquina, deep learning, LLMs e agentes.', 'AI fundamentals, machine learning, deep learning, LLMs and agents.'),
  c('computer-science', 'tech', 'Ciência da Computação', 'Computer Science', 'Programação, algoritmos, estruturas de dados e pensamento computacional.', 'Programming, algorithms, data structures and computational thinking.'),
  c('web-development', 'tech', 'Desenvolvimento Web', 'Web Development', 'HTML, CSS, JavaScript, frameworks e desenvolvimento full stack.', 'HTML, CSS, JavaScript, frameworks and full-stack development.'),
  c('data', 'tech', 'Dados e Análise', 'Data & Analytics', 'Planilhas, análise e visualização de dados.', 'Spreadsheets, data analysis and visualization.'),
  c('cloud-infra', 'tech', 'Infraestrutura e Nuvem', 'Cloud & Infrastructure', 'Sistemas operacionais, linha de comando, redes e nuvem.', 'Operating systems, command line, networking and cloud.'),
  c('security-privacy', 'tech', 'Segurança e Privacidade', 'Security & Privacy', 'Proteção de dados, LGPD, segurança da informação e governança.', 'Data protection, privacy law, information security and governance.'),
  c('health', 'health', 'Saúde', 'Health', 'Saúde pública, SUS, epidemiologia, vigilância sanitária e saúde global.', 'Public health, health systems, epidemiology, health surveillance and global health.'),
  c('physical-education', 'health', 'Educação Física e Esporte', 'Physical Education & Sport', 'Ciência do exercício, atividade física e saúde, esporte e sociedade.', 'Exercise science, physical activity and health, sport and society.'),
  c('nutrition', 'health', 'Nutrição e Alimentação', 'Nutrition & Food', 'Alimentação saudável, nutrição infantil e segurança dos alimentos.', 'Healthy eating, child nutrition and food safety.'),
  c('mental-health', 'health', 'Saúde Mental e Bem-estar', 'Mental Health & Well-being', 'Bem-estar, inteligência emocional, atenção plena e primeiros cuidados psicológicos.', 'Well-being, emotional intelligence, mindfulness and psychological first aid.'),
  c('education', 'learning', 'Educação e Docência', 'Education & Teaching', 'Metodologias ativas, aprender a aprender, formação de professores e direitos humanos.', 'Active learning, learning how to learn, teacher training and human rights education.'),
  c('languages', 'learning', 'Idiomas e Linguagens', 'Languages', 'Libras, português, inglês para a carreira e mandarim.', 'Brazilian Sign Language, Portuguese, English for careers and Mandarin.'),
  c('business', 'business', 'Negócios e Empreendedorismo', 'Business & Entrepreneurship', 'Empreendedorismo, inovação, gestão de projetos e métodos ágeis.', 'Entrepreneurship, innovation, project management and agile methods.'),
  c('finance', 'business', 'Finanças', 'Finance', 'Finanças pessoais, mercados financeiros, orçamento público e educação fiscal.', 'Personal finance, financial markets, public budgeting and tax literacy.'),
  c('career', 'business', 'Carreira e Liderança', 'Career & Leadership', 'Liderança, negociação, comunicação interpessoal e busca de emprego.', 'Leadership, negotiation, interpersonal communication and job search.'),
  c('design', 'creative', 'Design e UX', 'Design & UX', 'Experiência do usuário, design thinking, UX writing, pesquisa e design gráfico.', 'User experience, design thinking, UX writing, research and graphic design.'),
  c('marketing', 'creative', 'Marketing e Comunicação', 'Marketing & Communication', 'Marketing digital, comunicação institucional, linguagem simples e acessibilidade.', 'Digital marketing, institutional communication, plain language and accessibility.'),
  c('industry', 'production', 'Engenharia e Indústria', 'Engineering & Industry', 'Mecânica, obras, BIM e eficiência energética.', 'Mechanics, construction, BIM and energy efficiency.'),
  c('agro-environment', 'production', 'Agro e Meio Ambiente', 'Agriculture & Environment', 'Clima, água, educação ambiental, ciência cidadã e agricultura sustentável.', 'Climate, water, environmental education, citizen science and sustainable farming.'),
  c('digital-government', 'public', 'Governo Digital', 'Digital Government', 'Transformação digital, IA responsável e serviços públicos.', 'Digital transformation, responsible AI and public services.'),
  c('public-admin-law', 'public', 'Gestão Pública e Direito', 'Public Administration & Law', 'Licitações e contratos, ética, transparência e direitos humanos.', 'Public procurement, ethics, transparency and human rights.'),
];

export interface SkillDefinition {
  id: string;
  name: LocalizedText;
  category: CategoryId;
  description: LocalizedText;
}


export const categoryIds: CategoryId[] = categories.map((c) => c.id);

/** Grupo de cada área (para navegação e para a Forja). */
export const categoryGroupOf: Record<CategoryId, CategoryGroup['id']> = Object.fromEntries(categories.map((c) => [c.id, c.group])) as Record<
  CategoryId,
  CategoryGroup['id']
>;
