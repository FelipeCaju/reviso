import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { withWorkshop, setWorkshopId } from '../src/lib/workshop.js';
import { isPlatformOwner } from '../src/lib/platformAccess.js';

const source = readFileSync(new URL('../base44/functions/manageWorkshops/entry.ts', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/, '').replace('export default async function', 'return async function');
const owner = { id: 'owner', email: 'felipecaju172@gmail.com', role: 'admin', workshop_id: 'a' };
const lucas = { id: 'lucas', email: 'lucasnaidig52@gmail.com', role: 'admin', workshop_id: 'b' };
const employee = { id: 'employee', email: 'employee@example.com', role: 'user', workshop_id: 'b' };
const unknown = { id: 'unknown', email: 'unknown@example.com', role: 'user' };
const profile = { name: 'Oficina', phone: '123', email: 'oficina@example.com', address: 'Rua A' };

function setup(current, extra = {}, handlerSource = source) {
  const state = structuredClone({
    User: [owner, lucas, employee, unknown],
    WorkshopSetting: [{ id: 'a', ...profile }, { id: 'b', ...profile }],
    WorkshopAccess: [], ...extra,
  });
  const writes = [];
  const entities = Object.fromEntries(Object.keys(state).map((name) => [name, {
    async list(_sort, limit = 500) { return structuredClone(state[name].slice(0, limit)); },
    async filter(query, _sort, limit = 500) {
      return structuredClone(state[name].filter((r) => Object.entries(query).every(([k,v]) => r[k] === v)).slice(0, limit));
    },
    async get(id) {
      const row = state[name].find((r) => r.id === id);
      if (!row) throw Object.assign(new Error('not found'), { status: 404 });
      return structuredClone(row);
    },
    async create(data) {
      const row = { ...data, id: `${name}-${state[name].length + 1}` };
      state[name].push(row); writes.push(['create', name, row.id]); return structuredClone(row);
    },
    async update(id, data) {
      const row = state[name].find((r) => r.id === id);
      if (!row) throw new Error('missing record');
      Object.assign(row, data); writes.push(['update', name, id]); return structuredClone(row);
    },
    async delete(id) { state[name] = state[name].filter((r) => r.id !== id); writes.push(['delete', name, id]); },
  }]));
  const client = {
    auth: { me: async () => current ? structuredClone(state.User.find((u) => u.id === current.id) || current) : null },
    users: { inviteUser: async (...args) => writes.push(['invite', ...args]) },
    asServiceRole: { entities },
  };
  const handler = new Function('createClientFromRequest', handlerSource)(() => client);
  return { state, writes, call: (body) => handler(new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) })) };
}

test('Google users without a workshop or preregistration are denied; admin without workshop is not platform owner', async () => {
  for (const user of [unknown, { ...unknown, id: 'unregistered-admin', role: 'admin' }]) {
    const env = setup(user);
    assert.equal((await env.call({ action: 'resolveAccess' })).status, 403);
    assert.equal(env.writes.length, 0);
  }
});
test('unauthenticated callers and self-registration cannot create a workshop', async () => {
  assert.equal((await setup(null).call({ action: 'create', ...profile })).status, 401);
  const env = setup(unknown);
  assert.equal((await env.call({ action: 'selfRegister', ...profile })).status, 403);
  assert.equal(env.writes.length, 0);
});
test('Lucas and his employee resolve to their own workshop', async () => {
  for (const user of [lucas, employee]) {
    const res = await setup(user).call({ action: 'resolveAccess' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.workshop.id, 'b'); assert.equal(data.isPlatformOwner, false);
  }
});
test('missing workshop blocks access rather than continuing after an error', async () => {
  const env = setup(lucas, { WorkshopSetting: [{ id: 'a' }] });
  assert.equal((await env.call({ action: 'resolveAccess' })).status, 403);
});
test('workshop admin cannot enumerate, create, provision, or modify another workshop', async () => {
  for (const body of [{ action: 'list' }, { action: 'create', ...profile }, { action: 'provision', userId: 'unknown', ...profile }, { action: 'update', workshopId: 'a', ...profile }]) {
    const env = setup(lucas);
    assert.equal((await env.call(body)).status, 403); assert.equal(env.writes.length, 0);
  }
});
test('workshop admin may complete own profile but cannot change subscription', async () => {
  assert.equal((await setup(lucas).call({ action: 'update', workshopId: 'b', ...profile })).status, 200);
  assert.equal((await setup(lucas).call({ action: 'update', workshopId: 'b', plan: 'normal' })).status, 403);
});
test('platform owner preregisters normalized email and first Google login consumes correct grant', async () => {
  const env = setup(owner);
  assert.equal((await env.call({ action: 'create', ...profile, ownerEmail: ' New@Example.com ' })).status, 200);
  const grant = env.state.WorkshopAccess[0];
  assert.equal(grant.email, 'new@example.com');
  const newUser = { id: 'new', email: 'new@example.com', role: 'user' };
  const login = setup(newUser, env.state);
  login.state.User.push(newUser);
  const res = await login.call({ action: 'resolveAccess' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).user.workshop_id, grant.workshop_id);
  assert.equal(login.state.User.find((u) => u.id === 'new').role, 'admin');
});
test('preregistration refuses existing owner, duplicate grants, and platform account', async () => {
  for (const email of [lucas.email, owner.email]) {
    const env = setup(owner);
    assert.notEqual((await env.call({ action: 'create', ...profile, ownerEmail: email })).status, 200);
    assert.equal(env.writes.length, 0);
  }
});
test('conflicting grants do not reassign a user', async () => {
  const env = setup(lucas, { WorkshopAccess: [{ id: 'g', email: lucas.email, workshop_id: 'a', role: 'admin' }] });
  assert.equal((await env.call({ action: 'resolveAccess' })).status, 403); assert.equal(env.writes.length, 0);
});
test('employee management rejects foreign users, self removal, and platform account', async () => {
  for (const body of [{ action: 'removeEmployee', userId: owner.id }, { action: 'changeEmployeeRole', userId: owner.id, role: 'user' }, { action: 'removeEmployee', userId: lucas.id }, { action: 'inviteEmployee', email: owner.email, role: 'admin' }]) {
    const env = setup(lucas); assert.equal((await env.call(body)).status, 403); assert.equal(env.writes.length, 0);
  }
  assert.equal((await setup(employee).call({ action: 'listEmployees' })).status, 403);
});
test('removal revokes preregistration and login access', async () => {
  const env = setup(lucas, { WorkshopAccess: [{ id: 'g', email: employee.email, workshop_id: 'b', role: 'user' }] });
  assert.equal((await env.call({ action: 'removeEmployee', userId: employee.id })).status, 200);
  assert.equal(env.state.WorkshopAccess.length, 0);
  assert.equal((await setup(employee, env.state).call({ action: 'resolveAccess' })).status, 403);
});
test('employee lists are tenant-scoped and new employee invitation stays in caller workshop', async () => {
  const env = setup(lucas);
  const list = await (await env.call({ action: 'listEmployees' })).json();
  assert.deepEqual(list.users.map((u) => u.id), ['lucas', 'employee']);
  assert.equal((await env.call({ action: 'inviteEmployee', email: 'new@example.com', role: 'user' })).status, 200);
  assert.equal(env.state.WorkshopAccess[0].workshop_id, 'b');
});
test('tenant helper refuses unassigned writes and overrides supplied foreign workshop', () => {
  setWorkshopId(null); assert.throws(() => withWorkshop({ name: 'client' }));
  setWorkshopId('b'); assert.equal(withWorkshop({ workshop_id: 'a' }).workshop_id, 'b'); setWorkshopId(null);
});
test('only the confirmed Google account has platform UI privileges', () => {
  assert.equal(isPlatformOwner(owner), true); assert.equal(isPlatformOwner(lucas), false);
  assert.equal(isPlatformOwner({ email: 'felipecaju172@hotmail.com', role: 'admin' }), false);
});
test('all tenant entities require workshop_id and enforce matching ownership on every operation', () => {
  const dir = new URL('../base44/entities/', import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.jsonc'))) {
    const schema = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    if (['User', 'WorkshopSetting', 'WorkshopAccess'].includes(schema.name)) continue;
    assert.ok(schema.required.includes('workshop_id'), schema.name);
    for (const op of ['read', 'create', 'update', 'delete']) {
      assert.ok(schema.rls[op].$and.some((rule) => rule['data.workshop_id'] === '{{user.data.workshop_id}}'), `${schema.name}.${op}`);
    }
  }
});

test('route permissions respect workshop roles and reserve Nova Oficina for the platform owner', async () => {
  const { canAccessPage } = await import('../src/lib/platformAccess.js');
  assert.equal(canAccessPage('/admin', owner), true);
  assert.equal(canAccessPage('/admin', lucas), false);
  assert.equal(canAccessPage('/admin', owner, true), false);
  for (const path of ['/financeiro', '/relatorios', '/configuracoes', '/compras/123']) {
    assert.equal(canAccessPage(path, lucas), true);
    assert.equal(canAccessPage(path, employee), false);
    assert.equal(canAccessPage(path, employee, true), true);
  }
  assert.equal(canAccessPage('/os/123', employee), true);
});

const demoSource = readFileSync(new URL('../base44/functions/getDemoAccess/entry.ts', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/, '').replace('export default async function', 'return async function');

test('public demo returns a visitor, never owner credentials or an administrator session', async () => {
  const env = setup(null, { WorkshopSetting: [{ id: 'a', demo_password: 'secret', demo_email: owner.email }] }, demoSource);
  const response = await env.call({ action: 'context' });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.user.id, 'demo-visitor');
  assert.equal(data.user.role, 'user');
  assert.equal(data.user.workshop_id, 'a');
  assert.equal(data.workshop.demo_password, undefined);
  assert.equal(data.workshop.demo_email, undefined);
  assert.equal(data.password, undefined);
  assert.equal(env.writes.length, 0);
});
test('demo lists and filters only the platform owner data, never Lucas data', async () => {
  const env = setup(null, { Customer: [{ id: 'ca', workshop_id: 'a', name: 'Demo' }, { id: 'cb', workshop_id: 'b', name: 'Private' }] }, demoSource);
  const list = await (await env.call({ action: 'read', entity: 'Customer', method: 'list' })).json();
  assert.deepEqual(list.result.map((r) => r.id), ['ca']);
  assert.equal((await env.call({ action: 'read', entity: 'Customer', method: 'get', id: 'cb' })).status, 404);
  assert.equal((await env.call({ action: 'read', entity: 'Customer', method: 'get', id: 'ca' })).status, 200);
  assert.equal((await env.call({ action: 'read', entity: 'Customer', method: 'filter', query: { workshop_id: 'b' } })).status, 403);
  assert.equal((await env.call({ action: 'read', entity: 'Customer', method: 'filter', query: { $or: [{ workshop_id: 'b' }] } })).status, 400);
  assert.equal(env.writes.length, 0);
});
test('demo rejects mutations and access to users, grants and unrelated entities', async () => {
  const env = setup(null, {}, demoSource);
  for (const method of ['create', 'update', 'delete', 'bulkCreate', 'deleteMany']) {
    assert.equal((await env.call({ action: 'read', entity: 'Customer', method })).status, 403);
  }
  for (const entity of ['User', 'WorkshopAccess', 'Anything', '__proto__']) {
    assert.equal((await env.call({ action: 'read', entity, method: 'list' })).status, 403);
  }
  assert.equal((await env.call({ action: 'update', workshopId: 'b' })).status, 403);
  assert.equal(env.writes.length, 0);
});
test('demo cannot select another workshop configuration', async () => {
  const env = setup(null, {}, demoSource);
  assert.equal((await env.call({ action: 'read', entity: 'WorkshopSetting', method: 'get', id: 'b' })).status, 404);
  assert.equal((await env.call({ action: 'read', entity: 'WorkshopSetting', method: 'get', id: 'a' })).status, 200);
});

test('demo client routes reads to the read-only backend and blocks entity, function, upload and invite writes', async () => {
  const clientSource = readFileSync(new URL('../src/api/base44Client.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export const base44 =', 'const base44 =') + '\nreturn base44;';
  const calls = [];
  let visitor = true;
  const raw = {
    entities: { Customer: {
      get: async (...args) => calls.push(['raw-get', ...args]),
      list: async () => [], filter: async () => [],
      create: async (...args) => calls.push(['raw-create', ...args]),
      update: async (...args) => calls.push(['raw-update', ...args]),
      delete: async (...args) => calls.push(['raw-delete', ...args]),
    } },
    auth: { me: async () => owner, logout: () => {} },
    functions: { invoke: async (name, body) => { calls.push([name, body]); return { data: { result: [{ id: 'demo-record' }], user: { id: 'demo-visitor' } } }; } },
    integrations: { Core: { SendEmail: async () => calls.push(['send']), UploadPublicFile: async () => calls.push(['upload']) } },
    users: { inviteUser: async () => calls.push(['invite']) },
  };
  const client = new Function('createClient', 'appParams', 'isDemoActive', 'isPublicDemo', 'setPublicDemo', 'toast', clientSource)
    (() => raw, {}, () => visitor, () => visitor, () => {}, () => {});
  assert.deepEqual(await client.entities.Customer.list('-created_date', 100), [{ id: 'demo-record' }]);
  assert.equal(calls[0][0], 'getDemoAccess');
  assert.equal((await client.auth.me()).id, 'demo-visitor');
  for (const op of [() => client.entities.Customer.create({}), () => client.entities.Customer.update('a', {}), () => client.entities.Customer.delete('a'), () => client.functions.invoke('manageWorkshops', { action: 'create' }), () => client.integrations.Core.SendEmail({}), () => client.integrations.Core.UploadPublicFile({}), () => client.users.inviteUser('x', 'admin')]) {
    await assert.rejects(op, /demonstração/);
  }
  assert.ok(calls.every(([name]) => name === 'getDemoAccess'));
  visitor = false;
  await client.entities.Customer.create({ name: 'normal' });
  assert.equal(calls.at(-1)[0], 'raw-create');
  assert.equal((await client.auth.me()).id, 'owner');
});
