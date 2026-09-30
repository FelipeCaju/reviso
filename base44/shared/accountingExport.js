const encoder = new TextEncoder();

export const cleanText = (value) => String(value ?? "").replace(/\r?\n/g, " ").trim();
export const dateOnly = (value) => cleanText(value).slice(0, 10);
export const inPeriod = (value, start, end) => {
  const date = dateOnly(value);
  return Boolean(date && date >= start && date <= end);
};

export function csv(rows, columns) {
  const escape = (value) => `"${cleanText(value).replace(/"/g, '""')}"`;
  return `\uFEFF${columns.map(([label]) => escape(label)).join(";")}\r\n${rows
    .map((row) => columns.map(([, field]) => escape(typeof field === "function" ? field(row) : row[field])).join(";"))
    .join("\r\n")}\r\n`;
}

export function buildAccountingData({ documents, expenses, workOrders, payments }, start, end) {
  const fiscalDate = (document) => document.direction === "INBOUND"
    ? document.entry_date || document.issue_date || document.competence_date
    : document.issue_date || document.competence_date;
  const periodDocuments = documents.filter((document) => inPeriod(fiscalDate(document), start, end));
  const periodExpenses = expenses.filter((expense) => inPeriod(expense.date || expense.due_date, start, end));
  const periodOrders = workOrders.filter((order) => order.status !== "cancelada" && inPeriod(order.completion_date || order.entry_date, start, end));
  const activePayments = payments.filter((payment) => payment.status !== "cancelado");

  const receivables = periodOrders.map((order) => {
    const orderPayments = activePayments.filter((payment) => payment.work_order_id === order.id);
    const received = orderPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const total = Number(order.total || 0);
    return { ...order, received, balance: Math.max(0, total - received) };
  });

  return {
    documents: periodDocuments,
    inbound: periodDocuments.filter((document) => document.direction === "INBOUND"),
    outbound: periodDocuments.filter((document) => document.direction === "OUTBOUND" && document.document_type === "NFE"),
    service: periodDocuments.filter((document) => document.direction === "OUTBOUND" && document.document_type === "NFSE"),
    expenses: periodExpenses,
    receivables,
  };
}

export function buildCsvFiles(data) {
  const money = (value) => Number(value || 0).toFixed(2).replace(".", ",");
  return {
    "financeiro/contas-a-pagar.csv": csv(data.expenses, [
      ["ID", "id"], ["Data", (row) => dateOnly(row.date)], ["Vencimento", (row) => dateOnly(row.due_date)],
      ["Descrição", "description"], ["Beneficiário", "beneficiary"], ["Categoria", "category"],
      ["Valor", (row) => money(row.amount)], ["Status", "status"], ["Documento fiscal", "fiscal_document_id"],
    ]),
    "financeiro/contas-a-receber.csv": csv(data.receivables, [
      ["OS", "number"], ["Data de conclusão", (row) => dateOnly(row.completion_date || row.entry_date)],
      ["Cliente", "customer_name_snapshot"], ["Valor total", (row) => money(row.total)],
      ["Valor recebido", (row) => money(row.received)], ["Saldo", (row) => money(row.balance)],
      ["Status financeiro", "payment_status"], ["ID da OS", "id"],
    ]),
  };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) { return Uint8Array.of(value & 255, (value >>> 8) & 255); }
function u32(value) { return Uint8Array.of(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255); }
function join(parts) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

export function zipFiles(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const filename = encoder.encode(name);
    const data = content instanceof Uint8Array ? content : encoder.encode(String(content));
    const checksum = crc32(data);
    const header = join([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(checksum), u32(data.length), u32(data.length), u16(filename.length), u16(0), filename]);
    local.push(header, data);
    central.push(join([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(checksum), u32(data.length), u32(data.length), u16(filename.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), filename]));
    offset += header.length + data.length;
  }
  const centralBytes = join(central);
  return join([...local, centralBytes, u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(centralBytes.length), u32(offset), u16(0)]);
}

