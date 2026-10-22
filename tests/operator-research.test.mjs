import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateOperatorResearch } from '../netlify/lib/operator-research-schema.ts';

const valid = JSON.parse(readFileSync(new URL('./fixtures/operator-research-example.json', import.meta.url), 'utf8'));

test('a versioned fictional hotel import is valid', () => {
  const result = validateOperatorResearch(valid);
  assert.equal(result.success, true, JSON.stringify(result.error?.issues));
});

test('unsupported fields cannot silently enter the property intelligence model', () => {
  const doc = structuredClone(valid);
  doc.claims[0].field_key = 'property.secret_instruction';
  assert.equal(validateOperatorResearch(doc).success, false);
});

test('verified claims require sources and source IDs must resolve', () => {
  const doc = structuredClone(valid);
  doc.claims[0].source_ids = [];
  assert.equal(validateOperatorResearch(doc).success, false);
  doc.claims[0].source_ids = ['missing_source'];
  assert.equal(validateOperatorResearch(doc).success, false);
});

test('unknown claims cannot be disguised as verified facts', () => {
  const doc = structuredClone(valid);
  doc.claims[2].value = 'Mostly international';
  assert.equal(validateOperatorResearch(doc).success, false);
});

test('entity references and value types must match', () => {
  const doc = structuredClone(valid);
  doc.claims[1].entity_key = 'nonexistent_room';
  doc.claims[1].value = 42;
  assert.equal(validateOperatorResearch(doc).success, false);
});

test('unsafe URLs are rejected', () => {
  const doc = structuredClone(valid);
  doc.sources[0].url = 'http://localhost:9999';
  assert.equal(validateOperatorResearch(doc).success, false);
});
