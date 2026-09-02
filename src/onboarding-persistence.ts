export type Draft = Record<string, string | string[]>;
export type Flow = 'operator' | 'brand';
type SaveResponse = { session_id: string; status: string; saved_at: string };
// Serialize saves so a first autosave and Submit cannot create two sessions.
let pending: Promise<unknown> = Promise.resolve();
export function saveOnboarding(form: Draft, flow: Flow, step: string, progress: number, submit = false): Promise<SaveResponse> {
  const work = pending.catch(() => undefined).then(async () => {
    const key = `irl-onboarding-session-${flow}`;
    const session = localStorage.getItem(key) || (flow === 'operator' ? localStorage.getItem('irl-onboarding-session') : null);
    const response = await fetch(flow === 'brand' ? '/.netlify/functions/brand-onboarding' : '/.netlify/functions/onboarding', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: session, flow, current_step: step, completion_percentage: progress, schema_version: `${flow}-onboarding-v01`, submit, form }),
    });
    const data = await response.json().catch(() => ({ error: 'Unexpected server response.' }));
    if (!response.ok || !data.session_id) throw new Error(data.error || 'Online save failed. Please try again.');
    localStorage.setItem(key, data.session_id);
    return data as SaveResponse;
  });
  pending = work;
  return work;
}
export function initialFlow(): Flow | null {
  const flow = new URLSearchParams(window.location.search).get('flow') || localStorage.getItem('irl-flow');
  return flow === 'brand' || flow === 'operator' ? flow : null;
}
export function readDraft(flow: Flow | null): Draft {
  if (!flow) return {};
  const value = localStorage.getItem(`irl-draft-${flow}`)
    || (localStorage.getItem('irl-flow') === flow ? localStorage.getItem('irl-draft') : null);
  try { const parsed = JSON.parse(value || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; }
  catch { return {}; }
}
