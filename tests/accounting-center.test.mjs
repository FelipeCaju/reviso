import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAccountingData, buildCsvFiles, zipFiles } from "../base44/shared/accountingExport.js";

test("accounting period separates fiscal documents and calculates receivable balances", () => {
  const data = buildAccountingData({
    documents: [
      { id: "in", direction: "INBOUND", document_type: "NFE", entry_date: "2026-09-05", total_document: 100 },
      { id: "out", direction: "OUTBOUND", document_type: "NFE", issue_date: "2026-09-06", total_document: 200 },
      { id: "service", direction: "OUTBOUND", document_type: "NFSE", issue_date: "2026-09-07", total_document: 300 },
      { id: "old", direction: "INBOUND", document_type: "NFE", entry_date: "2026-08-31" },
    ],
    expenses: [{ id: "expense", date: "2026-09-08", amount: 80 }],
    workOrders: [{ id: "wo", number: "10", status: "finalizada", completion_date: "2026-09-09", total: 500 }],
    payments: [{ work_order_id: "wo", status: "ativo", amount: 350 }, { work_order_id: "wo", status: "cancelado", amount: 50 }],
  }, "2026-09-01", "2026-09-30");
  assert.deepEqual(data.inbound.map((item) => item.id), ["in"]);
  assert.deepEqual(data.outbound.map((item) => item.id), ["out"]);
  assert.deepEqual(data.service.map((item) => item.id), ["service"]);
  assert.equal(data.receivables[0].received, 350);
  assert.equal(data.receivables[0].balance, 150);
  assert.match(buildCsvFiles(data)["financeiro/contas-a-receber.csv"], /150,00/);
});

test("zip generator creates a valid PK archive without external dependencies", () => {
  const zip = zipFiles({ "teste.txt": "conteúdo", "pasta/dados.csv": "a;b\r\n1;2" });
  assert.equal(new DataView(zip.buffer).getUint32(0, true), 0x04034b50);
  assert.equal(new DataView(zip.buffer).getUint32(zip.length - 22, true), 0x06054b50);
});

test("accounting backend is tenant-scoped and fetches private XML through signed URLs", () => {
  const source = readFileSync(new URL("../base44/functions/manageAccountingCenter/entry.ts", import.meta.url), "utf8");
  assert.match(source, /user\.role !== "admin"/);
  assert.match(source, /workshop\.id !== user\.workshop_id/);
  assert.match(source, /CreateFileSignedUrl/);
  for (const entity of ["FiscalDocument", "Expense", "WorkOrder", "Payment"]) assert.match(source, new RegExp(`db\\.${entity}\\.filter\\(\\{ workshop_id: workshop\\.id \\}`));
});

