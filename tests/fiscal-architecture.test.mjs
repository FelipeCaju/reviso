import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entity = (name) => JSON.parse(readFileSync(new URL(`../base44/entities/${name}.jsonc`, import.meta.url), 'utf8'));

test('fiscal entities are tenant-scoped and direct writes are server-only', () => {
  for (const name of ['FiscalSetting', 'ServiceFiscalProfile', 'MaterialFiscalProfile', 'FiscalCredential', 'FiscalDocument', 'FiscalDocumentItem', 'FiscalDocumentEvent']) {
    const schema = entity(name);
    assert.ok(schema.required.includes('workshop_id'), name);
    for (const op of ['create', 'update', 'delete']) {
      assert.ok(schema.rls[op].$and.some((rule) => rule['data.workshop_id'] === '{{user.data.workshop_id}}'), `${name}.${op}.tenant`);
      assert.ok(schema.rls[op].$and.some((rule) => rule.user_condition?.email === '__server_only__'), `${name}.${op}.server`);
    }
  }
});

test('legacy fields remain while structured registration fields are available', () => {
  const workshop = entity('WorkshopSetting').properties;
  assert.ok(workshop.address);
  for (const field of ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'codigo_ibge', 'pais', 'codigo_pais']) assert.ok(workshop[field], field);
  const customer = entity('Customer').properties;
  for (const field of ['person_type', 'name', 'cpf_cnpj', 'city_ibge_code', 'country', 'country_code']) assert.ok(customer[field], field);
});

test('fiscal backend enforces role, tenant, feature, validation and duplicate protection', () => {
  const source = readFileSync(new URL('../base44/functions/manageFiscal/entry.ts', import.meta.url), 'utf8');
  assert.match(source, /user\.role !== "admin"/);
  assert.match(source, /workshop\.id !== user\.workshop_id/);
  assert.match(source, /FISCAL_MODULE_DISABLED/);
  assert.match(source, /Documento fiscal inválido/);
  assert.match(source, /já possui documento fiscal ativo/);
  assert.match(source, /FISCAL_CREDENTIAL_NOT_READY/);
});

test('provider contract exposes the complete lifecycle', () => {
  const source = readFileSync(new URL('../base44/shared/fiscalProvider.ts', import.meta.url), 'utf8');
  for (const method of ['validate', 'issue', 'query', 'cancel', 'replace', 'downloadXml', 'downloadPdf']) assert.match(source, new RegExp(`${method}\\(`));
});

test('platform owner can choose fiscal mode when creating, provisioning and editing workshops', () => {
  const backend = readFileSync(new URL('../base44/functions/manageWorkshops/entry.ts', import.meta.url), 'utf8');
  const screen = readFileSync(new URL('../src/pages/AdminOnboarding.jsx', import.meta.url), 'utf8');

  assert.match(backend, /fiscal_module_enabled: !!body\.fiscal_module_enabled/);
  assert.match(backend, /fiscal_module_enabled: !!fiscal_module_enabled/);
  assert.match(backend, /updateData\.fiscal_module_enabled = !!fiscal_module_enabled/);
  assert.match(backend, /body\.fiscal_module_enabled !== undefined/);
  assert.match(screen, /id="new-workshop-fiscal"/);
  assert.match(screen, /id="edit-workshop-fiscal"/);
  assert.match(screen, /fiscal_module_enabled: editFiscalEnabled/);
});

