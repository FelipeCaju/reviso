import { jsPDF } from "jspdf";
import { formatCurrency, formatDate, normalizePlate } from "@/lib/format";

const margin = 14;
const pageW = 210; // A4 mm

function header(doc, settings, title, number, dateStr) {
  let y = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(settings?.name || "Oficina", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (settings?.phone) doc.text(`Tel: ${settings.phone}`, margin, y);
  if (settings?.cnpj) doc.text(`CNPJ: ${settings.cnpj}`, margin, y + 4);
  if (settings?.address) doc.text(settings.address, margin, y + 8);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`${title} #${number}`, pageW - margin, margin, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Data: ${formatDate(dateStr)}`, pageW - margin, margin + 5, { align: "right" });
  y += 18;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  return y + 6;
}

function clientBlock(doc, y, data) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Cliente / Veículo", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 5;
  doc.text(`Cliente: ${data.customer_name_snapshot || "—"}`, margin, y);
  y += 4.5;
  doc.text(`Veículo: ${data.vehicle_description_snapshot || "—"}`, margin, y);
  doc.text(`Placa: ${normalizePlate(data.plate_snapshot || "")}`, pageW - margin, y, { align: "right" });
  y += 4.5;
  if (data.mileage != null) {
    doc.text(`Km: ${Number(data.mileage || 0).toLocaleString("pt-BR")}`, margin, y);
  }
  return y + 6;
}

function itemsTable(doc, y, items) {
  const colX = { desc: margin, qty: 130, unit: 150, total: pageW - margin };
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, pageW - margin * 2, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Descrição", colX.desc, y + 4);
  doc.text("Qtd", colX.qty, y + 4, { align: "right" });
  doc.text("Unit.", colX.unit, y + 4, { align: "right" });
  doc.text("Total", colX.total, y + 4, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal");
  items.forEach((it) => {
    if (y > 270) { doc.addPage(); y = margin; }
    doc.text(String(it.description).slice(0, 60), colX.desc, y + 4);
    doc.text(String(it.quantity), colX.qty, y + 4, { align: "right" });
    doc.text(formatCurrency(it.unit_price), colX.unit, y + 4, { align: "right" });
    doc.text(formatCurrency(it.total), colX.total, y + 4, { align: "right" });
    y += 5;
    doc.setDrawColor(235);
    doc.line(margin, y, pageW - margin, y);
    y += 1;
  });
  return y + 2;
}

function totals(doc, y, data, partsSub, laborSub) {
  const total = Math.max(0, partsSub + laborSub + (data.socorro || 0) - (data.discount || 0));
  doc.setFontSize(9);
  doc.text("Subtotal Peças:", pageW - margin - 40, y, { align: "right" });
  doc.text(formatCurrency(partsSub), pageW - margin, y, { align: "right" });
  y += 5;
  doc.text("Subtotal Mão de Obra:", pageW - margin - 40, y, { align: "right" });
  doc.text(formatCurrency(laborSub), pageW - margin, y, { align: "right" });
  y += 5;
  if (data.socorro) {
    doc.text("Socorro:", pageW - margin - 40, y, { align: "right" });
    doc.text(formatCurrency(data.socorro), pageW - margin, y, { align: "right" });
    y += 5;
  }
  if (data.discount) {
    doc.text("Desconto:", pageW - margin - 40, y, { align: "right" });
    doc.text(formatCurrency(data.discount), pageW - margin, y, { align: "right" });
    y += 5;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL:", pageW - margin - 40, y, { align: "right" });
  doc.text(formatCurrency(total), pageW - margin, y, { align: "right" });
  return y + 8;
}

async function fetchImageAsDataURL(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function buildQuoteDoc(quote, items, settings) {
  const doc = new jsPDF();
  let y = header(doc, settings, "Orçamento", quote.number, quote.date);
  y = clientBlock(doc, y, quote);
  if (quote.customer_report) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Relato do Cliente:", margin, y); y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.splitTextToSize(quote.customer_report, pageW - margin * 2).forEach((l) => { doc.text(l, margin, y); y += 4; });
    y += 2;
  }
  if (quote.diagnosis) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Diagnóstico:", margin, y); y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.splitTextToSize(quote.diagnosis, pageW - margin * 2).forEach((l) => { doc.text(l, margin, y); y += 4; });
    y += 2;
  }
  y = itemsTable(doc, y, items);
  const partsSub = items.filter((i) => i.type === "material").reduce((s, i) => s + (i.total || 0), 0);
  const laborSub = items.filter((i) => i.type === "servico").reduce((s, i) => s + (i.total || 0), 0);
  y = totals(doc, y, quote, partsSub, laborSub);
  if (quote.valid_until) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`Validade: ${formatDate(quote.valid_until)}`, margin, y);
    y += 5;
  }
  if (settings?.default_quote_text) {
    doc.setFontSize(8);
    doc.splitTextToSize(settings.default_quote_text, pageW - margin * 2).forEach((l) => { doc.text(l, margin, y); y += 4; });
  }

  // Fotos anexadas
  if (quote.images && quote.images.length) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Fotos Anexadas", margin, margin + 5);
    let imgY = margin + 10;
    const colW = 90;
    const maxH = 65;
    let col = 0;
    for (const imgUrl of quote.images) {
      const dataUrl = await fetchImageAsDataURL(imgUrl);
      if (!dataUrl) continue;
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.onerror = r; img.src = dataUrl; });
      if (!img.width || !img.height) continue;
      const ratio = Math.min(colW / img.width, maxH / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      const x = col === 0 ? margin : margin + colW + 5;
      if (imgY + h > 280) { doc.addPage(); imgY = margin; }
      doc.addImage(dataUrl, "JPEG", x, imgY, w, h);
      if (col === 1) { imgY += maxH + 5; col = 0; } else { col = 1; }
    }
  }

  return doc;
}

export async function generateQuotePDF(quote, items, settings) {
  try {
    const doc = await buildQuoteDoc(quote, items, settings);
    doc.save(`orcamento-${quote.number}.pdf`);
  } catch (e) {
    console.error("Erro ao gerar PDF:", e);
  }
}

export async function generateQuotePDFBlob(quote, items, settings) {
  const doc = await buildQuoteDoc(quote, items, settings);
  return doc.output("blob");
}

export function generateWorkOrderPDF(wo, items, settings) {
  const doc = new jsPDF();
  let y = header(doc, settings, "Ordem de Serviço", wo.number, wo.entry_date);
  y = clientBlock(doc, y, wo);
  if (wo.mileage_in != null) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Km entrada: ${Number(wo.mileage_in || 0).toLocaleString("pt-BR")}`, margin, y);
    y += 5;
  }
  if (wo.customer_report) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Relato:", margin, y); y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.splitTextToSize(wo.customer_report, pageW - margin * 2).forEach((l) => { doc.text(l, margin, y); y += 4; });
    y += 2;
  }
  if (wo.diagnosis) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Diagnóstico:", margin, y); y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.splitTextToSize(wo.diagnosis, pageW - margin * 2).forEach((l) => { doc.text(l, margin, y); y += 4; });
    y += 2;
  }
  y = itemsTable(doc, y, items);
  const partsSub = items.filter((i) => i.type === "material").reduce((s, i) => s + (i.total || 0), 0);
  const laborSub = items.filter((i) => i.type === "servico").reduce((s, i) => s + (i.total || 0), 0);
  y = totals(doc, y, wo, partsSub, laborSub);
  if (wo.internal_notes) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Observações Internas:", margin, y); y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.splitTextToSize(wo.internal_notes, pageW - margin * 2).forEach((l) => { doc.text(l, margin, y); y += 4; });
  }
  doc.save(`os-${wo.number}.pdf`);
}