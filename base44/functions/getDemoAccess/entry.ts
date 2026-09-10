import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    // Public endpoint — finds the workshop marked as demo and returns its shared credentials.
    const workshops = await base44.asServiceRole.entities.WorkshopSetting.filter({ is_demo: true }, "-updated_date", 10);
    if (!workshops.length) {
      return Response.json({ error: "Nenhuma oficina demo configurada" }, { status: 404 });
    }
    const workshop = workshops[0];
    if (!workshop.demo_email || !workshop.demo_password) {
      return Response.json({ error: "Credenciais demo não configuradas" }, { status: 404 });
    }
    return Response.json({ email: workshop.demo_email, password: workshop.demo_password });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}