import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { buildAccountingData, buildCsvFiles, cleanText, dateOnly, zipFiles } from "../../shared/accountingExport.js";

const fail = (message: string, status = 400, code = "ACCOUNTING_EXPORT_ERROR") => Object.assign(new Error(message), { status, code });
const fileSafe = (value: unknown) => cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
const base64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
};

async function getXml(base44: any, document: any) {
  let url = cleanText(document.xml_url);
  if (document.xml_file_uri) {
    const signed = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: document.xml_file_uri, expires_in: 300 });
    url = signed.signed_url;
  }
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function reportHtml(workshop: any, start: string, end: string, data: any, missing: any[]) {
  const total = (rows: any[], field: string) => rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);
  const escape = (value: unknown) => cleanText(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const row = (label: string, count: number, amount: number) => `<tr><td>${escape(label)}</td><td>${count}</td><td>R$ ${amount.toFixed(2).replace(".", ",")}</td></tr>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Conferência contábil</title><style>body{font:14px Arial;margin:32px;color:#172033}h1{margin-bottom:4px}table{border-collapse:collapse;width:100%;margin-top:24px}th,td{border:1px solid #ccd3dc;padding:8px;text-align:left}th{background:#eef2f6}.alert{background:#fff4d6;padding:12px;margin-top:20px}</style></head><body><h1>Relatório de conferência contábil</h1><p>${escape(workshop.razao_social || workshop.name)} · ${escape(workshop.cnpj)}</p><p>Período: ${start} a ${end}</p><table><thead><tr><th>Grupo</th><th>Registros</th><th>Total</th></tr></thead><tbody>${row("NF-e de entrada", data.inbound.length, total(data.inbound, "total_document"))}${row("NF-e de saída", data.outbound.length, total(data.outbound, "total_document"))}${row("NFS-e de saída", data.service.length, total(data.service, "total_document"))}${row("Contas a pagar", data.expenses.length, total(data.expenses, "amount"))}${row("Contas a receber", data.receivables.length, total(data.receivables, "total"))}${row("Saldo a receber", data.receivables.filter((item: any) => item.balance > 0).length, total(data.receivables, "balance"))}</tbody></table>${missing.length ? `<div class="alert"><strong>Atenção:</strong> ${missing.length} documento(s) sem XML incluído.<ul>${missing.map((item) => `<li>${escape(item.type)} ${escape(item.number || "sem número")}: ${escape(item.reason)}</li>`).join("")}</ul></div>` : "<p>Nenhuma pendência de XML encontrada.</p>"}<p>Gerado pelo Revisô em ${new Date().toLocaleString("pt-BR")}.</p></body></html>`;
}

export default async function (req: Request) {
  try {
    const base44Client = createClientFromRequest(req);
    const user = await base44Client.auth.me();
    if (!user || user.role !== "admin" || !user.workshop_id) throw fail("Operação não autorizada.", 403, "ACCOUNTING_EXPORT_FORBIDDEN");
    const body = await req.json().catch(() => ({}));
    const start = dateOnly(body.start);
    const end = dateOnly(body.end);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) throw fail("Informe um período válido.");
    const db = base44Client.asServiceRole.entities;
    const workshop = await db.WorkshopSetting.get(user.workshop_id);
    if (!workshop?.id || workshop.id !== user.workshop_id) throw fail("Oficina não encontrada.", 404);
    const [documents, expenses, workOrders, payments] = await Promise.all([
      db.FiscalDocument.filter({ workshop_id: workshop.id }, "-created_date", 5000),
      db.Expense.filter({ workshop_id: workshop.id }, "-date", 5000),
      db.WorkOrder.filter({ workshop_id: workshop.id }, "-completion_date", 5000),
      db.Payment.filter({ workshop_id: workshop.id }, "-date", 10000),
    ]);
    const data = buildAccountingData({ documents, expenses, workOrders, payments }, start, end);
    const summary = {
      inbound: data.inbound.length, outbound: data.outbound.length, service: data.service.length,
      payables: data.expenses.length, receivables: data.receivables.length,
      xmlAvailable: data.documents.filter((item: any) => item.xml_file_uri || item.xml_url).length,
    };
    if (body.action === "summary") return Response.json({ summary });
    if (body.action !== "export") throw fail("Ação contábil inválida.");

    const files: Record<string, string | Uint8Array> = buildCsvFiles(data);
    const missing: any[] = [];
    for (const document of data.documents) {
      const folder = document.direction === "INBOUND" ? "xml/entradas" : document.document_type === "NFSE" ? "xml/nfse-saidas" : "xml/nfe-saidas";
      try {
        const xml = await getXml(base44Client, document);
        if (!xml) missing.push({ type: document.document_type, number: document.number, reason: "XML não armazenado" });
        else files[`${folder}/${fileSafe(document.access_key || `${document.document_type}-${document.number || document.id}`)}.xml`] = xml;
      } catch (cause) {
        missing.push({ type: document.document_type, number: document.number, reason: `falha ao baixar o XML (${cause instanceof Error ? cause.message : "erro"})` });
      }
    }
    files["relatorio-conferencia.html"] = reportHtml(workshop, start, end, data, missing);
    files["LEIA-ME.txt"] = `Pacote contábil Revisô\nOficina: ${cleanText(workshop.razao_social || workshop.name)}\nCNPJ: ${cleanText(workshop.cnpj)}\nPeríodo: ${start} a ${end}\n\nConteúdo:\n- XMLs de entrada, NF-e de saída e NFS-e de saída disponíveis\n- CSV de contas a pagar\n- CSV de contas a receber por ordem de serviço\n- Relatório de conferência em HTML\n\nXMLs ausentes: ${missing.length}\n`;
    const bytes = zipFiles(files);
    return Response.json({ filename: `reviso-contabil-${start}-a-${end}.zip`, mime_type: "application/zip", base64: base64(bytes), summary, warnings: missing });
  } catch (cause) {
    const error = cause as { message?: string; status?: number; code?: string };
    console.error("Accounting export failed", error.code || "ACCOUNTING_EXPORT_ERROR");
    return Response.json({ error: error.message || "Não foi possível gerar o pacote contábil.", code: error.code || "ACCOUNTING_EXPORT_ERROR" }, { status: error.status || 500 });
  }
}

