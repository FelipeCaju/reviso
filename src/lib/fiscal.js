import { base44 } from "@/api/base44Client";

export async function getFiscalContext() {
  const response = await base44.functions.invoke("manageFiscal", { action: "context" });
  return response.data;
}

export async function saveFiscalSetting(data) {
  const response = await base44.functions.invoke("manageFiscal", { action: "saveSetting", data });
  return response.data;
}

export async function saveServiceFiscalProfile(data) {
  const response = await base44.functions.invoke("manageFiscal", { action: "saveServiceProfile", data });
  return response.data;
}

export async function saveMaterialFiscalProfile(data) {
  const response = await base44.functions.invoke("manageFiscal", { action: "saveMaterialProfile", data });
  return response.data;
}

export async function previewFiscalDocument(workOrderId) {
  const response = await base44.functions.invoke("manageFiscal", { action: "preview", workOrderId });
  return response.data;
}

export async function issueFiscalDocument(workOrderId, competenceDate) {
  const response = await base44.functions.invoke("manageFiscal", { action: "issue", workOrderId, competenceDate });
  return response.data;
}

export function fiscalErrorMessage(error) {
  return error?.response?.data?.error || error?.data?.error || error?.message || "Não foi possível concluir a operação fiscal.";
}
