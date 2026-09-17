export const MAX_RESEARCH_IMPORT_BYTES = 1024 * 1024;

export type ResearchTargetMode = 'existing' | 'new';

export function parseResearchJson(raw: string) {
  if (!raw.trim()) throw new Error('Paste the research JSON or choose a JSON file.');
  if (new TextEncoder().encode(raw).byteLength > MAX_RESEARCH_IMPORT_BYTES) {
    throw new Error('The research JSON exceeds the 1 MB limit.');
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('The research file is not valid JSON.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The research JSON must contain one document object.');
  }
  return parsed;
}

export function buildResearchImportRequest(
  research: unknown,
  mode: ResearchTargetMode,
  organisationId: string,
  validateOnly: boolean,
) {
  if (mode === 'existing' && !organisationId) throw new Error('Select the existing brand this research belongs to.');
  return {
    ...(mode === 'existing' ? { organisation_id: organisationId } : { create_organisation: true }),
    validate_only: validateOnly,
    research,
  };
}
