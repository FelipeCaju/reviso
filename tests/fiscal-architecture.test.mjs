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

test('provider contract exposes connection testing and the complete lifecycle', () => {
  const source = readFileSync(new URL('../base44/shared/fiscalProvider.ts', import.meta.url), 'utf8');
  for (const method of ['validate', 'testConnection', 'issue', 'query', 'cancel', 'replace', 'downloadXml', 'downloadPdf']) assert.match(source, new RegExp(`${method}\\(`));
});

test('fiscal onboarding blocks production until homologation is approved', () => {
  const setting = entity('FiscalSetting').properties;
  for (const field of ['nfse_serie', 'nfse_proximo_rps', 'connection_status', 'connection_tested_at', 'homologation_status', 'homologation_approved_at']) assert.ok(setting[field], field);
  const backend = readFileSync(new URL('../base44/functions/manageFiscal/entry.ts', import.meta.url), 'utf8');
  const screen = readFileSync(new URL('../src/pages/FiscalSettings.jsx', import.meta.url), 'utf8');
  assert.match(backend, /FISCAL_HOMOLOGATION_REQUIRED/);
  assert.match(backend, /action === "testConnection"/);
  assert.match(backend, /homologationStatus === "APPROVED"/);
  assert.match(backend, /data\.connection_status = "NOT_TESTED"/);
  assert.match(screen, /disabled={!context\.onboarding\?\.homologationApproved}/);
  assert.match(screen, /Preparação para emissão/);
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

test('inbound fiscal documents reuse the fiscal core and keep stock auditable', () => {
  const document = entity('FiscalDocument');
  const item = entity('FiscalDocumentItem');
  const movement = entity('StockMovement');
  assert.deepEqual(document.properties.direction.enum, ['INBOUND', 'OUTBOUND']);
  assert.ok(document.properties.document_type.enum.includes('NFE'));
  assert.ok(document.properties.source_type.enum.includes('XML'));
  assert.ok(document.properties.xml_file_uri);
  assert.ok(item.properties.material_id);
  assert.ok(item.properties.track_stock);
  assert.ok(movement.required.includes('source_item_id'));
  for (const op of ['create', 'update', 'delete']) {
    assert.ok(movement.rls[op].$and.some((rule) => rule.user_condition?.email === '__server_only__'));
  }
});

test('inbound backend validates recipient, duplicates and idempotent side effects', () => {
  const source = readFileSync(new URL('../base44/functions/manageInboundFiscal/entry.ts', import.meta.url), 'utf8');
  assert.match(source, /RECIPIENT_MISMATCH/);
  assert.match(source, /DUPLICATE_DOCUMENT/);
  assert.match(source, /source_item_id: item\.id/);
  assert.match(source, /stock_processed_at/);
  assert.match(source, /fiscal_document_id: document\.id/);
  assert.match(source, /UploadPrivateFile/);
  assert.match(source, /CreateFileSignedUrl/);
  assert.match(source, /stock_processing_token/);
  assert.match(source, /financial_processing_token/);
  assert.match(source, /receipt_processing_token/);
  assert.match(source, /db\.WorkshopSetting\.get\(user\.workshop_id\)/);
  assert.doesNotMatch(source, /ensureWorkshopRecord\(db\.WorkshopSetting/);
  assert.doesNotMatch(source, /Nenhum item foi marcado para controle de estoque/);
});

test('purchase creation no longer changes stock before receipt', () => {
  const source = readFileSync(new URL('../src/pages/PurchaseRequestEditor.jsx', import.meta.url), 'utf8');
  const receipt = readFileSync(new URL('../src/pages/PurchaseOrders.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /stock:\s*currentStock\s*\+/);
  assert.match(receipt, /receivePurchaseOrder\(order\.id\)/);
});

