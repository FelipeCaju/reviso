import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const GENERIC_ERROR = 'Não foi possível concluir a operação do WhatsApp. Tente novamente.';

function normalizeUrl(value: unknown) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function instanceNameFor(workshopId: string) {
  const suffix = workshopId.replace(/[^a-zA-Z0-9]/g, '').slice(-12).toLowerCase();
  return `oficina-${suffix || crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function hasValidBrazilianWhatsApp(value: unknown) {
  let phone = String(value || '').replace(/\D/g, '');
  if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
  return /^55\d{10,11}$/.test(phone);
}

function responseError(status: number, error: string) {
  return Response.json({ error }, { status });
}

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

function qrDataUri(value: unknown) {
  if (typeof value !== 'string') return null;
  const qr = value.trim();
  if (qr.startsWith('data:image/')) return qr;
  // Evolution GO versions may return the PNG base64 without the data URI prefix.
  if (/^iVBORw0KGgo/.test(qr)) return `data:image/png;base64,${qr}`;
  if (/^\/9j\//.test(qr)) return `data:image/jpeg;base64,${qr}`;
  if (/^PHN2Zy/.test(qr)) return `data:image/svg+xml;base64,${qr}`;
  return null;
}

function findQrDataUri(value: unknown, depth = 0): string | null {
  if (depth > 3 || !value) return null;
  const direct = qrDataUri(value);
  if (direct) return direct;
  if (typeof value !== 'object') return null;
  for (const nested of Object.values(value as Record<string, unknown>)) {
    const found = findQrDataUri(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

function providerState(payload: any) {
  const state = payload?.data?.status || payload?.data?.state || payload?.status || payload?.state || '';
  return typeof state === 'string' ? state.slice(0, 80) : '';
}

async function getQrCode(baseUrl: string, apiKey: string) {
  const response = await fetch(`${baseUrl}/instance/qr`, {
    headers: { apikey: apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await readJson(response);
  const qrCode = findQrDataUri(payload);
  return {
    ok: response.ok && !!qrCode,
    qrCode,
    status: response.status,
    responseKeys: Object.keys(payload || {}).slice(0, 10),
    dataKeys: payload?.data && typeof payload.data === 'object' ? Object.keys(payload.data).slice(0, 10) : [],
  };
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return responseError(401, 'Unauthorized');
    if (user.role !== 'admin' || !user.workshop_id) {
      return responseError(403, 'Apenas o administrador da oficina pode configurar o WhatsApp.');
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'status');
    if (!['status', 'create', 'connect'].includes(action)) {
      return responseError(400, 'Ação inválida.');
    }

    const db = base44.asServiceRole.entities;
    // The workshop id always comes from the authenticated user, never from the request body.
    const workshop = await db.WorkshopSetting.get(user.workshop_id);
    if (!workshop?.id || workshop.is_active === false) {
      return responseError(403, 'Oficina não autorizada.');
    }
    const requestedWhatsApp = String(body.whatsapp || '').trim();
    const whatsAppToUse = requestedWhatsApp || workshop.whatsapp;
    if (action === 'create' || action === 'connect') {
      if (!hasValidBrazilianWhatsApp(whatsAppToUse)) {
        return responseError(422, 'Informe um número de WhatsApp brasileiro válido para a oficina antes de conectar.');
      }
      // This endpoint can update only the caller's own workshop and only this validated field.
      if (requestedWhatsApp && requestedWhatsApp !== workshop.whatsapp) {
        await db.WorkshopSetting.update(workshop.id, { whatsapp: requestedWhatsApp });
        workshop.whatsapp = requestedWhatsApp;
      }
    }

    const configs = await db.EvolutionGoConfig.filter({ workshop_id: workshop.id }, '-created_date', 2);
    const config = configs[0];
    const defaultBaseUrl = normalizeUrl(Deno.env.get('EVOLUTION_GO_BASE_URL'));
    const baseUrl = normalizeUrl(config?.base_url) || defaultBaseUrl;

    if (action === 'create') {
      if (config?.api_key || config?.instance_name) {
        return responseError(409, 'Esta oficina já possui uma instância Evolution GO configurada.');
      }
      const globalApiKey = String(Deno.env.get('EVOLUTION_GO_GLOBAL_API_KEY') || '').trim();
      if (!baseUrl || !globalApiKey) {
        return responseError(503, 'A criação de instâncias ainda não foi habilitada pelo administrador da plataforma.');
      }

      const instanceName = instanceNameFor(workshop.id);
      const instanceToken = crypto.randomUUID();
      const createResponse = await fetch(`${baseUrl}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: globalApiKey },
        body: JSON.stringify({ name: instanceName, token: instanceToken }),
        signal: AbortSignal.timeout(15_000),
      });
      const createPayload = await readJson(createResponse);
      const providerRejected = createPayload?.success === false || createPayload?.status === 'error' || !!createPayload?.error;
      if (!createResponse.ok || providerRejected) {
        // Do not include provider output: some providers echo request details in errors.
        console.warn('Evolution GO instance creation rejected', { status: createResponse.status, providerRejected });
        return responseError(502, 'Não foi possível criar a instância no Evolution GO. Verifique a chave global e tente novamente.');
      }

      await db.EvolutionGoConfig.create({
        workshop_id: workshop.id,
        base_url: baseUrl,
        instance_name: instanceName,
        api_key: instanceToken,
        api_key_last4: instanceToken.slice(-4),
      });
    }

    const currentConfig = action === 'create'
      ? (await db.EvolutionGoConfig.filter({ workshop_id: workshop.id }, '-created_date', 2))[0]
      : config;
    if (!currentConfig?.base_url || !currentConfig?.api_key || !currentConfig?.instance_name) {
      return Response.json({ configured: false, instanceName: '', connectionStatus: '' });
    }

    const currentBaseUrl = normalizeUrl(currentConfig.base_url);
    if (!currentBaseUrl) return responseError(503, 'A URL do Evolution GO desta oficina é inválida.');

    if (action === 'status') {
      const statusResponse = await fetch(`${currentBaseUrl}/instance/status`, {
        headers: { apikey: currentConfig.api_key },
        signal: AbortSignal.timeout(10_000),
      });
      const payload = await readJson(statusResponse);
      return Response.json({
        configured: true,
        instanceName: currentConfig.instance_name,
        connectionStatus: statusResponse.ok ? providerState(payload) : 'indisponível',
      });
    }

    const connectResponse = await fetch(`${currentBaseUrl}/instance/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: currentConfig.api_key },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(15_000),
    });
    if (!connectResponse.ok) {
      console.warn('Evolution GO instance connection rejected', { status: connectResponse.status });
      return responseError(502, 'Não foi possível iniciar a conexão da instância.');
    }
    const qr = await getQrCode(currentBaseUrl, currentConfig.api_key);
    if (!qr.ok) {
      console.warn('Evolution GO QR code unavailable', { status: qr.status, responseKeys: qr.responseKeys, dataKeys: qr.dataKeys });
      return responseError(502, 'Não foi possível obter o QR Code da instância. Tente novamente.');
    }
    return Response.json({ configured: true, instanceName: currentConfig.instance_name, qrCode: qr.qrCode });
  } catch (error) {
    console.error('Evolution GO self-service error', error instanceof Error ? error.name : 'unknown');
    return responseError(500, GENERIC_ERROR);
  }
}
