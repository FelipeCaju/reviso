import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Public demonstration: exposes only reads from the owner's chosen workshop.
// Never return passwords or issue a token for the owner's account.
const DEMO_OWNER_EMAIL = 'felipecaju172@gmail.com';
const ENTITIES = new Set([
  'Appointment', 'AppointmentHistory', 'Customer', 'Expense', 'FinancialTransaction',
  'Material', 'Payment', 'PurchaseOrder', 'PurchaseOrderItem', 'PurchaseRequest',
  'PurchaseRequestItem', 'Quote', 'QuoteItem', 'Service', 'Supplier', 'SupplierMaterial',
  'Vehicle', 'VehicleOwner', 'WorkOrder', 'WorkOrderItem', 'WorkshopSetting',
]);
const clean = (record) => {
  const { demo_password, demo_email, ...data } = record;
  return data;
};

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'context';
    if (action !== 'context' && action !== 'read') return Response.json({ error: 'Demonstração permite apenas leitura.' }, { status: 403 });
    if (action === 'read' && (!ENTITIES.has(body.entity) || !['get', 'list', 'filter'].includes(body.method))) {
      return Response.json({ error: 'Operação indisponível na demonstração.' }, { status: 403 });
    }
    const db = createClientFromRequest(req).asServiceRole.entities;
    const owners = await db.User.filter({ email: DEMO_OWNER_EMAIL }, '-created_date', 2);
    if (owners.length !== 1 || !owners[0].workshop_id) return Response.json({ error: 'Demonstração não configurada.' }, { status: 404 });
    const workshopId = owners[0].workshop_id;
    const workshop = await db.WorkshopSetting.get(workshopId);
    if (action === 'context') {
      return Response.json({
        user: { id: 'demo-visitor', role: 'user', full_name: 'Visitante (Demo)', workshop_id: workshopId },
        workshop: clean(workshop),
      });
    }
    if (body.method === 'get') {
      if (typeof body.id !== 'string' || !body.id) return Response.json({ error: 'ID inválido.' }, { status: 400 });
      if (body.entity === 'WorkshopSetting') {
        if (body.id !== workshopId) return Response.json({ error: 'Registro não encontrado.' }, { status: 404 });
        return Response.json({ result: clean(workshop) });
      }
      const record = await db[body.entity].get(body.id);
      if (record.workshop_id !== workshopId) return Response.json({ error: 'Registro não encontrado.' }, { status: 404 });
      return Response.json({ result: clean(record) });
    }
    // These screens use equality filters. Reject query operators and client tenant overrides.
    const query = body.method === 'filter' ? body.query || {} : {};
    if (typeof query !== 'object' || Array.isArray(query) || Object.entries(query).some(([key, value]) =>
      !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) || (value !== null && typeof value === 'object')
    )) return Response.json({ error: 'Filtro inválido.' }, { status: 400 });
    if (query.workshop_id && query.workshop_id !== workshopId) return Response.json({ error: 'Oficina indisponível.' }, { status: 403 });
    if (body.entity === 'WorkshopSetting') return Response.json({ result: [clean(workshop)] });
    const sort = typeof body.sort === 'string' && /^-?[a-zA-Z_][a-zA-Z0-9_]*$/.test(body.sort) ? body.sort : '-created_date';
    const limit = Math.min(2000, Math.max(1, Number(body.limit) || 500));
    const skip = Math.max(0, Number(body.skip) || 0);
    const records = await db[body.entity].filter({ ...query, workshop_id: workshopId }, sort, limit, skip);
    return Response.json({ result: records.filter((r) => r.workshop_id === workshopId).map(clean) });
  } catch (error) {
    const status = error.status || error.response?.status;
    return Response.json({ error: 'Não foi possível carregar a demonstração.' }, { status: status === 404 ? 404 : 500 });
  }
}
