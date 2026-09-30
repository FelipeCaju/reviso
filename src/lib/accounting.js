import { base44 } from "@/api/base44Client";

export async function getAccountingSummary(start, end) {
  const response = await base44.functions.invoke("manageAccountingCenter", { action: "summary", start, end });
  return response.data;
}

export async function exportAccountingPackage(start, end) {
  const response = await base44.functions.invoke("manageAccountingCenter", { action: "export", start, end });
  return response.data;
}

export function downloadBase64({ base64, filename, mime_type }) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime_type || "application/octet-stream" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function accountingErrorMessage(error) {
  return error?.response?.data?.error || error?.message || "Não foi possível concluir a exportação contábil.";
}

