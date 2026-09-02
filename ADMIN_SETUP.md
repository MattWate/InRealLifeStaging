# IRL administrator access

## Deploy and enable

1. Apply `database/irl_brand_onboarding_v01.sql` if it has not already been applied.
2. Apply `database/irl_admin_v01.sql` to the same Neon database used by the Netlify site's `DATABASE_URL`. Apply this **before deploying the code**: both final-submission endpoints now need the snapshot table.
3. Set **server-side** Netlify variable `APP_ORIGIN` to the site's exact HTTPS origin, for example `https://your-site.netlify.app`, with no trailing slash. Keep `DATABASE_URL` server-side. Do not prefix either with `VITE_`. Deploy previews need their own matching origin and should use a separate test database.
4. In **Neon SQL Editor**, open `database/irl_create_admin.sql`, replace `REPLACE_EMAIL`, `REPLACE_NAME` and `REPLACE_PASSWORD`, and run it. Repeat for each administrator. Use at least 12 characters and at most 72 UTF-8 bytes for each password. The script hashes passwords with pgcrypto bcrypt before storing them in `public.irl_admin_users`. If the email already exists, it resets the password, restores admin access and revokes existing sessions. Escape any single quote inside an SQL string by doubling it. Treat the edited SQL as a credential: do not commit it or share the saved query.

   The optional terminal-based setup also remains available with `DATABASE_URL` supplied securely in the environment:

   ```sh
   npm run admin:user -- admin@example.com "Administrator name"
   ```

   The script prompts twice for a hidden password of at least 12 characters. It creates the individual administrator or resets an existing account, and revokes their existing sessions. Passwords never appear in command arguments, logs or the browser bundle.
5. Deploy `main` and visit `/login`. Sign in using the email and password you entered in Neon. `/admin` is the completed-submissions dashboard. No public registration is provided. An entry in an unrelated `users` table will not grant access: this login uses `public.irl_admin_users` with `role = 'admin'` and `active = true`.

For local development run Netlify Dev with `APP_ORIGIN=http://localhost:8888`, using a **test database**. Vite alone does not serve Netlify functions. `npm run build` uses the existing Netlify build path; `npm test` requires Node 24 (the deployed functions still target Node 20).

## Behaviour

- Public landing and onboarding remain available without accounts. The home navigation shows Dashboard when an administrator is signed in.
- Protected routes: `/admin`, `/admin/submissions/:id`, `/screening/*`, `/rate-engine/*`, `/profiles/curiocity-green-point`. `/app` redirects administrators to `/admin`.
- The property-intelligence view is now private because its existing endpoint includes raw onboarding answers and operational contacts. A separate curated public property page can be added later.
- Every data endpoint for these routes verifies the database session, expiry, active account and admin role. Frontend routing alone does not grant access.
- Accounts created in Neon SQL Editor use salted bcrypt with cost 12; accounts created with the terminal script use salted scrypt. Both sign in through the same flow. The server verifies bcrypt through a parameterised pgcrypto query; it never accepts plaintext stored in `password_hash`. Random session tokens are stored only as SHA-256 hashes in Neon and in Secure/HttpOnly/SameSite=Strict cookies in the browser. Sessions expire after eight hours. Logout deletes the session. Origin checks protect state-changing admin requests.
- Login attempts have shared database-backed limits per email (8 per 15 minutes) and Netlify client IP (30 per 15 minutes). This works across function instances; it is not an in-memory limiter.
- Brand/operator drafts have separate browser keys. Existing legacy drafts are imported only for their matching flow. Autosaves and submission requests are serialised.
- Final submission checks basic identity/contact details and brand accuracy confirmation. The server records an immutable final-answer snapshot and marks the session submitted in one transaction. New sessions start in progress, so a failed first save does not appear as a completed form. Subsequent saves of submitted sessions are ignored.
- The dashboard lists submitted sessions only, newest first, with name/email/property search, type filters, paging, counts, and all recorded answers grouped into questionnaire sections. Existing submissions without a snapshot use the legacy answers table. Historical answers that were never persisted cannot be recovered by this change.

## Account maintenance

Run `database/irl_create_admin.sql` again with the same email and a new password to reset an account, or use the optional provisioning command. Both revoke existing sessions. To revoke access immediately, execute in the Neon console:

```sql
update public.irl_admin_users set active = false where email = 'admin@example.com';
delete from public.irl_admin_sessions where user_id = (
  select id from public.irl_admin_users where email = 'admin@example.com'
);
```

The role/active check is repeated on every protected request. Disabling an account takes effect even before its cookie expires. There is no self-service password reset/email delivery in this first admin release.

## Verification

`npm test` tests password handling, server session checks, origin rejection, rate limiting, logout, submitted-only queries, snapshot reads, legacy fallback, submission finalisation and autosave behaviour using an isolated query adapter. It does **not** validate the live Neon schema or Netlify configuration. CI also runs the production TypeScript/Vite build.

After configuring a staging deployment:

1. Complete and submit one brand and one operator form. Check failed submissions show an error, not a success screen.
2. Sign in as the provisioned administrator; both submissions should appear with all answers. Test search, type filters and a detail reload.
3. Refresh a submitted onboarding session; it should remain submitted without changing its timestamp or answers.
4. Sign out; direct requests to the dashboard, screening, rate-engine and property-intelligence APIs should return 401. Direct protected page visits should go to sign-in.
5. Check logout/session expiry removes access, and a disabled account cannot sign in or reuse an existing session.

The wider member account/onboarding ownership model remains future work. Anonymous draft sessions still use the existing unguessable session IDs. This change does not introduce brand/operator member logins or file-upload storage.
