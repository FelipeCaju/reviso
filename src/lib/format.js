export const formatCurrency = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatNumber = (v) =>
  Number(v || 0).toLocaleString("pt-BR");

const toDate = (d) => {
  if (!d) return null;
  if (d instanceof Date) return d;
  const s = String(d);
  return new Date(s.length === 10 ? s + "T00:00:00" : s);
};

export const formatDate = (d) => {
  const date = toDate(d);
  return date ? date.toLocaleDateString("pt-BR") : "";
};

export const formatDateTime = (d) => {
  const date = toDate(d);
  if (!date) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatTime = (d) => {
  const date = toDate(d);
  if (!date) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

export const normalizePlate = (p) => (p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const addDaysISO = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const vehicleDescription = (v) => {
  if (!v) return "";
  return [v.brand, v.model, v.year_model].filter(Boolean).join(" ") || v.plate || "";
};

export const vehicleTypeLabel = {
  carro: "Carro",
  moto: "Moto",
  caminhonete: "Caminhonete",
  van: "Van",
  caminhao: "Caminhão",
  outro: "Outro",
};