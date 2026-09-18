import { jsPDF } from "jspdf";
import { formatCurrency, formatDate, formatDateTime, normalizePlate } from "@/lib/format";

export const PDF_MARGIN = 14;
export const PDF_PAGE_WIDTH = 210;
const CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
const BRAND = [20, 56, 105];
const MUTED = [89, 108, 132];

async function imageData(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export function finalizeStyledDocument(doc) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(215, 223, 234); doc.line(PDF_MARGIN, 287, PDF_PAGE_WIDTH - PDF_MARGIN, 287);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text("Documento gerado pelo sistema", PDF_MARGIN, 291);
    doc.text(`Página ${page} de ${pages}`, PDF_PAGE_WIDTH - PDF_MARGIN, 291, { align: "right" });
  }
  doc.setTextColor(0, 0, 0);
}

export async function createStyledDocument(settings, title, { subtitle = "", meta = "" } = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await imageData(settings?.logo_url);
  let x = PDF_MARGIN;
  if (logo) {
    try { doc.addImage(logo, undefined, PDF_MARGIN, PDF_MARGIN - 2, 15, 15); x += 19; } catch { /* A logo é opcional. */ }
  }
  doc.setTextColor(...BRAND); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(settings?.name || "Oficina", x, PDF_MARGIN + 3);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
  const details = [settings?.razao_social, settings?.cnpj && `CNPJ: ${settings.cnpj}`, settings?.address, [settings?.phone && `Tel: ${settings.phone}`, settings?.whatsapp && `WhatsApp: ${settings.whatsapp}`, settings?.email].filter(Boolean).join(" | ")].filter(Boolean);
  details.slice(0, 4).forEach((line, index) => doc.text(line, x, PDF_MARGIN + 7 + index * 3.6));
  doc.setTextColor(...BRAND); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(title.toUpperCase(), PDF_PAGE_WIDTH - PDF_MARGIN, PDF_MARGIN + 3, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
  if (subtitle) doc.text(subtitle, PDF_PAGE_WIDTH - PDF_MARGIN, PDF_MARGIN + 7, { align: "right" });
  if (meta) doc.text(meta, PDF_PAGE_WIDTH - PDF_MARGIN, PDF_MARGIN + 10.5, { align: "right" });
  doc.setDrawColor(193, 207, 225); doc.line(PDF_MARGIN, 35, PDF_PAGE_WIDTH - PDF_MARGIN, 35);
  doc.setTextColor(0, 0, 0);
  return { doc, y: 43 };
}

export function addSectionTitle(doc, y, title) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(title.toUpperCase(), PDF_MARGIN, y);
  y += 2; doc.setDrawColor(181, 199, 220); doc.line(PDF_MARGIN, y, PDF_PAGE_WIDTH - PDF_MARGIN, y); doc.setTextColor(0, 0, 0);
  return y + 5;
}

export function addKeyValueRows(doc, y, rows) {
  rows.forEach(({ label, value, tone = "normal" }) => {
    doc.setFillColor(248, 250, 253); doc.rect(PDF_MARGIN, y - 3.7, CONTENT_WIDTH, 5.5, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(label, PDF_MARGIN + 1.5, y);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...(tone === "success" ? [0, 137, 97] : tone === "danger" ? [220, 38, 38] : BRAND));
    doc.text(String(value), PDF_PAGE_WIDTH - PDF_MARGIN - 1.5, y, { align: "right" }); doc.setTextColor(0, 0, 0); y += 6;
  });
  return y + 2;
}

export function addTable(doc, y, headers, rows, widths) {
  const right = PDF_PAGE_WIDTH - PDF_MARGIN;
  const tableHeader = () => {
    doc.setFillColor(235, 241, 248); doc.rect(PDF_MARGIN, y - 3.8, CONTENT_WIDTH, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...BRAND);
    let x = PDF_MARGIN + 1.5;
    headers.forEach((header, index) => {
      const last = index === headers.length - 1;
      doc.text(header, last ? right - 1.5 : x, y, last ? { align: "right" } : undefined); x += widths[index];
    });
    doc.setTextColor(0, 0, 0); y += 6;
  };
  tableHeader();
  rows.forEach((row) => {
    if (y > 275) { doc.addPage(); y = 20; tableHeader(); }
    doc.setFont("helvetica", row.bold ? "bold" : "normal"); doc.setFontSize(7.5);
    let x = PDF_MARGIN + 1.5;
    row.cells.forEach((cell, index) => {
      const last = index === row.cells.length - 1;
      const text = doc.splitTextToSize(String(cell ?? "—"), last ? 28 : Math.max(14, widths[index] - 2))[0] || "—";
      doc.text(text, last ? right - 1.5 : x, y, last ? { align: "right" } : undefined); x += widths[index];
    });
    doc.setDrawColor(229, 235, 242); doc.line(PDF_MARGIN, y + 2, right, y + 2); y += 5;
  });
  return y + 2;
}

function clientBlock(doc, y, data, customer) {
  y = addSectionTitle(doc, y, "Cliente e veículo");
  const address = customer ? [customer.address, customer.number, customer.neighborhood, customer.city, customer.state].filter(Boolean).join(", ") : "";
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  doc.text(`Cliente: ${data.customer_name_snapshot || customer?.name || "—"}`, PDF_MARGIN, y);
  doc.text(`CPF/CNPJ: ${customer?.cpf_cnpj || "—"}`, PDF_PAGE_WIDTH - PDF_MARGIN, y, { align: "right" }); y += 4.5;
  doc.text(`Veículo: ${data.vehicle_description_snapshot || "—"}`, PDF_MARGIN, y);
  doc.text(`Placa: ${normalizePlate(data.plate_snapshot || "") || "—"}`, PDF_PAGE_WIDTH - PDF_MARGIN, y, { align: "right" }); y += 4.5;
  if (address) { doc.setTextColor(...MUTED); doc.text(address, PDF_MARGIN, y); doc.setTextColor(0, 0, 0); y += 4.5; }
  return y + 3;
}

function noteBlock(doc, y, title, value) {
  if (!value) return y;
  y = addSectionTitle(doc, y, title);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  const lines = doc.splitTextToSize(String(value), CONTENT_WIDTH);
  lines.forEach((line) => { doc.text(line, PDF_MARGIN, y); y += 3.8; });
  return y + 3;
}

export const paymentMethodLabel = (method) => ({ dinheiro: "Dinheiro", pix: "Pix", cartao_debito: "Cartão de débito", cartao_credito: "Cartão de crédito", outro: "Outro" }[method] || method || "—");

async function buildServiceDocument({ title, data, items, settings, customer, payments = [], disclaimer = "" }) {
  const documentReference = title === "Orçamento" ? "Orçamento" : "OS";
  const { doc, y: startY } = await createStyledDocument(settings, title, { subtitle: `${documentReference} #${data.number || "—"}`, meta: `Emitido em: ${formatDateTime(new Date())}` });
  let y = clientBlock(doc, startY, data, customer);
  y = noteBlock(doc, y, "Relato do cliente", data.customer_report);
  y = noteBlock(doc, y, "Diagnóstico", data.diagnosis);
  y = addSectionTitle(doc, y, "Itens e serviços");
  y = addTable(doc, y, ["Tipo", "Descrição", "Qtd.", "Unitário", "Total"], items.map((item) => ({ cells: [item.type === "material" ? "Peça" : "Serviço", item.description, item.quantity, formatCurrency(item.unit_price), formatCurrency(item.total)] })), [21, 82, 18, 30, 20]);
  const parts = items.filter((item) => item.type === "material").reduce((sum, item) => sum + (item.total || 0), 0);
  const labor = items.filter((item) => item.type === "servico").reduce((sum, item) => sum + (item.total || 0), 0);
  const totals = [{ label: "Subtotal de peças", value: formatCurrency(parts) }, { label: "Subtotal de serviços", value: formatCurrency(labor) }];
  if (data.socorro) totals.push({ label: "Deslocamento / socorro", value: formatCurrency(data.socorro) });
  if (data.discount) totals.push({ label: "Desconto", value: `- ${formatCurrency(data.discount)}`, tone: "danger" });
  totals.push({ label: "TOTAL", value: formatCurrency(data.total ?? Math.max(0, parts + labor + (data.socorro || 0) - (data.discount || 0))), tone: "success" });
  y = addSectionTitle(doc, y, "Valores"); y = addKeyValueRows(doc, y, totals);
  const activePayments = payments.filter((payment) => payment.status === "ativo");
  if (activePayments.length) {
    y = addSectionTitle(doc, y, "Pagamentos recebidos");
    y = addTable(doc, y, ["Data", "Forma", "Valor"], activePayments.map((payment) => ({ cells: [formatDate(payment.date), paymentMethodLabel(payment.method), formatCurrency(payment.amount)] })), [45, 90, 35]);
  }
  if (disclaimer) {
    y = addSectionTitle(doc, y, "Informação importante"); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(173, 95, 0);
    doc.text(disclaimer, PDF_MARGIN, y, { maxWidth: CONTENT_WIDTH }); doc.setTextColor(0, 0, 0);
  }
  y = noteBlock(doc, y, "Observações", data.internal_notes || data.customer_notes);
  finalizeStyledDocument(doc); return doc;
}

export async function generateQuotePDF(quote, items, settings, customer) {
  const doc = await buildServiceDocument({ title: "Orçamento", data: quote, items, settings, customer }); doc.save(`orcamento-${quote.number}.pdf`);
}

export async function generateQuotePDFBlob(quote, items, settings, customer) {
  const doc = await buildServiceDocument({ title: "Orçamento", data: quote, items, settings, customer }); return doc.output("blob");
}

export async function generateWorkOrderPDF(wo, items, settings, customer) {
  const doc = await buildServiceDocument({ title: "Ordem de serviço", data: wo, items, settings, customer }); doc.save(`os-${wo.number}.pdf`);
}

export async function generateWorkOrderPDFBlob(wo, items, settings, customer) {
  const doc = await buildServiceDocument({ title: "Ordem de serviço", data: wo, items, settings, customer }); return doc.output("blob");
}

export async function generatePurchaseRequestPDFBlob(request, items, settings) {
  const { doc, y: startY } = await createStyledDocument(settings, "Solicitação de cotação", {
    subtitle: `Cotação #${request.number || "—"}`,
    meta: `Emitido em: ${formatDateTime(new Date())}`,
  });
  let y = addSectionTitle(doc, startY, "Itens solicitados");
  y = addTable(doc, y, ["Item", "Quantidade", "Unidade"], items.map((item) => ({
    cells: [item.description, item.quantity || 0, item.unit || "un"],
  })), [120, 30, 30]);
  noteBlock(doc, y, "Observações", request.notes);
  finalizeStyledDocument(doc);
  return doc.output("blob");
}

export async function generateNonFiscalReceiptPDF(wo, items, settings, customer, payments) {
  const doc = await buildServiceDocument({ title: "Recibo de prestação de serviço", data: wo, items, settings, customer, payments });
  doc.save(`recibo-nao-fiscal-os-${wo.number}.pdf`);
}
