import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { createFiscalProvider } from "../../shared/fiscalProvider.ts";

const cleanText = (value: unknown) => String(value || "").trim();
const today = () => new Date().toISOString().slice(0, 10);
const validCpfCnpjFormat = (value: unknown) => {
  const digits = String(value || "").replace(/\D/g, "");
  return (digits.length === 11 || digits.length === 14) && !/^(\d)\1+$/.test(digits);
};

function deny(message = "Operação fiscal não autorizada.") {
  return Response.json({ error: message }, { status: 403 });
}

function safeError(error: unknown) {
  const candidate = error as { code?: string; message?: string; status?: number };
  return {
    code: candidate?.code || "FISCAL_OPERATION_ERROR",
    message: candidate?.message || "Não foi possível concluir a operação fiscal.",
    status: candidate?.status || 500,
  };
}

async function one<T>(entity: { filter: Function }, query: Record<string, unknown>): Promise<T | null> {
  const rows = await entity.filter(query, "-updated_date", 2);
  if (rows.length > 1) throw Object.assign(new Error("Configuração fiscal duplicada."), { code: "DUPLICATE_FISCAL_CONFIGURATION", status: 409 });
  return rows[0] || null;
}

function resolveServiceFiscal(profile: Record<string, unknown> | null, setting: Record<string, unknown>) {
  return {
    codigo_servico_municipal: profile?.codigo_servico_municipal || setting.codigo_servico_municipal_padrao || "",
    item_lista_servico: profile?.item_lista_servico || setting.item_lista_servico_padrao || "",
    nbs: profile?.nbs || setting.nbs_padrao || "",
    aliquota_iss: profile?.aliquota_iss ?? setting.aliquota_iss_padrao ?? null,
    iss_retido: profile?.iss_retido ?? setting.iss_retido_padrao ?? false,
    municipio_incidencia_codigo_ibge: profile?.municipio_incidencia_codigo_ibge || setting.municipio_codigo_ibge || "",
    natureza_operacao: profile?.natureza_operacao || setting.natureza_operacao_padrao || "",
    exigibilidade: profile?.exigibilidade || setting.exigibilidade_padrao || "",
    configuracoes_retencao: profile?.configuracoes_retencao || {},
    observacao_fiscal: profile?.observacao_fiscal || "",
  };
}

async function buildPreview(db: any, workshop: any, setting: any, workOrderId: string) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!workshop.fiscal_module_enabled) errors.push("O módulo fiscal não está habilitado para esta oficina.");
  if (!setting) errors.push("As configurações fiscais da oficina ainda não foram cadastradas.");
  if (!cleanText(workshop.cnpj)) errors.push("O CNPJ da oficina não foi informado.");
  else if (String(workshop.cnpj).replace(/\D/g, "").length !== 14) errors.push("O CNPJ da oficina possui formato inválido.");
  if (!cleanText(workshop.cep) || !cleanText(workshop.logradouro) || !cleanText(workshop.numero) || !cleanText(workshop.cidade) || !cleanText(workshop.uf) || !cleanText(workshop.codigo_ibge)) {
    errors.push("O endereço fiscal estruturado da oficina está incompleto.");
  }
  if (setting && !cleanText(setting.inscricao_municipal)) errors.push("A inscrição municipal não foi informada.");
  if (setting && !cleanText(setting.regime_tributario)) errors.push("O regime tributário não foi informado.");
  if (setting && (!cleanText(setting.provedor_fiscal) || setting.provedor_fiscal === "nao_configurado")) errors.push("O provedor fiscal ainda não foi configurado.");

  const workOrder = await db.WorkOrder.get(workOrderId);
  if (!workOrder?.id || workOrder.workshop_id !== workshop.id) throw Object.assign(new Error("Ordem de Serviço não encontrada."), { status: 404 });
  if (workOrder.status !== "finalizada") errors.push("A Ordem de Serviço precisa estar finalizada antes da emissão.");
  if (Number(workOrder.discount || 0) > 0) errors.push("O desconto geral da OS precisa ser distribuído entre os itens antes da emissão fiscal.");
  if (Number(workOrder.socorro || 0) > 0) warnings.push("O valor de socorro/deslocamento não foi incluído na NFS-e; classifique-o como serviço antes da emissão, se aplicável.");
  if (!workOrder.customer_id) errors.push("A Ordem de Serviço não possui cliente vinculado.");
  const customer = workOrder.customer_id ? await db.Customer.get(workOrder.customer_id) : null;
  if (customer && customer.workshop_id !== workshop.id) throw Object.assign(new Error("Cliente não encontrado."), { status: 404 });
  if (!cleanText(customer?.cpf_cnpj)) errors.push("O cliente não possui CPF/CNPJ.");
  else if (customer?.person_type !== "EXTERIOR" && !validCpfCnpjFormat(customer.cpf_cnpj)) errors.push("O CPF/CNPJ do cliente possui formato inválido.");
  if (!cleanText(customer?.email)) warnings.push("O cliente não possui e-mail.");
  if (!cleanText(customer?.cep) || !cleanText(customer?.address) || !cleanText(customer?.number) || !cleanText(customer?.city) || !cleanText(customer?.state)) {
    warnings.push("O endereço do cliente está incompleto.");
  }

  const sourceItems = await db.WorkOrderItem.filter({ work_order_id: workOrderId, workshop_id: workshop.id }, "created_date", 500);
  const serviceItems = sourceItems.filter((item: any) => item.type === "servico" && item.fiscal_treatment !== "excluir" && item.approval_status !== "recusado");
  const excludedItems = sourceItems.filter((item: any) => !serviceItems.some((service: any) => service.id === item.id));
  if (Number(workOrder.socorro || 0) > 0) excludedItems.push({ id: `socorro-${workOrder.id}`, type: "outro", description: "Socorro / deslocamento", total: workOrder.socorro });
  if (!serviceItems.length) errors.push("A Ordem de Serviço não possui serviços aptos para a NFS-e.");

  const profileRows = await db.ServiceFiscalProfile.filter({ workshop_id: workshop.id }, "-updated_date", 1000);
  const profiles = new Map(profileRows.filter((profile: any) => profile.active !== false).map((profile: any) => [profile.service_id, profile]));
  const items = serviceItems.map((item: any) => {
    const fiscal = resolveServiceFiscal(profiles.get(item.service_id) || null, setting || {});
    if (!cleanText(fiscal.codigo_servico_municipal) || !cleanText(fiscal.item_lista_servico)) {
      errors.push(`Serviço "${item.description}" não possui código fiscal completo.`);
    }
    return {
      source_item_id: item.id,
      item_type: "SERVICE",
      description: item.description,
      quantity: item.quantity || 1,
      unit: item.unit || "un",
      unit_price: item.unit_price || 0,
      discount: item.discount || 0,
      total: item.total || 0,
      service_fiscal_snapshot: fiscal,
      tax_snapshot: { aliquota_iss: fiscal.aliquota_iss, iss_retido: fiscal.iss_retido },
    };
  });

  const totalServices = items.reduce((sum: number, item: any) => sum + Number(item.total || 0), 0);
  return {
    ready: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    workOrder,
    customer,
    items,
    excludedItems: excludedItems.map((item: any) => ({ id: item.id, type: item.type, description: item.description, total: item.total || 0 })),
    totals: { services: totalServices, products: excludedItems.filter((item: any) => item.type === "material").reduce((sum: number, item: any) => sum + Number(item.total || 0), 0) },
  };
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!user.workshop_id || user.role !== "admin") return deny();
    const body = await req.json().catch(() => ({}));
    const action = cleanText(body.action);
    const db = base44.asServiceRole.entities;
    const workshop = await db.WorkshopSetting.get(user.workshop_id);
    if (!workshop?.id || workshop.id !== user.workshop_id) return deny();
    const setting = await one<any>(db.FiscalSetting, { workshop_id: workshop.id });

    if (action === "context") {
      const [serviceProfiles, materialProfiles, credentials, documents] = await Promise.all([
        db.ServiceFiscalProfile.filter({ workshop_id: workshop.id }, "-updated_date", 1000),
        db.MaterialFiscalProfile.filter({ workshop_id: workshop.id }, "-updated_date", 1000),
        db.FiscalCredential.filter({ workshop_id: workshop.id }, "-updated_date", 20),
        db.FiscalDocument.filter({ workshop_id: workshop.id }, "-created_date", 500),
      ]);
      const status = !workshop.fiscal_module_enabled ? "DISABLED" : setting && setting.inscricao_municipal && setting.regime_tributario && setting.provedor_fiscal !== "nao_configurado" && workshop.cnpj && workshop.codigo_ibge ? "READY" : "INCOMPLETE";
      return Response.json({ workshop, setting, serviceProfiles, materialProfiles, credentials, documents, configurationStatus: status });
    }

    if (!workshop.fiscal_module_enabled && ["saveSetting", "saveServiceProfile", "saveMaterialProfile", "preview", "validate", "issue", "replace"].includes(action)) {
      return Response.json({ error: "O módulo fiscal não está habilitado para esta oficina.", code: "FISCAL_MODULE_DISABLED" }, { status: 403 });
    }

    if (action === "saveSetting") {
      const allowed = ["regime_tributario", "simples_nacional", "mei", "inscricao_municipal", "inscricao_estadual", "municipio_codigo_ibge", "municipio_nome", "uf", "ambiente_fiscal", "provedor_fiscal", "modo_emissao", "codigo_servico_municipal_padrao", "item_lista_servico_padrao", "nbs_padrao", "aliquota_iss_padrao", "iss_retido_padrao", "natureza_operacao_padrao", "exigibilidade_padrao", "contador_nome", "contador_escritorio", "contador_telefone", "contador_email"];
      const data = Object.fromEntries(allowed.filter((key) => body.data?.[key] !== undefined).map((key) => [key, body.data[key]]));
      const result = setting ? await db.FiscalSetting.update(setting.id, data) : await db.FiscalSetting.create({ ...data, workshop_id: workshop.id });
      return Response.json({ success: true, setting: result });
    }

    if (action === "saveServiceProfile" || action === "saveMaterialProfile") {
      const isService = action === "saveServiceProfile";
      const entity = isService ? db.ServiceFiscalProfile : db.MaterialFiscalProfile;
      const idKey = isService ? "service_id" : "material_id";
      const sourceId = cleanText(body.data?.[idKey]);
      if (!sourceId) return Response.json({ error: "Cadastro de origem não informado." }, { status: 400 });
      const source = await db[isService ? "Service" : "Material"].get(sourceId);
      if (source.workshop_id !== workshop.id) return deny();
      const existing = await one<any>(entity, { workshop_id: workshop.id, [idKey]: sourceId });
      const allowed = isService
        ? [idKey, "codigo_servico_municipal", "item_lista_servico", "nbs", "aliquota_iss", "iss_retido", "municipio_incidencia_codigo_ibge", "natureza_operacao", "exigibilidade", "configuracoes_retencao", "observacao_fiscal", "active"]
        : [idKey, "ncm", "cest", "origem_mercadoria", "observacao_fiscal", "active"];
      const data = Object.fromEntries(allowed.filter((key) => body.data?.[key] !== undefined).map((key) => [key, body.data[key]]));
      const result = existing ? await entity.update(existing.id, data) : await entity.create({ ...data, workshop_id: workshop.id });
      return Response.json({ success: true, profile: result });
    }

    if (action === "preview" || action === "validate") {
      const preview = await buildPreview(db, workshop, setting, cleanText(body.workOrderId));
      return Response.json(preview);
    }

    if (action === "issue") {
      const preview = await buildPreview(db, workshop, setting, cleanText(body.workOrderId));
      if (!preview.ready) return Response.json({ error: "Documento fiscal inválido.", ...preview }, { status: 422 });
      const existing = await db.FiscalDocument.filter({ workshop_id: workshop.id, source_type: "WORK_ORDER", source_id: preview.workOrder.id }, "-created_date", 20);
      if (existing.some((doc: any) => !["REJECTED", "ERROR"].includes(doc.status))) {
        return Response.json({ error: "Esta Ordem de Serviço já possui documento fiscal ativo." }, { status: 409 });
      }
      const provider = createFiscalProvider(setting.provedor_fiscal);
      const credentials = await db.FiscalCredential.filter({ workshop_id: workshop.id, provider: setting.provedor_fiscal, status: "ativa" }, "-updated_date", 2);
      if (credentials.length !== 1) return Response.json({ error: "A credencial fiscal segura não está configurada ou está duplicada.", code: "FISCAL_CREDENTIAL_NOT_READY" }, { status: 409 });
      const providerContext = { document: { source_id: preview.workOrder.id, competence_date: body.competenceDate || today() }, items: preview.items, credentialReference: credentials[0].credential_reference };
      const providerValidation = await provider.validate(providerContext);
      if (providerValidation.errors.length) return Response.json({ error: providerValidation.errors[0], code: "FISCAL_PROVIDER_NOT_READY" }, { status: 409 });

      const document = await db.FiscalDocument.create({
        workshop_id: workshop.id, document_type: "NFSE", source_type: "WORK_ORDER", source_id: preview.workOrder.id,
        customer_id: preview.customer?.id || "", status: "READY", competence_date: body.competenceDate || today(),
        provider: setting.provedor_fiscal, environment: setting.ambiente_fiscal || "homologacao",
        total_services: preview.totals.services, total_products: preview.totals.products, discount: 0, deductions: 0,
        total_document: preview.totals.services,
        issuer_snapshot: { name: workshop.name, razao_social: workshop.razao_social, cnpj: workshop.cnpj, phone: workshop.phone, email: workshop.email, cep: workshop.cep, logradouro: workshop.logradouro, numero: workshop.numero, complemento: workshop.complemento, bairro: workshop.bairro, cidade: workshop.cidade, uf: workshop.uf, codigo_ibge: workshop.codigo_ibge, pais: workshop.pais, codigo_pais: workshop.codigo_pais },
        customer_snapshot: preview.customer,
        fiscal_setting_snapshot: setting,
      });
      await db.FiscalDocumentItem.bulkCreate(preview.items.map((item: any) => ({ ...item, workshop_id: workshop.id, fiscal_document_id: document.id, source_item_type: "WORK_ORDER_ITEM" })));
      await db.FiscalDocumentEvent.create({ workshop_id: workshop.id, fiscal_document_id: document.id, event_type: "CREATED", status: "READY", provider: setting.provedor_fiscal, created_by: user.email || user.id });
      try {
        await db.FiscalDocument.update(document.id, { status: "SENT" });
        await db.FiscalDocumentEvent.create({ workshop_id: workshop.id, fiscal_document_id: document.id, event_type: "SENT", status: "SENT", provider: setting.provedor_fiscal, created_by: user.email || user.id });
        const result: any = await provider.issue({ ...providerContext, document });
        const finalStatus = result.status || "PROCESSING";
        const updated = await db.FiscalDocument.update(document.id, {
          status: finalStatus, issue_date: result.issue_date || (finalStatus === "AUTHORIZED" ? new Date().toISOString() : undefined),
          number: result.number || "", series: result.series || "", external_id: result.external_id || "",
          verification_code: result.verification_code || "", protocol: result.protocol || "",
          xml_url: result.xml_url || "", pdf_url: result.pdf_url || "", public_url: result.public_url || "",
        });
        await db.FiscalDocumentEvent.create({ workshop_id: workshop.id, fiscal_document_id: document.id, event_type: finalStatus === "AUTHORIZED" ? "AUTHORIZED" : "PROCESSING", status: finalStatus, provider: setting.provedor_fiscal, request_id: result.request_id || "", protocol: result.protocol || "", created_by: user.email || user.id });
        return Response.json({ success: true, document: updated });
      } catch (providerError) {
        const failure = safeError(providerError);
        await db.FiscalDocument.update(document.id, { status: "ERROR", last_error_code: failure.code, last_error_message: failure.message });
        await db.FiscalDocumentEvent.create({ workshop_id: workshop.id, fiscal_document_id: document.id, event_type: "ERROR", status: "ERROR", provider: setting.provedor_fiscal, error_code: failure.code, error_message: failure.message, created_by: user.email || user.id });
        throw providerError;
      }
    }

    if (["query", "cancel", "replace", "downloadXml", "downloadPdf"].includes(action)) {
      const document = await db.FiscalDocument.get(cleanText(body.documentId));
      if (!document?.id || document.workshop_id !== workshop.id) return deny();
      const provider = createFiscalProvider(document.provider);
      const method = action as "query" | "cancel" | "replace" | "downloadXml" | "downloadPdf";
      const result = method === "cancel"
        ? await provider.cancel(document.external_id, cleanText(body.reason))
        : method === "replace"
          ? await provider.replace(document.external_id, body.context || { document, items: [] })
          : method === "query"
            ? await provider.query(document.external_id)
            : method === "downloadXml"
              ? await provider.downloadXml(document.external_id)
              : await provider.downloadPdf(document.external_id);
      await db.FiscalDocumentEvent.create({ workshop_id: workshop.id, fiscal_document_id: document.id, event_type: action === "cancel" ? "CANCELED" : action === "replace" ? "REPLACED" : "QUERY", status: result?.status || action.toUpperCase(), provider: document.provider, protocol: result?.protocol || "", created_by: user.email || user.id });
      if (action === "cancel") await db.FiscalDocument.update(document.id, { status: "CANCELED", protocol: result?.protocol || document.protocol });
      if (action === "replace") await db.FiscalDocument.update(document.id, { status: "REPLACED", protocol: result?.protocol || document.protocol });
      return Response.json({ success: true, result });
    }

    return Response.json({ error: "Ação fiscal inválida." }, { status: 400 });
  } catch (error) {
    const safe = safeError(error);
    console.error("Fiscal operation failed", safe.code);
    return Response.json({ error: safe.message, code: safe.code }, { status: safe.status });
  }
}
