import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { parseInboundXml } from "../../shared/inboundXml.js";

const clean = (value: unknown) => String(value ?? "").trim();
const digits = (value: unknown) => clean(value).replace(/\D/g, "");
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const asDateTime = (value: unknown) => {
  const text = clean(value);
  if (!text) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00.000Z` : text;
};

function error(message: string, status = 400, code = "INBOUND_FISCAL_ERROR") {
  return Object.assign(new Error(message), { status, code });
}

function xmlFromFile(file: any) {
  if (!file?.base64) throw error("Arquivo XML não informado.");
  const binary = atob(String(file.base64));
  if (binary.length > 3_000_000) throw error("O XML excede 3 MB.", 413, "XML_SIZE_INVALID");
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

async function uploadXml(base44: any, file: any, xml: string) {
  const safeName = clean(file?.name).replace(/[^a-zA-Z0-9._-]/g, "_") || `documento-fiscal-${Date.now()}.xml`;
  const result = await base44.integrations.Core.UploadPrivateFile({ file: new File([xml], safeName, { type: "application/xml" }) });
  return result.file_uri;
}

async function ensureWorkshopRecord(entity: any, id: string, workshopId: string, label: string) {
  const record = await entity.get(id);
  if (!record?.id || record.workshop_id !== workshopId) throw error(`${label} não encontrado.`, 404);
  return record;
}

async function acquireOperationLock(db: any, workshopId: string, sourceType: "FISCAL_DOCUMENT" | "PURCHASE_ORDER", sourceId: string, operation: "STOCK" | "FINANCIAL" | "RECEIPT") {
  const currentTime = now();
  const active = await db.FiscalOperationLock.filter({ workshop_id: workshopId, source_type: sourceType, source_id: sourceId, operation, status: "ACTIVE" }, "created_date", 20);
  for (const stale of active.filter((lock: any) => clean(lock.expires_at) <= currentTime)) await db.FiscalOperationLock.update(stale.id, { status: "RELEASED" });
  const token = crypto.randomUUID();
  const lock = await db.FiscalOperationLock.create({ workshop_id: workshopId, source_type: sourceType, source_id: sourceId, operation, token, status: "ACTIVE", expires_at: new Date(Date.now() + 5 * 60_000).toISOString() });
  const contenders = await db.FiscalOperationLock.filter({ workshop_id: workshopId, source_type: sourceType, source_id: sourceId, operation, status: "ACTIVE" }, "created_date", 20);
  if (contenders[0]?.id !== lock.id) {
    await db.FiscalOperationLock.update(lock.id, { status: "RELEASED" });
    throw error("Esta operação já está sendo processada.", 409, `${operation}_ALREADY_PROCESSING`);
  }
  return lock;
}

async function releaseOperationLock(db: any, lock: any) {
  if (lock?.id) await db.FiscalOperationLock.update(lock.id, { status: "RELEASED" }).catch(() => {});
}

async function duplicateDocument(db: any, workshopId: string, parsed: any, excludeId = "") {
  let rows: any[] = [];
  if (parsed.access_key) rows = await db.FiscalDocument.filter({ workshop_id: workshopId, direction: "INBOUND", access_key: parsed.access_key }, "-created_date", 10);
  else if (parsed.number && parsed.supplier?.cpf_cnpj) {
    rows = await db.FiscalDocument.filter({ workshop_id: workshopId, direction: "INBOUND", document_type: parsed.document_type, number: parsed.number }, "-created_date", 100);
    rows = rows.filter((row) => digits(row.supplier_snapshot?.cpf_cnpj) === digits(parsed.supplier.cpf_cnpj));
  }
  return rows.find((row) => row.id !== excludeId);
}

async function enrichPreview(db: any, workshop: any, parsed: any, excludeId = "") {
  const expected = digits(workshop.cnpj || workshop.cpf_cnpj);
  if (!expected || digits(parsed.recipient_document) !== expected) throw error("O destinatário do XML não corresponde à oficina atual.", 422, "RECIPIENT_MISMATCH");
  if (await duplicateDocument(db, workshop.id, parsed, excludeId)) throw error("Documento já cadastrado.", 409, "DUPLICATE_DOCUMENT");
  const supplierRows = parsed.supplier.cpf_cnpj ? await db.Supplier.filter({ workshop_id: workshop.id }, "-updated_date", 2000) : [];
  const suppliers = supplierRows.filter((supplier: any) => digits(supplier.cpf_cnpj) === digits(parsed.supplier.cpf_cnpj));
  const allMaterials = await db.Material.filter({ workshop_id: workshop.id }, "-updated_date", 2000);
  const links = suppliers[0] ? await db.SupplierMaterial.filter({ workshop_id: workshop.id, supplier_id: suppliers[0].id }, "-updated_date", 2000) : [];
  const items = parsed.items.map((item: any) => {
    const link = links.find((candidate: any) => item.supplier_product_code && candidate.supplier_product_code === item.supplier_product_code)
      || links.find((candidate: any) => item.gtin && candidate.supplier_gtin === item.gtin);
    const material = link ? allMaterials.find((candidate: any) => candidate.id === link.material_id)
      : allMaterials.find((candidate: any) => item.gtin && [candidate.gtin, candidate.barcode].includes(item.gtin));
    return { ...item, material_id: material?.id || "", matched_material_name: material?.description || material?.name || "" };
  });
  return { ...parsed, supplier_id: suppliers[0]?.id || "", matched_supplier_name: suppliers[0]?.name || "", items };
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!user.workshop_id || user.role !== "admin") return Response.json({ error: "Operação não autorizada." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const action = clean(body.action);
    const db = base44.asServiceRole.entities;
    const workshop = await ensureWorkshopRecord(db.WorkshopSetting, user.workshop_id, user.workshop_id, "Oficina");

    if (action === "receivePurchaseOrder") {
      const order = await ensureWorkshopRecord(db.PurchaseOrder, clean(body.orderId), workshop.id, "Pedido");
      if (["recebido", "cancelado"].includes(order.status)) throw error("Este pedido não pode ser recebido novamente.", 409);
      const operationLock = await acquireOperationLock(db, workshop.id, "PURCHASE_ORDER", order.id, "RECEIPT");
      const receiptToken = crypto.randomUUID();
      await db.PurchaseOrder.update(order.id, { receipt_processing_token: receiptToken });
      const lockedOrder = await db.PurchaseOrder.get(order.id);
      if (lockedOrder.receipt_processing_token !== receiptToken) {
        await releaseOperationLock(db, operationLock);
        throw error("O recebimento já está sendo processado.", 409, "RECEIPT_ALREADY_PROCESSING");
      }
      const orderItems = await db.PurchaseOrderItem.filter({ workshop_id: workshop.id, order_id: order.id }, "created_date", 1000);
      const changed: any[] = [];
      try {
        for (const item of orderItems.filter((entry: any) => entry.material_id && !entry.received)) {
          const existing = await db.StockMovement.filter({ workshop_id: workshop.id, source_type: "PURCHASE_ORDER", source_item_id: item.id }, "-created_date", 2);
          if (existing.length) throw error("Este item de compra já movimentou o estoque.", 409);
          const material = await ensureWorkshopRecord(db.Material, item.material_id, workshop.id, "Material");
          const previous = Number(material.stock || 0);
          const quantity = Number(item.quantity || 0);
          const movement = await db.StockMovement.create({ workshop_id: workshop.id, material_id: material.id, type: "PURCHASE_ENTRY", quantity, unit_cost: Number(item.unit_price || 0), previous_stock: previous, resulting_stock: previous + quantity, source_type: "PURCHASE_ORDER", source_id: order.id, source_item_id: item.id, occurred_at: now(), created_by: user.email || user.id });
          const contenders = await db.StockMovement.filter({ workshop_id: workshop.id, source_type: "PURCHASE_ORDER", source_item_id: item.id }, "created_date", 10);
          if (contenders[0]?.id !== movement.id) {
            await db.StockMovement.delete(movement.id);
            throw error("Este item de compra já está sendo recebido.", 409, "RECEIPT_ALREADY_PROCESSING");
          }
          await db.Material.update(material.id, { stock: previous + quantity, cost: Number(item.unit_price || material.cost || 0) });
          changed.push({ material, movement, item });
          await db.PurchaseOrderItem.update(item.id, { received: true, received_quantity: quantity });
        }
        await db.PurchaseOrder.update(order.id, { status: "recebido", received_date: now(), receipt_processing_token: "" });
        await releaseOperationLock(db, operationLock);
      } catch (cause) {
        for (const change of changed.reverse()) {
          await db.Material.update(change.material.id, { stock: Number(change.material.stock || 0), cost: Number(change.material.cost || 0) }).catch(() => {});
          await db.StockMovement.delete(change.movement.id).catch(() => {});
          await db.PurchaseOrderItem.update(change.item.id, { received: false, received_quantity: 0 }).catch(() => {});
        }
        const currentOrder = await db.PurchaseOrder.get(order.id).catch(() => null);
        if (currentOrder?.receipt_processing_token === receiptToken) await db.PurchaseOrder.update(order.id, { receipt_processing_token: "" }).catch(() => {});
        await releaseOperationLock(db, operationLock);
        throw cause;
      }
      return Response.json({ success: true });
    }

    if (!workshop.fiscal_module_enabled) return Response.json({ error: "O módulo fiscal não está habilitado para esta oficina." }, { status: 403 });

    if (action === "context") {
      const [documents, suppliers, materials, supplierMaterials] = await Promise.all([
        db.FiscalDocument.filter({ workshop_id: workshop.id, direction: "INBOUND" }, "-entry_date", 1000),
        db.Supplier.filter({ workshop_id: workshop.id }, "name", 2000),
        db.Material.filter({ workshop_id: workshop.id }, "description", 2000),
        db.SupplierMaterial.filter({ workshop_id: workshop.id }, "-updated_date", 4000),
      ]);
      return Response.json({ documents, suppliers, materials, supplierMaterials });
    }

    if (action === "details") {
      const document = await ensureWorkshopRecord(db.FiscalDocument, clean(body.documentId), workshop.id, "Documento");
      if (document.direction !== "INBOUND") throw error("Documento de entrada não encontrado.", 404);
      const [items, events, movements] = await Promise.all([
        db.FiscalDocumentItem.filter({ workshop_id: workshop.id, fiscal_document_id: document.id }, "created_date", 1000),
        db.FiscalDocumentEvent.filter({ workshop_id: workshop.id, fiscal_document_id: document.id }, "created_date", 1000),
        db.StockMovement.filter({ workshop_id: workshop.id, source_type: "FISCAL_DOCUMENT", source_id: document.id }, "created_date", 1000),
      ]);
      const expense = document.expense_id ? await ensureWorkshopRecord(db.Expense, document.expense_id, workshop.id, "Conta a pagar") : null;
      return Response.json({ document, items, events, movements, expense });
    }

    if (action === "previewXml") {
      const xml = xmlFromFile(body.file);
      const preview = await enrichPreview(db, workshop, parseInboundXml(xml));
      return Response.json({ preview });
    }

    if (action === "createSupplier") {
      const data = body.data || {};
      if (!clean(data.name) || !digits(data.cpf_cnpj)) throw error("Nome e CPF/CNPJ do fornecedor são obrigatórios.");
      const duplicates = await db.Supplier.filter({ workshop_id: workshop.id, cpf_cnpj: clean(data.cpf_cnpj) }, "-updated_date", 10);
      if (duplicates.length) return Response.json({ supplier: duplicates[0], existing: true });
      const supplier = await db.Supplier.create({ workshop_id: workshop.id, name: clean(data.name), razao_social: clean(data.name), fantasy_name: clean(data.fantasy_name), cpf_cnpj: clean(data.cpf_cnpj), inscricao_estadual: clean(data.inscricao_estadual), inscricao_municipal: clean(data.inscricao_municipal), active: true });
      return Response.json({ supplier, existing: false });
    }

    if (action === "createMaterial") {
      const data = body.data || {};
      if (!clean(data.description)) throw error("A descrição do material é obrigatória.");
      const material = await db.Material.create({ workshop_id: workshop.id, description: clean(data.description), name: clean(data.description), unit: clean(data.unit) || "un", gtin: clean(data.gtin), barcode: clean(data.gtin), cost: Number(data.cost || 0), sale_price: 0, stock: 0, active: true });
      if (clean(data.ncm) || clean(data.cest)) await db.MaterialFiscalProfile.create({ workshop_id: workshop.id, material_id: material.id, ncm: clean(data.ncm), cest: clean(data.cest), active: true });
      return Response.json({ material });
    }

    if (action === "create") {
      const input = body.document || {};
      const sourceType = body.file?.base64 ? "XML" : "MANUAL";
      let parsed: any = null;
      let xml = "";
      if (sourceType === "XML") {
        xml = xmlFromFile(body.file);
        parsed = await enrichPreview(db, workshop, parseInboundXml(xml));
      }
      const documentType = clean(parsed?.document_type || input.document_type);
      if (!['NFE', 'NFSE'].includes(documentType)) throw error("Tipo de documento inválido.");
      const supplierId = clean(input.supplier_id || parsed?.supplier_id);
      const supplier = await ensureWorkshopRecord(db.Supplier, supplierId, workshop.id, "Fornecedor");
      const number = clean(parsed?.number || input.number);
      const rawAccessKey = clean(parsed?.access_key || input.access_key);
      const accessKey = digits(rawAccessKey).length === 44 ? digits(rawAccessKey) : rawAccessKey;
      const totalDocument = Number(parsed?.total_document ?? input.total_document ?? 0);
      if (!number || totalDocument < 0) throw error("Informe número e valor total válidos.");
      const duplicateInput = parsed || { document_type: documentType, number, access_key: accessKey, supplier: { cpf_cnpj: supplier.cpf_cnpj } };
      if (await duplicateDocument(db, workshop.id, duplicateInput)) throw error("Documento já cadastrado.", 409, "DUPLICATE_DOCUMENT");
      const inputItems = Array.isArray(body.items) ? body.items : parsed?.items || [];
      if (!inputItems.length) throw error("Adicione pelo menos um item ao documento.");
      const preparedItems = [];
      for (let index = 0; index < inputItems.length; index++) {
        const item = inputItems[index];
        const materialId = clean(item.material_id);
        if (materialId) await ensureWorkshopRecord(db.Material, materialId, workshop.id, "Material");
        preparedItems.push({
          workshop_id: workshop.id, source_item_type: sourceType === "XML" ? "XML_ITEM" : "MANUAL_ITEM", source_item_id: clean(item.source_item_id) || String(index + 1),
          item_type: documentType === "NFSE" ? "SERVICE" : clean(item.item_type) || "PRODUCT", material_id: materialId,
          supplier_product_code: clean(item.supplier_product_code), gtin: clean(item.gtin), description: clean(item.description) || `Item ${index + 1}`,
          quantity: Number(item.quantity || 1), unit: clean(item.unit) || "un", unit_price: Number(item.unit_price || 0), total: Number(item.total ?? Number(item.quantity || 1) * Number(item.unit_price || 0)),
          track_stock: documentType === "NFE" && !!item.track_stock && !!materialId, stock_processed: false,
          product_fiscal_snapshot: { ncm: clean(item.ncm), cest: clean(item.cest) }, tax_snapshot: {},
        });
      }
      const fileUri = sourceType === "XML" ? await uploadXml(base44, body.file, xml) : "";
      const document = await db.FiscalDocument.create({
        workshop_id: workshop.id, direction: "INBOUND", document_type: documentType, source_type: sourceType, source_id: "",
        supplier_id: supplier.id, status: "REGISTERED", issue_date: asDateTime(parsed?.issue_date || input.issue_date),
        entry_date: clean(input.entry_date) || today(), number, series: clean(parsed?.series || input.series), access_key: accessKey,
        total_services: documentType === "NFSE" ? totalDocument : 0, total_products: documentType === "NFE" ? totalDocument : 0, total_document: totalDocument,
        issuer_snapshot: {}, supplier_snapshot: supplier, fiscal_setting_snapshot: {}, xml_file_uri: fileUri, xml_validated: sourceType === "XML",
      });
      await db.FiscalDocumentItem.bulkCreate(preparedItems.map((item) => ({ ...item, fiscal_document_id: document.id })));
      await db.FiscalDocumentEvent.create({ workshop_id: workshop.id, fiscal_document_id: document.id, event_type: sourceType === "XML" ? "XML_IMPORTED" : "REGISTERED", status: "REGISTERED", created_by: user.email || user.id });

      for (const item of preparedItems.filter((entry) => entry.material_id && entry.supplier_product_code)) {
        const links = await db.SupplierMaterial.filter({ workshop_id: workshop.id, supplier_id: supplier.id, material_id: item.material_id }, "-updated_date", 2);
        const linkData = { supplier_product_code: item.supplier_product_code, supplier_description: item.description, supplier_gtin: item.gtin, last_price: item.unit_price, last_price_date: now(), active: true };
        if (links[0]) await db.SupplierMaterial.update(links[0].id, linkData);
        else await db.SupplierMaterial.create({ workshop_id: workshop.id, supplier_id: supplier.id, material_id: item.material_id, ...linkData, price_history: [{ date: now(), price: item.unit_price }] });
      }
      return Response.json({ success: true, document });
    }

    if (action === "attachXml") {
      const document = await ensureWorkshopRecord(db.FiscalDocument, clean(body.documentId), workshop.id, "Documento");
      if (document.direction !== "INBOUND" || document.source_type !== "MANUAL") throw error("Somente uma entrada manual pode receber XML.", 409);
      const xml = xmlFromFile(body.file);
      const parsed = await enrichPreview(db, workshop, parseInboundXml(xml), document.id);
      if (parsed.document_type !== document.document_type || clean(parsed.number) !== clean(document.number) || digits(parsed.supplier.cpf_cnpj) !== digits(document.supplier_snapshot?.cpf_cnpj)) throw error("O XML não corresponde ao documento manual.", 422, "XML_DOCUMENT_MISMATCH");
      const fileUri = await uploadXml(base44, body.file, xml);
      await db.FiscalDocument.update(document.id, { access_key: parsed.access_key, xml_file_uri: fileUri, xml_validated: true });
      await db.FiscalDocumentEvent.create({ workshop_id: workshop.id, fiscal_document_id: document.id, event_type: "XML_LINKED", status: document.status, created_by: user.email || user.id });
      return Response.json({ success: true });
    }

    if (action === "processStock") {
      const document = await ensureWorkshopRecord(db.FiscalDocument, clean(body.documentId), workshop.id, "Documento");
      if (document.direction !== "INBOUND" || document.document_type !== "NFE") throw error("Somente NF-e de entrada movimenta estoque.");
      if (document.stock_processed_at) throw error("O estoque deste documento já foi processado.", 409);
      const operationLock = await acquireOperationLock(db, workshop.id, "FISCAL_DOCUMENT", document.id, "STOCK");
      const stockToken = crypto.randomUUID();
      await db.FiscalDocument.update(document.id, { stock_processing_token: stockToken });
      const lockedDocument = await db.FiscalDocument.get(document.id);
      if (lockedDocument.stock_processing_token !== stockToken) {
        await releaseOperationLock(db, operationLock);
        throw error("O estoque deste documento já está sendo processado.", 409, "STOCK_ALREADY_PROCESSING");
      }
      const items = await db.FiscalDocumentItem.filter({ workshop_id: workshop.id, fiscal_document_id: document.id }, "created_date", 1000);
      const selected = items.filter((item: any) => item.track_stock && item.material_id);
      const changed: any[] = [];
      try {
        for (const item of selected) {
          const movements = await db.StockMovement.filter({ workshop_id: workshop.id, source_type: "FISCAL_DOCUMENT", source_item_id: item.id }, "-created_date", 2);
          if (movements.length || item.stock_processed) throw error("Um item deste documento já movimentou o estoque.", 409);
          const material = await ensureWorkshopRecord(db.Material, item.material_id, workshop.id, "Material");
          const previous = Number(material.stock || 0);
          const quantity = Number(item.quantity || 0);
          const movement = await db.StockMovement.create({ workshop_id: workshop.id, material_id: material.id, type: "FISCAL_ENTRY", quantity, unit_cost: Number(item.unit_price || 0), previous_stock: previous, resulting_stock: previous + quantity, source_type: "FISCAL_DOCUMENT", source_id: document.id, source_item_id: item.id, occurred_at: now(), created_by: user.email || user.id });
          const contenders = await db.StockMovement.filter({ workshop_id: workshop.id, source_type: "FISCAL_DOCUMENT", source_item_id: item.id }, "created_date", 10);
          if (contenders[0]?.id !== movement.id) {
            await db.StockMovement.delete(movement.id);
            throw error("Este item já está sendo processado no estoque.", 409, "STOCK_ALREADY_PROCESSING");
          }
          await db.Material.update(material.id, { stock: previous + quantity, cost: Number(item.unit_price || material.cost || 0) });
          changed.push({ material, movement, item });
          await db.FiscalDocumentItem.update(item.id, { stock_processed: true });
        }
        await db.FiscalDocument.update(document.id, { stock_processed_at: now(), stock_processing_token: "", status: document.financial_processed_at ? "PROCESSED" : "PARTIALLY_PROCESSED" });
        await db.FiscalDocumentEvent.create({ workshop_id: workshop.id, fiscal_document_id: document.id, event_type: "STOCK_PROCESSED", status: "PARTIALLY_PROCESSED", created_by: user.email || user.id });
        await releaseOperationLock(db, operationLock);
      } catch (cause) {
        for (const change of changed.reverse()) {
          await db.Material.update(change.material.id, { stock: Number(change.material.stock || 0), cost: Number(change.material.cost || 0) }).catch(() => {});
          await db.StockMovement.delete(change.movement.id).catch(() => {});
          await db.FiscalDocumentItem.update(change.item.id, { stock_processed: false }).catch(() => {});
        }
        const currentDocument = await db.FiscalDocument.get(document.id).catch(() => null);
        if (currentDocument?.stock_processing_token === stockToken) await db.FiscalDocument.update(document.id, { stock_processing_token: "" }).catch(() => {});
        await releaseOperationLock(db, operationLock);
        throw cause;
      }
      return Response.json({ success: true });
    }

    if (action === "createPayable") {
      const document = await ensureWorkshopRecord(db.FiscalDocument, clean(body.documentId), workshop.id, "Documento");
      if (document.direction !== "INBOUND") throw error("Apenas documentos de entrada podem gerar conta a pagar.");
      const existing = await db.Expense.filter({ workshop_id: workshop.id, fiscal_document_id: document.id }, "-created_date", 2);
      if (existing.length || document.financial_processed_at) throw error("Este documento já possui conta a pagar.", 409);
      const operationLock = await acquireOperationLock(db, workshop.id, "FISCAL_DOCUMENT", document.id, "FINANCIAL");
      const financialToken = crypto.randomUUID();
      await db.FiscalDocument.update(document.id, { financial_processing_token: financialToken });
      const lockedDocument = await db.FiscalDocument.get(document.id);
      if (lockedDocument.financial_processing_token !== financialToken) {
        await releaseOperationLock(db, operationLock);
        throw error("O financeiro deste documento já está sendo processado.", 409, "FINANCIAL_ALREADY_PROCESSING");
      }
      try {
        const duplicateAfterLock = await db.Expense.filter({ workshop_id: workshop.id, fiscal_document_id: document.id }, "-created_date", 2);
        if (duplicateAfterLock.length) throw error("Este documento já possui conta a pagar.", 409);
        const dueDate = clean(body.dueDate);
        const expense = await db.Expense.create({ workshop_id: workshop.id, fiscal_document_id: document.id, description: `${document.document_type} de entrada #${document.number}`, category: document.document_type === "NFE" ? "Compras" : "Serviços tomados", supplier_id: document.supplier_id, beneficiary: document.supplier_snapshot?.name || "", amount: Number(document.total_document || 0), date: document.entry_date || today(), ...(dueDate ? { due_date: dueDate } : {}), status: "pendente", type: "eventual" });
        const contenders = await db.Expense.filter({ workshop_id: workshop.id, fiscal_document_id: document.id }, "created_date", 10);
        if (contenders[0]?.id !== expense.id) {
          await db.Expense.delete(expense.id);
          throw error("A conta a pagar já está sendo criada.", 409, "FINANCIAL_ALREADY_PROCESSING");
        }
        await db.FiscalDocument.update(document.id, { financial_processed_at: now(), financial_processing_token: "", expense_id: expense.id, status: document.stock_processed_at || document.document_type === "NFSE" ? "PROCESSED" : "PARTIALLY_PROCESSED" });
        await db.FiscalDocumentEvent.create({ workshop_id: workshop.id, fiscal_document_id: document.id, event_type: "FINANCIAL_CREATED", status: "PROCESSED", created_by: user.email || user.id });
        await releaseOperationLock(db, operationLock);
        return Response.json({ success: true, expense });
      } catch (cause) {
        const currentDocument = await db.FiscalDocument.get(document.id).catch(() => null);
        if (currentDocument?.financial_processing_token === financialToken) await db.FiscalDocument.update(document.id, { financial_processing_token: "" }).catch(() => {});
        await releaseOperationLock(db, operationLock);
        throw cause;
      }
    }

    if (action === "xmlUrl") {
      const document = await ensureWorkshopRecord(db.FiscalDocument, clean(body.documentId), workshop.id, "Documento");
      if (!document.xml_file_uri) throw error("Este documento não possui XML privado.", 404);
      const result = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: document.xml_file_uri, expires_in: 300 });
      return Response.json({ signed_url: result.signed_url });
    }

    return Response.json({ error: "Ação de entrada fiscal inválida." }, { status: 400 });
  } catch (cause) {
    const failure = cause as { message?: string; status?: number; code?: string };
    console.error("Inbound fiscal operation failed", failure.code || "INBOUND_FISCAL_ERROR");
    return Response.json({ error: failure.message || "Não foi possível concluir a operação.", code: failure.code || "INBOUND_FISCAL_ERROR" }, { status: failure.status || 500 });
  }
}
