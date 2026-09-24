import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInboundXml } from '../base44/shared/inboundXml.js';

const ACCESS_KEY = '35260912345678000123550010000123451000123456';

test('parses a namespaced NF-e with supplier, recipient, totals and items', () => {
  const parsed = parseInboundXml(`<?xml version="1.0"?>
    <nfe:NFe xmlns:nfe="http://www.portalfiscal.inf.br/nfe">
      <nfe:infNFe Id="NFe${ACCESS_KEY}">
        <nfe:ide><nfe:nNF>12345</nfe:nNF><nfe:serie>1</nfe:serie><nfe:dhEmi>2026-09-24T10:00:00-03:00</nfe:dhEmi></nfe:ide>
        <nfe:emit><nfe:CNPJ>12345678000123</nfe:CNPJ><nfe:xNome>Auto Peças ABC</nfe:xNome><nfe:IE>123</nfe:IE></nfe:emit>
        <nfe:dest><nfe:CNPJ>98765432000198</nfe:CNPJ></nfe:dest>
        <nfe:det nItem="1"><nfe:prod><nfe:cProd>FO-10</nfe:cProd><nfe:cEAN>7891234567890</nfe:cEAN><nfe:xProd>Filtro de óleo</nfe:xProd><nfe:NCM>84212300</nfe:NCM><nfe:qCom>2</nfe:qCom><nfe:uCom>UN</nfe:uCom><nfe:vUnCom>25.50</nfe:vUnCom><nfe:vProd>51.00</nfe:vProd></nfe:prod></nfe:det>
        <nfe:total><nfe:ICMSTot><nfe:vNF>51.00</nfe:vNF></nfe:ICMSTot></nfe:total>
      </nfe:infNFe>
    </nfe:NFe>`);
  assert.equal(parsed.document_type, 'NFE');
  assert.equal(parsed.access_key, ACCESS_KEY);
  assert.equal(parsed.number, '12345');
  assert.equal(parsed.supplier.name, 'Auto Peças ABC');
  assert.equal(parsed.recipient_document, '98765432000198');
  assert.equal(parsed.total_document, 51);
  assert.deepEqual(parsed.items[0], {
    source_item_id: '1', item_type: 'PRODUCT', supplier_product_code: 'FO-10', gtin: '7891234567890',
    description: 'Filtro de óleo', quantity: 2, unit: 'UN', unit_price: 25.5, total: 51,
    ncm: '84212300', cest: '', track_stock: true,
  });
});

test('parses a common ABRASF NFS-e service layout', () => {
  const parsed = parseInboundXml(`<CompNfse><Nfse><InfNfse>
    <Numero>77</Numero><CodigoVerificacao>ABC123</CodigoVerificacao><DataEmissao>2026-09-24</DataEmissao>
    <Servico><Valores><ValorServicos>350.00</ValorServicos></Valores><Discriminacao>Alinhamento terceirizado</Discriminacao></Servico>
    <PrestadorServico><CpfCnpj><Cnpj>12345678000123</Cnpj></CpfCnpj><RazaoSocial>Prestador Teste</RazaoSocial></PrestadorServico>
    <TomadorServico><IdentificacaoTomador><CpfCnpj><Cnpj>98765432000198</Cnpj></CpfCnpj></IdentificacaoTomador></TomadorServico>
  </InfNfse></Nfse></CompNfse>`);
  assert.equal(parsed.document_type, 'NFSE');
  assert.equal(parsed.number, '77');
  assert.equal(parsed.supplier.cpf_cnpj, '12345678000123');
  assert.equal(parsed.recipient_document, '98765432000198');
  assert.equal(parsed.items[0].description, 'Alinhamento terceirizado');
  assert.equal(parsed.items[0].track_stock, false);
});

test('rejects unsafe, unsupported and incomplete XML', () => {
  assert.throws(() => parseInboundXml('<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///x">]><NFe/>'), { code: 'UNSAFE_XML' });
  assert.throws(() => parseInboundXml('<documento />'), { code: 'UNSUPPORTED_XML' });
  assert.throws(() => parseInboundXml('<NFe><infNFe><ide><nNF>1</nNF></ide></infNFe></NFe>'), { code: 'INCOMPLETE_NFE_XML' });
});
