import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    const ownerEmail = 'felipecaju172@gmail.com';
    const normalize = (email) => String(email || '').trim().toLowerCase();
    const isPlatformOwner = normalize(user.email) === ownerEmail;
    const db = base44.asServiceRole.entities;
    const deny = () => Response.json({ error: 'E-mail sem acesso autorizado a uma oficina. Entre em contato com o administrador.' }, { status: 403 });

    // Only the server may bind users to a pre-registered workshop.
    if (body.action === 'resolveAccess') {
      const grants = await db.WorkshopAccess.filter({ email: normalize(user.email) }, '-created_date', 2);
      if (grants.length > 1) return deny();
      const grant = grants[0];
      if (grant && user.workshop_id && grant.workshop_id !== user.workshop_id) return deny();
      const workshopId = user.workshop_id || grant?.workshop_id;
      if (!workshopId) {
        if (!isPlatformOwner) return deny();
        return Response.json({ user, isPlatformOwner: true, workshop: null });
      }
      let workshop;
      try { workshop = await db.WorkshopSetting.get(workshopId); }
      catch (error) {
        if (error.status === 404 || error.response?.status === 404) return deny();
        throw error;
      }
      if (!workshop?.id) return deny();
      if (grant && (!user.workshop_id || user.role !== grant.role)) {
        await db.User.update(user.id, { workshop_id: workshopId, role: grant.role });
        user.workshop_id = workshopId;
        user.role = grant.role;
      }
      const { demo_password: _password, demo_email: _email, ...safeWorkshop } = workshop;
      return Response.json({ user, isPlatformOwner, workshop: safeWorkshop });
    }

    if (body.action === 'selfRegister') return deny();

    // A workshop admin can manage only members of their own workshop.
    const employeeActions = ['listEmployees', 'inviteEmployee', 'changeEmployeeRole', 'removeEmployee'];
    if (employeeActions.includes(body.action)) {
      if (user.role !== 'admin' || !user.workshop_id) return deny();
      const workshopId = user.workshop_id;
      const workshop = await db.WorkshopSetting.get(workshopId);
      if (!workshop?.id) return deny();
      if (body.action === 'listEmployees') {
        const members = await db.User.filter({ workshop_id: workshopId }, '-created_date', 500);
        const pending = await db.WorkshopAccess.filter({ workshop_id: workshopId }, '-created_date', 500);
        const users = members.map((u) => ({ id: u.id, email: u.email, full_name: u.full_name, role: u.role }));
        for (const g of pending) {
          if (!members.some((u) => normalize(u.email) === g.email)) {
            users.push({ id: `pending_${g.id}`, email: g.email, full_name: '', role: g.role });
          }
        }
        return Response.json({ users });
      }
      if (body.action === 'inviteEmployee') {
        const email = normalize(body.email);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['admin', 'user'].includes(body.role)) {
          return Response.json({ error: 'E-mail ou perfil inválido.' }, { status: 400 });
        }
        if (email === ownerEmail) return deny();
        const existing = await db.User.filter({ email }, '-created_date', 2);
        const grants = await db.WorkshopAccess.filter({ email }, '-created_date', 2);
        if (existing.length > 1 || grants.length || existing.some((u) => u.workshop_id)) {
          return Response.json({ error: 'Este e-mail já possui um vínculo. Não é possível transferi-lo por convite.' }, { status: 409 });
        }
        const grant = await db.WorkshopAccess.create({ email, workshop_id: workshopId, role: body.role });
        try {
          // Sending an invitation does not grant global administrator privileges.
          if (!existing.length) await base44.users.inviteUser(email, 'user');
          if (existing[0]) await db.User.update(existing[0].id, { workshop_id: workshopId, role: body.role });
        } catch (error) {
          await db.WorkshopAccess.delete(grant.id);
          throw error;
        }
        return Response.json({ success: true });
      }
      let target;
      let grant;
      if (String(body.userId).startsWith('pending_')) {
        grant = await db.WorkshopAccess.get(String(body.userId).slice(8));
        if (grant.workshop_id !== workshopId) return deny();
        const registered = await db.User.filter({ email: grant.email }, '-created_date', 2);
        target = registered[0];
      } else {
        target = await db.User.get(body.userId);
        if (target?.workshop_id !== workshopId) return deny();
      }
      if (target && (target.workshop_id && target.workshop_id !== workshopId || target.id === user.id || normalize(target.email) === ownerEmail)) return deny();
      const email = grant?.email || normalize(target?.email);
      const grants = await db.WorkshopAccess.filter({ email, workshop_id: workshopId }, '-created_date', 100);
      if (body.action === 'removeEmployee') {
        // Revoke the pre-registration as well, so logging in cannot restore access.
        for (const g of grants) await db.WorkshopAccess.delete(g.id);
        if (target) await db.User.update(target.id, { workshop_id: '', role: 'user' });
      } else {
        if (!['admin', 'user'].includes(body.role)) return Response.json({ error: 'Perfil inválido' }, { status: 400 });
        for (const g of grants) await db.WorkshopAccess.update(g.id, { role: body.role });
        if (target) await db.User.update(target.id, { role: body.role });
      }
      return Response.json({ success: true });
    }

    // Profile completion is scoped to the caller's own workshop; plans are platform-only.
    if (!isPlatformOwner) {
      if (body.action !== 'update' || user.role !== 'admin' || !user.workshop_id || body.workshopId !== user.workshop_id || body.plan !== undefined || body.plan_value !== undefined || body.fiscal_module_enabled !== undefined) return deny();
    }

    if (body.action === 'create') {
      if (!isPlatformOwner) return deny();
      const email = normalize(body.ownerEmail);
      const missing = ['name', 'phone', 'email', 'address'].filter((f) => !String(body[f] || '').trim());
      if (missing.length || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === ownerEmail) {
        return Response.json({ error: 'Preencha os dados da oficina e um e-mail válido do proprietário.' }, { status: 400 });
      }
      const existing = await db.User.filter({ email }, '-created_date', 2);
      const grants = await db.WorkshopAccess.filter({ email }, '-created_date', 2);
      if (existing.length > 1 || grants.length || existing.some((u) => u.workshop_id)) {
        return Response.json({ error: 'Este e-mail já está vinculado ou pré-cadastrado. Edite a oficina existente.' }, { status: 409 });
      }
      const workshop = await db.WorkshopSetting.create({
        name: body.name.trim(), razao_social: body.razao_social || '', cnpj: body.cnpj || '',
        phone: body.phone, whatsapp: body.whatsapp || '', email: body.email, address: body.address,
        plan: 'free', plan_value: 0, fiscal_module_enabled: !!body.fiscal_module_enabled, trial_started_at: new Date().toISOString(),
        default_capacity: 8, capacity_monday: 8, capacity_tuesday: 8, capacity_wednesday: 8,
        capacity_thursday: 8, capacity_friday: 6, capacity_saturday: 3, capacity_sunday: 0,
      });
      // Persist the e-mail even when the owner has never logged in.
      await db.WorkshopAccess.create({ email, workshop_id: workshop.id, role: 'admin' });
      if (existing[0]) await db.User.update(existing[0].id, { workshop_id: workshop.id, role: 'admin' });
      return Response.json({ success: true, workshopId: workshop.id });
    }

    // LIST — return all workshops with their admin owners + orphan users (registered but no workshop)
    if (body.action === 'list') {
      const workshops = await base44.asServiceRole.entities.WorkshopSetting.list('-created_date', 500);
      const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
      const admins = users.filter((u) => u.role === 'admin');
      const grants = await db.WorkshopAccess.list('-created_date', 500);

      const result = workshops.map((w) => {
        const owners = admins.filter((u) => u.workshop_id === w.id);
        for (const grant of grants.filter((g) => g.workshop_id === w.id && g.role === 'admin')) {
          if (!owners.some((o) => normalize(o.email) === grant.email)) owners.push({ id: grant.id, email: grant.email, full_name: '' });
        }
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
          fiscal_module_enabled: !!w.fiscal_module_enabled,
          is_demo: w.is_demo,
          trial_started_at: w.trial_started_at,
          created_date: w.created_date,
          owners: owners.map((o) => ({ id: o.id, full_name: o.full_name, email: o.email }))
        };
      });

      // Include users who registered but have no workshop (exclude platform owner = admin without workshop_id)
      const orphanUsers = users.filter((u) => !u.workshop_id && normalize(u.email) !== ownerEmail && !grants.some((g) => g.email === normalize(u.email)));
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
          fiscal_module_enabled: false,
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
      const { userId, name, razao_social, cnpj, phone, whatsapp, email, address, plan, plan_value, fiscal_module_enabled } = body;
      const missing = ['name', 'phone', 'email', 'address'].filter((f) => !body[f] || !String(body[f]).trim());
      if (!userId || missing.length > 0) return Response.json({ error: `Campos obrigatórios faltando: ${missing.join(', ')}` }, { status: 400 });

      const target = await db.User.get(userId);
      const existingGrants = await db.WorkshopAccess.filter({ email: normalize(target.email) }, '-created_date', 2);
      if (target.workshop_id || normalize(target.email) === ownerEmail || existingGrants.length) {
        return Response.json({ error: 'Usuário já vinculado ou reservado.' }, { status: 409 });
      }

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
        fiscal_module_enabled: !!fiscal_module_enabled,
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
      const { workshopId, name, razao_social, cnpj, phone, whatsapp, email, address, plan, plan_value, fiscal_module_enabled } = body;
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
      if (fiscal_module_enabled !== undefined) updateData.fiscal_module_enabled = !!fiscal_module_enabled;

      await base44.asServiceRole.entities.WorkshopSetting.update(workshopId, updateData);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    const status = error.status || error.response?.status;
    return Response.json({ error: status === 401 ? 'Unauthorized' : 'Não foi possível concluir a operação. Tente novamente.' }, { status: status === 401 ? 401 : 500 });
  }
}
