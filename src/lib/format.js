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

export const addDaysISO = (days, base) => {
  const d = base ? new Date(base) : new Date();
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

export const appointmentTypeInfo = {
  avaliacao: { label: "Avaliação", color: "bg-amber-100 text-amber-700" },
  orcamento: { label: "Orçamento", color: "bg-violet-100 text-violet-700" },
  manutencao: { label: "Manutenção", color: "bg-blue-100 text-blue-700" },
  revisao: { label: "Revisão", color: "bg-emerald-100 text-emerald-700" },
  retorno: { label: "Retorno", color: "bg-cyan-100 text-cyan-700" },
  servico_agendado: { label: "Serviço Agendado", color: "bg-indigo-100 text-indigo-700" },
  outro: { label: "Outro", color: "bg-slate-100 text-slate-700" },
};