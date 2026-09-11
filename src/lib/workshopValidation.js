// Campos obrigatórios do perfil da oficina — aplicados em todos os fluxos
export const MANDATORY_FIELDS = [
  { key: "name", label: "Nome da Oficina" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "address", label: "Endereço" },
];

// Retorna array de labels dos campos obrigatórios faltantes
export function getMissingFields(data) {
  return MANDATORY_FIELDS.filter(
    (f) => !data[f.key] || !String(data[f.key]).trim()
  ).map((f) => f.label);
}

// Retorna true se todos os campos obrigatórios estão preenchidos
export function isWorkshopProfileComplete(data) {
  return getMissingFields(data).length === 0;
}

// Retorna mensagem de erro formatada, ou null se tudo OK
export function getValidationMessage(data) {
  const missing = getMissingFields(data);
  if (missing.length === 0) return null;
  if (missing.length === 1) return `Informe o campo obrigatório: ${missing[0]}`;
  return `Preencha os campos obrigatórios: ${missing.join(", ")}`;
}