import type { Source } from '../../types/domain.ts';

/**
 * Fontes oficiais consultadas na curadoria manual de 10/10/2026.
 *
 * `collectionPolicy: 'manual-curation'` significa que NENHUM robô coleta
 * essas páginas: elas foram lidas por uma pessoa. Coleta automatizada futura
 * exige API oficial ou permissão explícita, respeitando termos de uso,
 * robots.txt e limites de requisição (docs/AGENTS.md).
 */
const CHECKED = '2026-10-10';

const src = (id: string, name: string, url: string, sourceType: Source['sourceType']): Source => ({
  id,
  name,
  url,
  sourceType,
  trustStatus: 'trusted',
  lastCheckedAt: CHECKED,
  collectionPolicy: 'manual-curation',
  origin: 'curated',
});

export const curatedSources: Source[] = [
  src('src-harvard-cs50', 'CS50 — Harvard University', 'https://cs50.harvard.edu', 'official-site'),
  src('src-google-developers', 'Google for Developers', 'https://developers.google.com/machine-learning', 'official-site'),
  src('src-kaggle-learn', 'Kaggle Learn', 'https://www.kaggle.com/learn', 'official-site'),
  src('src-freecodecamp', 'freeCodeCamp', 'https://www.freecodecamp.org/learn/', 'official-site'),
  src('src-mit-ocw', 'MIT OpenCourseWare', 'https://ocw.mit.edu', 'open-courseware'),
  src('src-elements-of-ai', 'Elements of AI', 'https://www.elementsofai.com', 'official-site'),
  src('src-hugging-face-learn', 'Hugging Face Learn', 'https://huggingface.co/learn', 'official-site'),
  src('src-fast-ai', 'fast.ai', 'https://course.fast.ai', 'official-site'),
  src('src-odin-project', 'The Odin Project', 'https://www.theodinproject.com', 'official-site'),
  src('src-escola-virtual-gov', 'Escola Virtual.Gov (Enap)', 'https://www.escolavirtual.gov.br', 'institutional-page'),
  src('src-microsoft-learn', 'Microsoft Learn', 'https://learn.microsoft.com', 'official-site'),
  src('src-linux-foundation', 'Linux Foundation Training', 'https://training.linuxfoundation.org', 'official-site'),
  src('src-fundacao-bradesco', 'Escola Virtual — Fundação Bradesco', 'https://www.ev.org.br', 'institutional-page'),
];
