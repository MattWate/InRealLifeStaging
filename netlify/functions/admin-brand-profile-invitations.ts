import type { Handler } from '@netlify/functions';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { adminOnlyWithUser, database, digest, origin, reply } from '../lib/admin-auth';
import type { BrandResearchDocument } from '../lib/brand-research-schema';

const createSchema = z.object({
  import_id: z.string().uuid(),
  recipient_name: z.string().trim().max(200).optional().default(''),
  recipient_email: z.string().trim().email().max(254),
  expiry_days: z.number().int().min(1).max(90).optional().default(14),
  notes: z.string().trim().max(2000).optional().default(''),
}).strict();

const revokeSchema = z.object({ invitation_id: z.string().uuid(), action: z.literal('revoke') }).strict();

type Claim = {
  id: string;
  entity_type: 'brand' | 'product';
  entity_key: string;
  field_key: string;
  reviewed_value: unknown;
  admin_decision: 'accepted' | 'edited' | 'rejected' | 'pending';
  presentation_action: string;
};

export const handler: Handler = adminOnlyWithUser(async (event, _context, admin) => {
  const sql = database();
  if (event.httpMethod === 'GET') {
    const importId = event.queryStringParameters?.import_id || '';
    if (!z.string().uuid().safeParse(importId).success) return reply(400, { error: 'Select a valid research import.' });
    const invitations = await sql`
      select id, recipient_name, recipient_email, status, expires_at, opened_at,
        submitted_at, revoked_at, created_at
      from public.brand_profile_invitations
      where research_import_id = ${importId}::uuid
      order by created_at desc
    `;
    return reply(200, { invitations });
  }
  if (!['POST', 'PATCH'].includes(event.httpMethod)) return reply(405, { error: 'Method not allowed.' }, { Allow: 'GET, POST, PATCH' });
  if (Buffer.byteLength(event.body || '', 'utf8') > 16 * 1024) return reply(413, { error: 'The invitation request is too large.' });
  let raw: unknown;
  try { raw = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'The invitation request is not valid JSON.' }); }

  if (event.httpMethod === 'PATCH') {
    const parsed = revokeSchema.safeParse(raw);
    if (!parsed.success) return reply(400, { error: 'Select a valid invitation to revoke.' });
    const rows = await sql`
      update public.brand_profile_invitations set status = 'revoked', revoked_at = now(), updated_at = now()
      where id = ${parsed.data.invitation_id}::uuid and status in ('draft','active','opened')
      returning id
    `;
    if (!rows.length) return reply(409, { error: 'This invitation is no longer active.' });
    return reply(200, { ok: true, invitation_id: rows[0].id });
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return reply(400, { error: 'Check the recipient details and try again.', details: parsed.error.issues });
  try {
    const result = await createInvitation(sql, admin.id, parsed.data);
    return reply(201, result);
  } catch (error) {
    if (error instanceof InvitationError) return reply(409, { error: error.message });
    throw error;
  }
});

async function createInvitation(sql: any, adminId: string, input: z.infer<typeof createSchema>) {
  const imports = await sql`
    select i.id, i.organisation_id, i.status, i.raw_payload, i.validation_report, o.name as organisation_name
    from public.brand_research_imports i
    join public.organisations o on o.id = i.organisation_id
    where i.id = ${input.import_id}::uuid and i.status = 'reviewed' and o.organisation_type = 'brand'
    limit 1
  `;
  if (!imports.length) throw new InvitationError('Complete the research review before creating a customer link.');
  const item = imports[0];
  const payload = item.raw_payload as BrandResearchDocument;
  const selectedKeys: string[] = item.validation_report?.admin_review?.selected_product_keys || [];
  if (payload.products.length && !selectedKeys.length) throw new InvitationError('Select at least one product before creating the invitation.');

  const claims = await sql`
    select id, entity_type, entity_key, field_key, reviewed_value, admin_decision, presentation_action
    from public.brand_research_claims
    where import_id = ${input.import_id}::uuid
    order by entity_type, entity_key, field_key
  ` as Claim[];
  const accepted = claims.filter(claim => ['accepted', 'edited'].includes(claim.admin_decision));
  const existingProducts = await sql`
    select id, name from public.brand_onboarding_products where organisation_id = ${item.organisation_id}::uuid
  `;
  const normal = (value: unknown) => String(value || '').trim().toLocaleLowerCase();
  const productIds = new Map<string, { id: string; insert: boolean; name: string }>();
  for (const key of selectedKeys) {
    const product = payload.products.find(value => value.external_key === key);
    if (!product) throw new InvitationError(`The selected product ${key} no longer exists in this import.`);
    const nameClaim = accepted.find(claim => claim.entity_key === key && claim.field_key === 'product.name');
    const proposedName = typeof nameClaim?.reviewed_value === 'string' ? nameClaim.reviewed_value : product.reference_name;
    const existing = existingProducts.find((value: any) => normal(value.name) === normal(proposedName));
    productIds.set(key, { id: existing?.id || randomUUID(), insert: !existing, name: proposedName });
  }

  const invitationId = randomUUID();
  const sessionId = randomUUID();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + input.expiry_days * 86400000).toISOString();
  const responseClaims = accepted.filter(claim => claim.presentation_action === 'show_confirm'
    && (claim.entity_type === 'brand' || selectedKeys.includes(claim.entity_key)));
  const tasks = [
    sql`update public.brand_profile_invitations set status='revoked', revoked_at=now(), updated_at=now()
      where research_import_id=${input.import_id}::uuid and status in ('draft','active','opened')`,
    sql`insert into public.onboarding_sessions
      (id, organisation_id, onboarding_type, current_step, status, completion_percentage, schema_version)
      values (${sessionId}::uuid, ${item.organisation_id}::uuid, 'brand', 'starting-profile', 'in_progress', 0, 'brand-profile-confirmation-v1')`,
    sql`insert into public.brand_profile_invitations
      (id, organisation_id, research_import_id, onboarding_session_id, recipient_name, recipient_email,
       token_hash, status, opportunity_context, expires_at, created_by_admin_user_id)
      values (${invitationId}::uuid, ${item.organisation_id}::uuid, ${input.import_id}::uuid, ${sessionId}::uuid,
       ${input.recipient_name || null}, ${input.recipient_email.toLowerCase()}, ${digest(token)}, 'active',
       ${JSON.stringify({ notes: input.notes || undefined, selected_product_keys: selectedKeys })}::jsonb,
       ${expiresAt}::timestamptz, ${adminId}::uuid)`,
    ...[...productIds.entries()].filter(([, value]) => value.insert).map(([, value]) => sql`
      insert into public.brand_onboarding_products
        (id, organisation_id, onboarding_session_id, is_primary, scope_code)
      values (${value.id}::uuid, ${item.organisation_id}::uuid, ${sessionId}::uuid, false, 'research_assisted')
    `),
    ...[...productIds.entries()].map(([, value], index) => sql`
      insert into public.brand_profile_invitation_products (invitation_id, organisation_id, product_id, product_order)
      values (${invitationId}::uuid, ${item.organisation_id}::uuid, ${value.id}::uuid, ${index})
    `),
    ...responseClaims.map(claim => {
      const productId = claim.entity_type === 'product' ? productIds.get(claim.entity_key)?.id : null;
      return sql`insert into public.brand_profile_field_responses
        (id, invitation_id, organisation_id, research_claim_id, entity_type, product_id, field_key, original_value)
        values (${randomUUID()}::uuid, ${invitationId}::uuid, ${item.organisation_id}::uuid, ${claim.id}::uuid,
          ${claim.entity_type}, ${productId}::uuid, ${claim.field_key}, ${JSON.stringify(claim.reviewed_value)}::jsonb)`;
    }),
    ...selectedKeys.flatMap(key => {
      const productId = productIds.get(key)!.id;
      return accepted.filter(claim => claim.entity_key === key).map(claim => sql`
        update public.brand_research_claims set product_id=${productId}::uuid where id=${claim.id}::uuid
      `);
    }),
    sql`insert into public.brand_onboarding_profiles (organisation_id, readiness_status, status)
      values (${item.organisation_id}::uuid, 'confirmation_requested', 'draft')
      on conflict (organisation_id) do update set readiness_status='confirmation_requested', updated_at=now()`,
    sql`insert into public.onboarding_audit_log
      (onboarding_session_id, organisation_id, event_type, schema_version, details)
      values (${sessionId}::uuid, ${item.organisation_id}::uuid, 'profile_invitation_created',
        'brand-profile-confirmation-v1', ${JSON.stringify({ invitation_id: invitationId, research_import_id: input.import_id })}::jsonb)`,
  ];
  await sql.transaction(tasks);
  return {
    ok: true,
    invitation: { id: invitationId, recipient_name: input.recipient_name, recipient_email: input.recipient_email.toLowerCase(), status: 'active', expires_at: expiresAt },
    customer_url: `${origin().origin}/confirm-brand/${token}`,
    message: 'Copy this customer link now. For security, it will not be shown again.',
  };
}

class InvitationError extends Error {}
