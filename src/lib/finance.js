import { base44 } from "@/api/base44Client";
import { withWorkshop } from "@/lib/workshop";

/**
 * Cria um pagamento de OS + movimentação financeira (entrada)
 */
export async function registerOSPayment({ workOrderId, amount, method, date, notes, user, wo }) {
  const paymentDate = date || new Date().toISOString();
  const customerName = wo?.customer_name_snapshot || "";

  const payment = await base44.entities.Payment.create(withWorkshop({
    work_order_id: workOrderId,
    customer_id: wo?.customer_id || "",
    customer_name_snapshot: customerName,
    amount,
    method,
    date: paymentDate,
    notes: notes || "",
    registered_by: user?.full_name || user?.email || "",
    status: "ativo",
  }));

  await base44.entities.FinancialTransaction.create(withWorkshop({
    type: "entrada",
    origin_type: "os",
    origin_id: payment.id,
    description: `Pagamento OS #${wo?.number || ""} — ${customerName}`,
    date: paymentDate,
    amount,
    payment_method: method,
    status: "ativo",
    customer_id: wo?.customer_id || "",
    customer_name_snapshot: customerName,
  }));

  return payment;
}

/**
 * Cancela um pagamento (estorno) — preserva histórico
 */
export async function cancelOSPayment(payment, reason, user) {
  await base44.entities.Payment.update(payment.id, {
    status: "cancelado",
    cancel_reason: reason || "",
    cancelled_at: new Date().toISOString(),
    cancelled_by: user?.full_name || user?.email || "",
  });
  // Cancelar a movimentação financeira correspondente
  const transactions = await base44.entities.FinancialTransaction.filter({ origin_id: payment.id });
  if (transactions.length) {
    await base44.entities.FinancialTransaction.update(transactions[0].id, { status: "cancelado" });
  }
}

/**
 * Marca despesa como paga + cria movimentação financeira (saída)
 */
export async function markExpensePaid(expense, method, paymentDate, user) {
  const date = paymentDate || new Date().toISOString().slice(0, 10);
  await base44.entities.Expense.update(expense.id, {
    status: "pago",
    payment_date: date,
    payment_method: method,
  });

  const beneficiary = expense.beneficiary || "";
  const description = `Despesa: ${expense.description}${beneficiary ? ` — ${beneficiary}` : ""}`;

  await base44.entities.FinancialTransaction.create(withWorkshop({
    type: "saida",
    origin_type: "despesa",
    origin_id: expense.id,
    description,
    date: new Date(date).toISOString(),
    amount: expense.amount,
    payment_method: method,
    status: "ativo",
    supplier_id: expense.supplier_id || "",
    supplier_name_snapshot: beneficiary,
    category: expense.category || "",
  }));
}

/**
 * Marca pedido de compra como pago + cria movimentação financeira (saída)
 */
export async function markPurchaseOrderPaid(order, method, paymentDate, user, supplierName) {
  const date = paymentDate || new Date().toISOString().slice(0, 10);
  await base44.entities.PurchaseOrder.update(order.id, {
    payment_status: "pago",
    paid_amount: order.total,
  });

  await base44.entities.FinancialTransaction.create(withWorkshop({
    type: "saida",
    origin_type: "pedido",
    origin_id: order.id,
    description: `Pedido de Compra #${order.number} — ${supplierName || order.supplier_name_snapshot || ""}`,
    date: new Date(date).toISOString(),
    amount: order.total,
    payment_method: method,
    status: "ativo",
    supplier_id: order.supplier_id || "",
    supplier_name_snapshot: supplierName || order.supplier_name_snapshot || "",
  }));
}

/**
 * Gera instâncias mensais de despesas recorrentes que ainda não foram criadas
 * para o mês atual. Preserva histórico — cada mês tem seu próprio registro.
 */
export async function generateRecurringExpenses(workshopId) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Busca despesas recorrentes (templates)
  const recurring = await base44.entities.Expense.filter({ is_recurring: true });
  if (!recurring.length) return { generated: 0 };

  // Busca instâncias já geradas para o mês atual
  const existing = await base44.entities.Expense.filter({ month_key: monthKey });
  const existingParentIds = new Set(existing.map((e) => e.parent_expense_id).filter(Boolean));

  const toCreate = [];
  for (const template of recurring) {
    if (existingParentIds.has(template.id)) continue;
    // Verifica se a recorrência já começou
    if (template.recurrence_start && new Date(template.recurrence_start) > now) continue;
    // Verifica se a recorrência já terminou
    if (template.recurrence_end && new Date(template.recurrence_end) < now) continue;

    const dueDate = `${monthKey}-${String(template.recurrence_day || 1).padStart(2, "0")}`;
    toCreate.push(withWorkshop({
      description: template.description,
      category: template.category,
      supplier_id: template.supplier_id || "",
      beneficiary: template.beneficiary || "",
      amount: template.amount,
      date: dueDate,
      due_date: dueDate,
      status: "pendente",
      payment_method: "",
      notes: "",
      type: "fixa",
      is_recurring: false,
      parent_expense_id: template.id,
      month_key: monthKey,
    }));
  }

  if (toCreate.length) {
    await base44.entities.Expense.bulkCreate(toCreate);
  }
  return { generated: toCreate.length };
}

/**
 * Calcula o status de pagamento da OS com base nos pagamentos ativos
 */
export function calcPaymentStatus(total, payments) {
  const activePayments = payments.filter((p) => p.status === "ativo");
  const paid = activePayments.reduce((s, p) => s + (p.amount || 0), 0);
  if (total <= 0 || paid <= 0) return { status: "nao_pago", paid: 0, balance: total };
  if (paid >= total) return { status: "pago", paid, balance: 0 };
  return { status: "parcialmente_pago", paid, balance: total - paid };
}