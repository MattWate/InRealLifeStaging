export function validateSubmission(body: unknown, flow: 'brand' | 'operator'): string | null {
  if (!body || typeof body !== 'object') return 'Invalid onboarding request.';
  const payload = body as Record<string, unknown>;
  const form = payload.form;
  if (payload.flow !== flow || !form || typeof form !== 'object' || Array.isArray(form)) return 'Invalid onboarding form.';
  if (payload.submit !== undefined && typeof payload.submit !== 'boolean') return 'Invalid submission status.';
  if (payload.session_id != null && (typeof payload.session_id !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(payload.session_id))) return 'Invalid saved session.';
  if (Object.keys(form).length > 200 || Object.values(form).some(value => typeof value !== 'string' && !(Array.isArray(value) && value.every(item => typeof item === 'string')))) return 'Invalid answer format.';
  if (!payload.submit) return null;
  const answers = form as Record<string, unknown>;
  const required = flow === 'brand' ? ['brandName', 'firstName', 'lastName', 'email', 'productName'] : ['operatorName', 'operatorFirstName', 'operatorLastName', 'operatorEmail', 'propertyName'];
  if (required.some(key => typeof answers[key] !== 'string' || !String(answers[key]).trim())) return 'Add the organisation, primary contact and product or property details before submitting.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(answers[flow === 'brand' ? 'email' : 'operatorEmail']))) return 'Enter a valid contact email before submitting.';
  if (flow === 'brand' && answers.profileConfirmed !== 'yes') return 'Confirm that your Brand Profile is accurate before submitting.';
  return null;
}
