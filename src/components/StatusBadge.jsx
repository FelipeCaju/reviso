import { Badge } from "@/components/ui/badge";

export const quoteStatusInfo = {
  rascunho: { label: "Rascunho", className: "bg-slate-100 text-slate-700" },
  aguardando_aprovacao: { label: "Aguardando Aprovação", className: "bg-amber-100 text-amber-800" },
  aprovado: { label: "Aprovado", className: "bg-emerald-100 text-emerald-800" },
  parcialmente_aprovado: { label: "Parcialmente Aprovado", className: "bg-teal-100 text-teal-800" },
  aguardando_agendamento: { label: "Aguardando Agendamento", className: "bg-blue-100 text-blue-800" },
  agendado: { label: "Agendado", className: "bg-indigo-100 text-indigo-800" },
  recusado: { label: "Recusado", className: "bg-rose-100 text-rose-800" },
  convertido_os: { label: "Convertido em OS", className: "bg-violet-100 text-violet-800" },
  cancelado: { label: "Cancelado", className: "bg-slate-200 text-slate-600" },
};

export const appointmentStatusInfo = {
  agendado: { label: "Agendado", className: "bg-blue-100 text-blue-800" },
  confirmado: { label: "Confirmado", className: "bg-sky-100 text-sky-800" },
  veiculo_recebido: { label: "Veículo Recebido", className: "bg-indigo-100 text-indigo-800" },
  em_atendimento: { label: "Em Atendimento", className: "bg-amber-100 text-amber-800" },
  concluido: { label: "Concluído", className: "bg-emerald-100 text-emerald-800" },
  cancelado: { label: "Cancelado", className: "bg-slate-200 text-slate-600" },
  nao_compareceu: { label: "Não Compareceu", className: "bg-rose-100 text-rose-800" },
};

export const appointmentTypeInfo = {
  avaliacao: "Avaliação",
  orcamento: "Orçamento",
  manutencao: "Manutenção",
  revisao: "Revisão",
  retorno: "Retorno",
  servico_agendado: "Serviço Agendado",
  outro: "Outro",
};

export const workOrderStatusInfo = {
  aberta: { label: "Aberta", className: "bg-slate-100 text-slate-700" },
  aguardando_pecas: { label: "Aguardando Peças", className: "bg-amber-100 text-amber-800" },
  em_execucao: { label: "Em Execução", className: "bg-blue-100 text-blue-800" },
  aguardando_aprovacao_adicional: { label: "Aguard. Aprovação Adicional", className: "bg-orange-100 text-orange-800" },
  finalizada: { label: "Finalizada", className: "bg-emerald-100 text-emerald-800" },
  pronta_retirada: { label: "Pronta para Retirada", className: "bg-teal-100 text-teal-800" },
  entregue: { label: "Entregue", className: "bg-violet-100 text-violet-800" },
  cancelada: { label: "Cancelada", className: "bg-slate-200 text-slate-600" },
};

export function QuoteStatusBadge({ status }) {
  const info = quoteStatusInfo[status] || { label: status, className: "bg-slate-100 text-slate-700" };
  return <Badge className={info.className + " font-normal rounded-full border-0"}>{info.label}</Badge>;
}

export function AppointmentStatusBadge({ status }) {
  const info = appointmentStatusInfo[status] || { label: status, className: "bg-slate-100 text-slate-700" };
  return <Badge className={info.className + " font-normal rounded-full border-0"}>{info.label}</Badge>;
}

export function WorkOrderStatusBadge({ status }) {
  const info = workOrderStatusInfo[status] || { label: status, className: "bg-slate-100 text-slate-700" };
  return <Badge className={info.className + " font-normal rounded-full border-0"}>{info.label}</Badge>;
}