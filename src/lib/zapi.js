import { base44 } from "@/api/base44Client";

const documentLabels = {
  quote: "o orçamento",
  "work-order": "a Ordem de Serviço",
  "purchase-quote": "a cotação",
};

export function getWhatsAppDocumentPreview({ recipientName, workshopName, reference, documentType }) {
  const greeting = recipientName ? `Olá, ${recipientName}!` : "Olá!";
  const referenceText = reference ? ` #${reference}` : "";
  return `${greeting}\n\nAqui é ${workshopName || "a oficina"}.\nSegue ${documentLabels[documentType] || "o documento"}${referenceText} para sua análise.\n\nFicamos à disposição.`;
}

export async function sendWhatsAppDocument({ blob, fileName, phone, recipientName, reference, documentType }) {
  let normalizedPhone = String(phone || "").replace(/\D/g, "");
  if (normalizedPhone.length === 10 || normalizedPhone.length === 11) normalizedPhone = `55${normalizedPhone}`;
  if (!/^55\d{10,11}$/.test(normalizedPhone)) throw new Error("Número de Telefone incorreto");

  const file = new File([blob], fileName, { type: "application/pdf" });
  const { file_url: documentUrl } = await base44.integrations.Core.UploadPublicFile({ file });
  await base44.functions.invoke("sendWhatsAppDocument", {
    phone: normalizedPhone,
    documentUrl,
    fileName,
    recipientName,
    reference,
    documentType,
  });
}

export function getWhatsAppErrorMessage(error) {
  return error?.response?.data?.error || error?.data?.error || error?.message || "Não foi possível enviar o WhatsApp.";
}
