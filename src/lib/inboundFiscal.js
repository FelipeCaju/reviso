import { base44 } from "@/api/base44Client";

async function invoke(action, payload = {}) {
  const response = await base44.functions.invoke("manageInboundFiscal", { action, ...payload });
  return response.data;
}

export const getInboundFiscalContext = () => invoke("context");
export const getInboundFiscalDetails = (documentId) => invoke("details", { documentId });
export const previewInboundXml = (file) => invoke("previewXml", { file });
export const createInboundDocument = (document, items, file) => invoke("create", { document, items, file });
export const createInboundSupplier = (data) => invoke("createSupplier", { data });
export const createInboundMaterial = (data) => invoke("createMaterial", { data });
export const processInboundStock = (documentId) => invoke("processStock", { documentId });
export const createInboundPayable = (documentId, dueDate) => invoke("createPayable", { documentId, dueDate });
export const attachInboundXml = (documentId, file) => invoke("attachXml", { documentId, file });
export const getInboundXmlUrl = (documentId) => invoke("xmlUrl", { documentId });
export const receivePurchaseOrder = (orderId) => invoke("receivePurchaseOrder", { orderId });

export function inboundFiscalError(error) {
  return error?.response?.data?.error || error?.message || "Não foi possível concluir a operação.";
}

export function readXmlFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/\.xml$/i.test(file.name) || file.size > 3_000_000) {
      reject(new Error("Selecione um arquivo XML de até 3 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o XML."));
    reader.onload = () => resolve({ name: file.name, type: file.type || "application/xml", base64: String(reader.result).split(",")[1] || "" });
    reader.readAsDataURL(file);
  });
}
