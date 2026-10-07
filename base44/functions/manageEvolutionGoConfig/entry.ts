import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const PLATFORM_OWNER_EMAIL = 'felipecaju172@gmail.com';

function normalizeUrl(value: unknown) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function maskKey(last4: string) {
  return last4 ? `••••${last4}` : 'Valor salvo';
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (String(user.email || '').trim().toLowerCase() !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'Acesso permitido apenas ao administrador da plataforma.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const workshopId = String(body.workshopId || '').trim();
    if (!workshopId) return Response.json({ error: 'Oficina não informada.' }, { status: 400 });

    const db = base44.asServiceRole.entities;
    const workshop = await db.WorkshopSetting.get(workshopId);
    if (!workshop?.id) return Response.json({ error: 'Oficina não encontrada.' }, { status: 404 });

    const configs = await db.EvolutionGoConfig.filter({ workshop_id: workshopId }, '-created_date', 2);
    const config = configs[0];

    if (body.action === 'get') {
      return Response.json({
        configured: !!config,
        baseUrl: config?.base_url || '',
        instanceName: config?.instance_name || '',
        apiKeySaved: !!config?.api_key,
        apiKeyMask: config?.api_key ? maskKey(config.api_key_last4 || String(config.api_key).slice(-4)) : '',
      });
    }

    if (body.action !== 'save') return Response.json({ error: 'Ação inválida.' }, { status: 400 });

    const baseUrl = normalizeUrl(body.baseUrl);
    const instanceName = String(body.instanceName || '').trim();
    const newApiKey = String(body.apiKey || '').trim();
    if (!baseUrl || !instanceName) {
      return Response.json({ error: 'Informe uma URL válida e o nome da instância.' }, { status: 400 });
    }
    if (!config && !newApiKey) {
      return Response.json({ error: 'Informe a API key ou token da instância.' }, { status: 400 });
    }

    const values: Record<string, string> = { workshop_id: workshopId, base_url: baseUrl, instance_name: instanceName };
    if (newApiKey) {
      values.api_key = newApiKey;
      values.api_key_last4 = newApiKey.slice(-4);
    }

    if (config) await db.EvolutionGoConfig.update(config.id, values);
    else await db.EvolutionGoConfig.create(values);

    return Response.json({ success: true, apiKeyMask: maskKey(values.api_key_last4 || config?.api_key_last4 || '') });
  } catch (error) {
    console.error('Evolution GO configuration error', error);
    return Response.json({ error: 'Não foi possível salvar a configuração do Evolution GO.' }, { status: 500 });
  }
}
