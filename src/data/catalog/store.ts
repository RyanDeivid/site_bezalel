import type { Course, Locale } from '../../types/domain.ts';
import type { SkillDefinition } from './taxonomy.ts';

/**
 * Catálogo curado carregado sob demanda: os registros e as definições de
 * competências ficam num chunk próprio (fora do JS inicial), baixado em
 * paralelo com o bundle principal — o pós-build põe um
 * <link rel="modulepreload"> para ele em toda página — e aguardado antes do
 * primeiro render (main.tsx) e da pré-renderização (entry-server.tsx). O HTML
 * já traz o conteúdo pré-renderizado; isto só garante que o React tenha os
 * mesmos dados ao hidratar.
 */
interface Loaded {
  courses: Course[];
  skills: SkillDefinition[];
  skillById: Map<string, SkillDefinition>;
}

let loaded: Loaded | null = null;
let pending: Promise<Course[]> | null = null;

export function loadCatalog(): Promise<Course[]> {
  if (loaded) return Promise.resolve(loaded.courses);
  pending ??= import('./courses.ts').then((mod) => {
    loaded = { courses: mod.curatedCourses, skills: mod.skillDefinitions, skillById: new Map(mod.skillDefinitions.map((s) => [s.id, s])) };
    return loaded.courses;
  });
  return pending;
}

function ready(): Loaded {
  if (!loaded) throw new Error('Catálogo ainda não carregado: aguarde loadCatalog() antes de criar os serviços locais.');
  return loaded;
}

/** Registros curados já carregados (chame `loadCatalog()` antes). */
export function curated(): Course[] {
  return ready().courses;
}

/** Definições de competências já carregadas (chame `loadCatalog()` antes). */
export function skills(): SkillDefinition[] {
  return ready().skills;
}

/** Nome de uma competência no idioma pedido (o id, se ela não existir). */
export function skillName(id: string, locale: Locale): string {
  return ready().skillById.get(id)?.name[locale] ?? id;
}
