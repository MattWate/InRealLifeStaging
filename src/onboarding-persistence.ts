type Draft = Record<string, string | string[]>;

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

export function initOnboardingPersistence() {
  const storagePrototype = Object.getPrototypeOf(window.localStorage) as Storage;
  const nativeSetItem = storagePrototype.setItem;

  storagePrototype.setItem = function patchedSetItem(key: string, value: string) {
    nativeSetItem.call(this, key, value);
    if (this !== window.localStorage || key !== 'irl-draft') return;

    try {
      const flow = window.localStorage.getItem('irl-flow');
      if (flow !== 'operator') return;
      queueSave(JSON.parse(value) as Draft, false);
    } catch (error) {
      console.error('Unable to queue operator onboarding save', error);
    }
  };

  document.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement | null)?.closest('button');
    if (!button || window.localStorage.getItem('irl-flow') !== 'operator') return;
    if (!button.textContent?.toLowerCase().includes('save profile')) return;

    try {
      const raw = window.localStorage.getItem('irl-draft') || '{}';
      queueSave(JSON.parse(raw) as Draft, true, 0);
    } catch (error) {
      console.error('Unable to submit operator onboarding profile', error);
    }
  });

  window.addEventListener('beforeunload', () => {
    if (!queuedDraft) return;
    const payload = buildPayload(queuedDraft, queuedSubmit);
    navigator.sendBeacon('/.netlify/functions/onboarding', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  });
}

function queueSave(draft: Draft, submit: boolean, delay = 650) {
  queuedDraft = draft;
  queuedSubmit = queuedSubmit || submit;
  window.clearTimeout(timer);
  timer = window.setTimeout(flush, delay);
}

async function flush() {
  if (saving || !queuedDraft) return;
  const draft = queuedDraft;
  const submit = queuedSubmit;
  queuedDraft = null;
  queuedSubmit = false;

  if (!String(draft.operatorName || '').trim()) return;

  saving = true;
  setSaveLabel(submit ? 'Submitting profile…' : 'Saving online…');
  try {
    const response = await fetch('/.netlify/functions/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload(draft, submit)),
    });
    const text = await response.text();
    let data: SaveResponse = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
    if (!response.ok) throw new Error(data.error || `Save failed with status ${response.status}`);

    if (data.session_id) originalSetItem('irl-onboarding-session', data.session_id);
    setSaveLabel(submit ? 'Profile submitted to IRL' : `Saved online at ${formatTime(data.saved_at)}`);
  } catch (error) {
    console.error('Operator onboarding online save failed', error);
    setSaveLabel(error instanceof Error ? `Saved locally — ${error.message}` : 'Saved locally — online save failed');
  } finally {
    saving = false;
    if (queuedDraft) window.setTimeout(flush, 0);
  }
}

function buildPayload(form: Draft, submit: boolean) {
  return {
    session_id: window.localStorage.getItem('irl-onboarding-session'),
    flow: 'operator',
    current_step: currentStep(),
    completion_percentage: completionPercentage(),
    submit,
    form,
  };
}

function currentStep() {
  const active = document.querySelector<HTMLButtonElement>('.step-list button.active');
  const label = active?.textContent?.replace(/^\s*\d+\s*/, '').trim().toLowerCase() || '';
  const map: Record<string, string> = {
    'your organisation': 'organisation',
    'your property': 'property',
    'your guests': 'guests',
    'spaces and experiences': 'spaces',
    'how it works': 'operations',
    'data and systems': 'data',
    'review and submit': 'review',
  };
  return map[label] || null;
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
