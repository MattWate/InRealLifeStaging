type Draft = Record<string, string | string[]>;
type Flow = 'operator' | 'brand';

type SaveResponse = {
  session_id?: string;
  saved_at?: string;
  error?: string;
};

const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
let timer: number | undefined;
let saving = false;
let queuedDraft: Draft | null = null;
let queuedSubmit = false;
let queuedFlow: Flow | null = null;

export function initOnboardingPersistence() {
  const storagePrototype = Object.getPrototypeOf(window.localStorage) as Storage;
  const nativeSetItem = storagePrototype.setItem;

  storagePrototype.setItem = function patchedSetItem(key: string, value: string) {
    nativeSetItem.call(this, key, value);
    if (this !== window.localStorage || key !== 'irl-draft') return;

    try {
      const flow = currentFlow();
      if (!flow) return;
      queueSave(JSON.parse(value) as Draft, flow, false);
    } catch (error) {
      console.error('Unable to queue onboarding save', error);
    }
  };

  document.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement | null)?.closest('button');
    const flow = currentFlow();
    if (!button || !flow) return;
    if (!button.textContent?.toLowerCase().includes('save profile')) return;

    try {
      const raw = window.localStorage.getItem('irl-draft') || '{}';
      queueSave(JSON.parse(raw) as Draft, flow, true, 0);
    } catch (error) {
      console.error('Unable to submit onboarding profile', error);
    }
  });

  window.addEventListener('beforeunload', () => {
    if (!queuedDraft || !queuedFlow) return;
    const payload = buildPayload(queuedDraft, queuedFlow, queuedSubmit);
    navigator.sendBeacon('/.netlify/functions/onboarding', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  });
}

function queueSave(draft: Draft, flow: Flow, submit: boolean, delay = 650) {
  queuedDraft = draft;
  queuedFlow = flow;
  queuedSubmit = queuedSubmit || submit;
  window.clearTimeout(timer);
  timer = window.setTimeout(flush, delay);
}

async function flush() {
  if (saving || !queuedDraft || !queuedFlow) return;
  const draft = queuedDraft;
  const flow = queuedFlow;
  const submit = queuedSubmit;
  queuedDraft = null;
  queuedFlow = null;
  queuedSubmit = false;

  if (!hasMinimumIdentity(draft, flow)) return;

  saving = true;
  setSaveLabel(submit ? 'Submitting profile…' : 'Saving online…');
  try {
    const response = await fetch('/.netlify/functions/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload(draft, flow, submit)),
    });
    const text = await response.text();
    let data: SaveResponse = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
    if (!response.ok) throw new Error(data.error || `Save failed with status ${response.status}`);

    if (data.session_id) {
      originalSetItem(sessionStorageKey(flow), data.session_id);
      // Backwards compatibility for operator sessions created before flow-specific keys.
      if (flow === 'operator') originalSetItem('irl-onboarding-session', data.session_id);
    }
    setSaveLabel(submit ? 'Profile submitted to IRL' : `Saved online at ${formatTime(data.saved_at)}`);
  } catch (error) {
    console.error(`${flow} onboarding online save failed`, error);
    setSaveLabel(error instanceof Error ? `Saved locally — ${error.message}` : 'Saved locally — online save failed');
  } finally {
    saving = false;
    if (queuedDraft) window.setTimeout(flush, 0);
  }
}

function buildPayload(form: Draft, flow: Flow, submit: boolean) {
  return {
    session_id: getSessionId(flow),
    flow,
    current_step: currentStep(flow),
    completion_percentage: completionPercentage(),
    schema_version: flow === 'brand' ? 'brand-onboarding-v01' : 'operator-onboarding-v01',
    submit,
    form,
  };
}

function currentFlow(): Flow | null {
  const value = window.localStorage.getItem('irl-flow');
  return value === 'brand' || value === 'operator' ? value : null;
}

function hasMinimumIdentity(draft: Draft, flow: Flow) {
  return flow === 'brand'
    ? Boolean(String(draft.brandName || '').trim())
    : Boolean(String(draft.operatorName || '').trim());
}

function sessionStorageKey(flow: Flow) {
  return `irl-onboarding-session-${flow}`;
}

function getSessionId(flow: Flow) {
  return window.localStorage.getItem(sessionStorageKey(flow))
    || (flow === 'operator' ? window.localStorage.getItem('irl-onboarding-session') : null);
}

function currentStep(flow: Flow) {
  const active = document.querySelector<HTMLButtonElement>('.step-list button.active');
  const label = active?.textContent?.replace(/^\s*\d+\s*/, '').trim().toLowerCase() || '';
  const operatorMap: Record<string, string> = {
    'your organisation': 'organisation',
    'your property': 'property',
    'your guests': 'guests',
    'spaces and experiences': 'spaces',
    'how it works': 'operations',
    'data and systems': 'data',
    'review and submit': 'review',
  };
  const brandMap: Record<string, string> = {
    'your team': 'team',
    'about your brand': 'brand',
    'the product or range': 'product',
    'who you want to reach': 'audience',
    'customer need and barrier': 'need',
    'how irl should add value': 'value',
    'making it work': 'operations',
    'what success looks like': 'success',
    'brand requirements': 'requirements',
    'review and submit': 'review',
  };
  return (flow === 'brand' ? brandMap : operatorMap)[label] || null;
}

function completionPercentage() {
  const bar = document.querySelector<HTMLElement>('.progress-bar');
  const width = Number.parseFloat(bar?.style.width || '0');
  return Number.isFinite(width) ? Math.max(0, Math.min(100, width)) : 0;
}

function setSaveLabel(message: string) {
  const label = document.querySelector<HTMLElement>('.save-state');
  if (!label) return;
  const icon = label.querySelector('svg')?.outerHTML || '';
  label.innerHTML = `${icon} ${escapeHtml(message)}`;
}

function formatTime(value?: string) {
  if (!value) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;',
  }[character] || character));
}
