import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { isDemoActive, isPublicDemo, setPublicDemo } from '@/lib/demoMode';
import { toast } from '@/components/ui/use-toast';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const _client = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  appBaseUrl
});

const WRITE_METHODS = ['create', 'bulkCreate', 'update', 'updateMany', 'bulkUpdate', 'delete', 'deleteMany', 'deleteAll', 'importEntities'];
let _lastToast = 0;

function rejectDemoWrite() {
  const now = Date.now();
  if (now - _lastToast > 3000) {
    _lastToast = now;
    toast({ title: 'Modo Demonstração', description: 'Somente visualização: não é possível salvar ou enviar dados.', variant: 'destructive' });
  }
  return Promise.reject(new Error('Modo demonstração: operação de escrita bloqueada.'));
}

function wrapEntity(entity, entityName) {
  if (!entity || typeof entity !== 'object') return entity;
  return new Proxy(entity, {
    get(target, method) {
      if (typeof method !== 'string') return target[method];
      const original = target[method];
      if (typeof original !== 'function') return original;
      return (...args) => {
        if (isPublicDemo()) {
          if (!['get', 'list', 'filter'].includes(method)) return rejectDemoWrite();
          const payload = { action: 'read', entity: entityName, method };
          if (method === 'get') Object.assign(payload, { id: args[0] });
          else {
            const offset = method === 'filter' ? 1 : 0;
            Object.assign(payload, { query: offset ? args[0] : {}, sort: args[offset], limit: args[offset + 1], skip: args[offset + 2] });
          }
          return _client.functions.invoke('getDemoAccess', payload).then((res) => res.data.result);
        }
        if (isDemoActive() && WRITE_METHODS.includes(method)) return rejectDemoWrite();
        return original.apply(target, args);
      };
    }
  });
}

const wrappedEntities = new Proxy(_client.entities, {
  get(target, entityName) {
    if (typeof entityName !== 'string') return undefined;
    return wrapEntity(target[entityName], entityName);
  }
});

const wrappedFunctions = new Proxy(_client.functions, {
  get(target, method) {
    const original = target[method];
    if (typeof original !== 'function') return original;
    return (...args) => {
      if (isPublicDemo() && args[0] !== 'getDemoAccess') {
        if (method === 'invoke' && args[0] === 'manageWorkshops' && args[1]?.action === 'listEmployees') return Promise.resolve({ data: { users: [] } });
        return rejectDemoWrite();
      }
      return original.apply(target, args);
    };
  }
});

const wrappedAuth = new Proxy(_client.auth, {
  get(target, method) {
    const original = target[method];
    if (typeof original !== 'function') return original;
    return (...args) => {
      if (isPublicDemo()) {
        if (method === 'me') return _client.functions.invoke('getDemoAccess', { action: 'context' }).then((res) => res.data.user);
        if (method === 'logout') {
          setPublicDemo(false);
          window.location.assign('/login');
          return;
        }
        return rejectDemoWrite();
      }
      return original.apply(target, args);
    };
  }
});

function readOnlyModule(module) {
  return new Proxy(module, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value === 'function') return (...args) => isPublicDemo() ? rejectDemoWrite() : value.apply(target, args);
      if (value && typeof value === 'object') return readOnlyModule(value);
      return value;
    }
  });
}

export const base44 = new Proxy(_client, {
  get(target, prop) {
    if (prop === 'entities') return wrappedEntities;
    if (prop === 'functions') return wrappedFunctions;
    if (prop === 'auth') return wrappedAuth;
    if (prop === 'integrations' || prop === 'users') return readOnlyModule(target[prop]);
    return target[prop];
  }
});
