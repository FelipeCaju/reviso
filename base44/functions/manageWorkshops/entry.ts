import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // SELF-REGISTER — any authenticated user can register their own workshop
    if (body.action === 'selfRegister') {
      const { name, razao_social, cnpj, phone, whatsapp, email, address } = body;
      const missing = ['name', 'phone', 'email', 'address'].filter((f) => !body[f] || !String(body[f]).trim());
      if (missing.length > 0) return Response.json({ error: `Campos obrigatórios faltando: ${missing.join(', ')}` }, { status: 400 });

      const workshop = await base44.asServiceRole.entities.WorkshopSetting.create({
        name,
        razao_social: razao_social || '',
        cnpj: cnpj || '',
        phone: phone || '',
        whatsapp: whatsapp || '',
        email: email || '',
        address: address || '',
        plan: 'free',
        plan_value: 0,
        trial_started_at: new Date().toISOString(),
        default_capacity: 8,
        capacity_monday: 8, capacity_tuesday: 8, capacity_wednesday: 8,
        capacity_thursday: 8, capacity_friday: 6, capacity_saturday: 3, capacity_sunday: 0,
      });

      await base44.asServiceRole.entities.User.update(user.id, {
        workshop_id: workshop.id,
        role: 'admin',
      });

      return Response.json({ success: true, workshopId: workshop.id });
    }

    // All other actions require admin
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // LIST — return all workshops with their admin owners + orphan users (registered but no workshop)
    if (body.action === 'list') {
      const workshops = await base44.asServiceRole.entities.WorkshopSetting.list('-created_date', 500);
      const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
      const admins = users.filter((u) => u.role === 'admin');

      const result = workshops.map((w) => {
        const owners = admins.filter((u) => u.workshop_id === w.id);
        return {
          id: w.id,
          name: w.name,
          razao_social: w.razao_social,
          cnpj: w.cnpj,
          phone: w.phone,
          whatsapp: w.whatsapp,
          email: w.email,
          address: w.address,
          plan: w.plan || 'free',
          plan_value: w.plan_value || 0,
          is_demo: w.is_demo,
          trial_started_at: w.trial_started_at,
          created_date: w.created_date,
          owners: owners.map((o) => ({ id: o.id, full_name: o.full_name, email: o.email }))
        };
      });

      // Include users who registered but have no workshop (exclude platform owner = admin without workshop_id)
      const orphanUsers = users.filter((u) => !u.workshop_id && u.role !== 'admin');
      for (const user of orphanUsers) {
        result.push({
          id: `orphan_${user.id}`,
          name: '',
          razao_social: '',
          cnpj: '',
          phone: '',
          whatsapp: '',
          email: user.email || '',
          address: '',
          plan: 'free',
          plan_value: 0,
          is_demo: false,
          trial_started_at: null,
          created_date: user.created_date,
          owners: [{ id: user.id, full_name: user.full_name, email: user.email }],
          isOrphan: true,
          userId: user.id,
        });
      }

      return Response.json({ workshops: result });
    }

    // PROVISION — create a workshop for an orphan user and set them as admin
    if (body.action === 'provision') {
      const { userId, name, razao_social, cnpj, phone, whatsapp, email, address, plan, plan_value } = body;
      const missing = ['name', 'phone', 'email', 'address'].filter((f) => !body[f] || !String(body[f]).trim());
      if (!userId || missing.length > 0) return Response.json({ error: `Campos obrigatórios faltando: ${missing.join(', ')}` }, { status: 400 });

      const workshop = await base44.asServiceRole.entities.WorkshopSetting.create({
        name,
        razao_social: razao_social || '',
        cnpj: cnpj || '',
        phone: phone || '',
        whatsapp: whatsapp || '',
        email: email || '',
        address: address || '',
        plan: plan || 'free',
        plan_value: plan_value || 0,
        trial_started_at: new Date().toISOString(),
        default_capacity: 8,
        capacity_monday: 8, capacity_tuesday: 8, capacity_wednesday: 8,
        capacity_thursday: 8, capacity_friday: 6, capacity_saturday: 3, capacity_sunday: 0,
      });

      await base44.asServiceRole.entities.User.update(userId, {
        workshop_id: workshop.id,
        role: 'admin',
      });

      return Response.json({ success: true, workshopId: workshop.id });
    }

    // UPDATE — update workshop data (all fields)
    if (body.action === 'update') {
      const { workshopId, name, razao_social, cnpj, phone, whatsapp, email, address, plan, plan_value } = body;
      if (!workshopId) return Response.json({ error: 'workshopId required' }, { status: 400 });

      // Validate mandatory fields are not being set to empty
      const mandatoryCheck = ['name', 'phone', 'email', 'address'].filter(
        (f) => body[f] !== undefined && !String(body[f]).trim()
      );
      if (mandatoryCheck.length > 0) return Response.json({ error: `Campos obrigatórios não podem ficar vazios: ${mandatoryCheck.join(', ')}` }, { status: 400 });

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (razao_social !== undefined) updateData.razao_social = razao_social;
      if (cnpj !== undefined) updateData.cnpj = cnpj;
      if (phone !== undefined) updateData.phone = phone;
      if (whatsapp !== undefined) updateData.whatsapp = whatsapp;
      if (email !== undefined) updateData.email = email;
      if (address !== undefined) updateData.address = address;
      if (plan !== undefined) updateData.plan = plan;
      if (plan_value !== undefined) updateData.plan_value = plan_value;

      await base44.asServiceRole.entities.WorkshopSetting.update(workshopId, updateData);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}