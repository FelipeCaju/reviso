const clean = (value) => String(value ?? "").trim();

function xmlError(message, status = 422, code = "INVALID_XML") {
  return Object.assign(new Error(message), { status, code });
}

function decodeXml(value) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function normalizeXml(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw xmlError("O XML contém declarações não permitidas.", 422, "UNSAFE_XML");
  return xml.replace(/(<\/?)[A-Za-z_][\w.-]*:/g, "$1");
}

function block(xml, tag) {
  return xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "";
}

function value(xml, ...tags) {
  for (const tag of tags) {
    const found = block(xml, tag);
    if (found) return decodeXml(found.replace(/<[^>]+>/g, "").trim());
  }
  return "";
}

function numberValue(xml, ...tags) {
  const parsed = Number(value(xml, ...tags).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseInboundXml(rawXml) {
  if (!clean(rawXml) || rawXml.length > 3_000_000) throw xmlError("O XML está vazio ou excede 3 MB.", 413, "XML_SIZE_INVALID");
  const xml = normalizeXml(rawXml);
  const isNfe = /<NFe(?:\s|>)/i.test(xml) || /<infNFe(?:\s|>)/i.test(xml);
  if (isNfe) {
    const infoTag = xml.match(/<infNFe\b([^>]*)>/i)?.[1] || "";
    const accessKey = (infoTag.match(/\bId=["']NFe(\d{44})["']/i)?.[1] || value(xml, "chNFe")).replace(/\D/g, "");
    const ide = block(xml, "ide");
    const issuer = block(xml, "emit");
    const recipient = block(xml, "dest");
    const total = block(xml, "ICMSTot") || block(xml, "total");
    const items = [...xml.matchAll(/<det(?:\s[^>]*)?>([\s\S]*?)<\/det>/gi)].map((match, index) => {
      const product = block(match[1], "prod") || match[1];
      const quantity = numberValue(product, "qCom", "qTrib") || 1;
      const unitPrice = numberValue(product, "vUnCom", "vUnTrib");
      return {
        source_item_id: String(index + 1), item_type: "PRODUCT", supplier_product_code: value(product, "cProd"),
        gtin: value(product, "cEAN", "cEANTrib"), description: value(product, "xProd") || `Item ${index + 1}`,
        quantity, unit: value(product, "uCom", "uTrib") || "un", unit_price: unitPrice,
        total: numberValue(product, "vProd") || quantity * unitPrice,
        ncm: value(product, "NCM"), cest: value(product, "CEST"), track_stock: true,
      };
    });
    if (!value(issuer, "CNPJ", "CPF") || !value(recipient, "CNPJ", "CPF") || !value(ide, "nNF") || !items.length) {
      throw xmlError("A NF-e não possui emitente, destinatário, número ou itens obrigatórios.", 422, "INCOMPLETE_NFE_XML");
    }
    return {
      document_type: "NFE", access_key: accessKey, number: value(ide, "nNF"), series: value(ide, "serie"),
      issue_date: value(ide, "dhEmi", "dEmi"), total_document: numberValue(total, "vNF"),
      supplier: { cpf_cnpj: value(issuer, "CNPJ", "CPF"), name: value(issuer, "xNome"), fantasy_name: value(issuer, "xFant"), inscricao_estadual: value(issuer, "IE") },
      recipient_document: value(recipient, "CNPJ", "CPF"), items,
    };
  }

  if (/<(?:CompNfse|Nfse|InfNfse)(?:\s|>)/i.test(xml)) {
    const info = block(xml, "InfNfse") || block(xml, "Nfse") || xml;
    const issuer = block(info, "PrestadorServico") || block(info, "Prestador") || block(info, "PrestadorNfse");
    const recipient = block(info, "TomadorServico") || block(info, "Tomador");
    const service = block(info, "Servico") || info;
    const providerDoc = value(block(issuer, "CpfCnpj") || issuer, "Cnpj", "Cpf", "CNPJ", "CPF");
    const recipientDoc = value(block(recipient, "CpfCnpj") || recipient, "Cnpj", "Cpf", "CNPJ", "CPF");
    const total = numberValue(block(service, "Valores") || service, "ValorServicos", "ValorLiquidoNfse");
    const number = value(info, "Numero", "NumeroNfse");
    if (!providerDoc || !recipientDoc || !number) throw xmlError("A NFS-e não possui prestador, tomador ou número obrigatórios.", 422, "INCOMPLETE_NFSE_XML");
    return {
      document_type: "NFSE", access_key: value(info, "ChaveNFe", "CodigoVerificacao"), number, series: value(info, "Serie"),
      issue_date: value(info, "DataEmissao", "Competencia"), total_document: total,
      supplier: { cpf_cnpj: providerDoc, name: value(issuer, "RazaoSocial", "NomeFantasia"), fantasy_name: value(issuer, "NomeFantasia"), inscricao_municipal: value(issuer, "InscricaoMunicipal") },
      recipient_document: recipientDoc,
      items: [{ source_item_id: "1", item_type: "SERVICE", description: value(service, "Discriminacao") || "Serviço tomado", quantity: 1, unit: "sv", unit_price: total, total, track_stock: false }],
    };
  }
  throw xmlError("Formato de XML não reconhecido. Envie uma NF-e ou NFS-e válida.", 422, "UNSUPPORTED_XML");
}
