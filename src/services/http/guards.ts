import type { Agent, AgentEvent, Course, Skill, Source } from '@/types/domain';

/**
 * Validação estrutural de respostas da API. Propositalmente simples: confere
 * campos obrigatórios e tipos primitivos. Um backend real deve publicar um
 * schema (OpenAPI/JSON Schema) e estes guards podem ser gerados a partir dele.
 */
export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isHttpsUrl = (v: unknown) => isStr(v) && /^https:\/\//i.test(v);

export function isCourse(v: unknown): v is Course {
  return (
    isObject(v) &&
    isStr(v.id) &&
    isStr(v.slug) &&
    isStr(v.title) &&
    isStr(v.description) &&
    isObject(v.provider) &&
    isStr(v.provider.name) &&
    Array.isArray(v.skills) &&
    isHttpsUrl(v.sourceUrl) &&
    isStr(v.lastCheckedAt) &&
    isStr(v.verificationStatus) &&
    isStr(v.publicationStatus) &&
    isStr(v.origin)
  );
}

export const isCourseOrNull = (v: unknown): v is Course | null => v === null || isCourse(v);
export const isCourseList = (v: unknown): v is Course[] => Array.isArray(v) && v.every(isCourse);

export function isAgent(v: unknown): v is Agent {
  return isObject(v) && isStr(v.id) && isStr(v.name) && isObject(v.role) && isStr(v.status) && isStr(v.mode);
}
export const isAgentList = (v: unknown): v is Agent[] => Array.isArray(v) && v.every(isAgent);

export function isAgentEvent(v: unknown): v is AgentEvent {
  return (
    isObject(v) &&
    isStr(v.id) &&
    isStr(v.agentId) &&
    isStr(v.type) &&
    isStr(v.timestamp) &&
    isStr(v.summary) &&
    isStr(v.result) &&
    (v.environmentMode === 'demo' || v.environmentMode === 'production')
  );
}
export const isAgentEventList = (v: unknown): v is AgentEvent[] => Array.isArray(v) && v.every(isAgentEvent);

export const isSkillList = (v: unknown): v is Skill[] => Array.isArray(v) && v.every((s) => isObject(s) && isStr(s.id) && isObject(s.name));
export const isSourceList = (v: unknown): v is Source[] =>
  Array.isArray(v) && v.every((s) => isObject(s) && isStr(s.id) && isStr(s.name) && isHttpsUrl(s.url));
