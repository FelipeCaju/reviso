import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const labels: Record<string, string> = {
  quote: 'o orçamento',
  'work-order': 'a Ordem de Serviço',
  'purchase-quote': 'a cotação',
};

function normalizeBrazilianPhone(value: unknown) {
  let phone = String(value || '').replace(/\D/g, '');
  if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
  return /^55\d{10,11}$/.test(phone) ? phone : null;
}

function invalidPhone() {
  return Response.json({ error: 'Número de Telefone incorreto', code: 'PHONE_INVALID' }, { status: 400 });
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const phone = normalizeBrazilianPhone(body.phone);
    const documentType = String(body.documentType || '');
    const documentUrl = String(body.documentUrl || '');
    const fileName = String(body.fileName || '');
    if (!phone) return invalidPhone();
    if (!labels[documentType]) return Response.json({ error: 'Tipo de documento inválido.' }, { status: 400 });
    if (!/^https:\/\//.test(documentUrl) || !fileName.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: 'Documento inválido para envio.' }, { status: 400 });
    }
    if (!user.workshop_id) return Response.json({ error: 'Usuário sem acesso autorizado a uma oficina.' }, { status: 403 });

    const db = base44.asServiceRole.entities;
    const workshop = await db.WorkshopSetting.get(user.workshop_id);
    if (!workshop?.id) return Response.json({ error: 'Oficina não encontrada.' }, { status: 403 });

    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const instanceToken = Deno.env.get('ZAPI_INSTANCE_TOKEN');
    const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');
    const connectedNumber = Deno.env.get('ZAPI_WHATSAPP_NUMBER');
    if (!instanceId || !instanceToken || !clientToken || !connectedNumber) {
      return Response.json({ error: 'Integração do WhatsApp não configurada.' }, { status: 503 });
    }

    const recipientName = String(body.recipientName || '').trim();
    const reference = String(body.reference || '').trim();
    const greeting = recipientName ? `Olá, ${recipientName}!` : 'Olá!';
    const referenceText = reference ? ` #${reference}` : '';
    const caption = `${greeting}\n\nAqui é ${workshop.name || 'a oficina'}.\nSegue ${labels[documentType]}${referenceText} para sua análise.\n\nFicamos à disposição.`;
    const response = await fetch(`https://api.z-api.io/instances/${encodeURIComponent(instanceId)}/token/${encodeURIComponent(instanceToken)}/send-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
      body: JSON.stringify({ phone, document: documentUrl, fileName, caption }),
    });
    const payload = await response.json().catch(() => ({}));
    const messageId = payload.zaapId || payload.messageId || payload.id || null;
    const providerRejected = payload.success === false || payload.sent === false || payload.status === 'error' || !!payload.error || !!payload.errorMessage;
    if (!response.ok || providerRejected || !messageId) {
      const providerMessage = JSON.stringify(payload).toLowerCase();
      if (providerMessage.includes('invalid') && (providerMessage.includes('phone') || providerMessage.includes('number'))) return invalidPhone();
      console.error('Z-API did not confirm the document send', { status: response.status, providerMessage: payload.message || payload.error || null });
      return Response.json({ error: 'Não foi possível enviar o WhatsApp. Verifique a conexão da instância Z-API.' }, { status: 502 });
    }
    return Response.json({ success: true, messageId });
  } catch (error) {
    console.error('Z-API WhatsApp document error', error);
    return Response.json({ error: 'Não foi possível enviar o WhatsApp.' }, { status: 500 });
  }
}
