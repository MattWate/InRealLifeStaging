# Operator research ingestion — V1

Jared generates hotel research externally. IRL **does not scrape hotel websites** in this workflow.

## Contract

- Upload one UTF-8 JSON object adhering to `irl-operator-research-v1`.
- See `tests/fixtures/operator-research-example.json` for a **fictional** valid example.
- The research file carries a property identity, room types, spaces, audiences, seven possible experience zones, field-level claims, and source citations.
- Every claim points to a known entity and a field in `netlify/lib/operator-research-schema.ts`.
- Research-supported claims require a cited source. Inferences have `research_assumption` provenance. Unknown information is a `data_gap` with `null` value.
- Claims are research records only. Do not insert their values into canonical property/room/space data until IRL review.

## Deployment preparation

1. Apply `database/irl_operator_research_assisted_v01.sql` to the intended Neon database before enabling the feature.
2. Deploy the feature branch to a **staging** Netlify site with the appropriate `DATABASE_URL` and `APP_ORIGIN`.
3. Log in as an IRL administrator and open `/admin/operator-research`.
4. Validate the JSON, inspect the summary, then import. Open the resulting research profile to inspect claims and linked sources.

## Status and next slice

The V1 screen supports import, validation, evidence profile, field-level admin acceptance/correction/rejection, and recent-import history. It intentionally does not send invitations or modify canonical property data. Review decisions are retained separately from original research claims.

Next: add explicit property matching (rather than speculative auto-merge), and selective operator verification/augmentation invitations. Reconcile operator-confirmed data after review.

## Data safety

- Imports are limited to 1 MB and require an active administrator session.
- Source websites are linked but never automatically fetched by the ingestion function.
- Research imports are separate from the existing brand research workflow and existing verified operator records.
- For now, no property is linked automatically; the optional `property_id` API field can explicitly link a known property after a separate review.
