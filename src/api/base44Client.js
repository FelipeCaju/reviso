import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { isDemoActive } from '@/lib/demoMode';
import { toast } from '@/components/ui/use-toast';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const _client = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  appBaseUrl
});

const WRITE_METHODS = ['create', 'bulkCreate', 'update', 'updateMany', 'bulkUpdate', 'delete', 'deleteMany'];
let _lastToast = 0;

function wrapEntity(entity) {
  if (!entity || typeof entity !== 'object') return entity;
  return new Proxy(entity, {
    get(target, method) {
      const original = target[method];
      if (typeof original !== 'function' || !WRITE_METHODS.includes(method)) {
        return original;
      }
      return (...args) => {
        if (isDemoActive()) {
          const now = Date.now();
          if (now - _lastToast > 3000) {
            _lastToast = now;
            toast({
              title: 'Modo Demonstração',
              description: 'Não é possível salvar no modo demo. Entre em contato para acesso completo.',
              variant: 'destructive',
            });
          }
          return Promise.reject(new Error('Modo demonstração: salvamento bloqueado.'));
        }
        return original.apply(target, args);
      };
    }
  });
}

const wrappedEntities = new Proxy(_client.entities, {
  get(target, entityName) {
    return wrapEntity(target[entityName]);
  }
});

export const base44 = new Proxy(_client, {
  get(target, prop) {
    if (prop === 'entities') return wrappedEntities;
    return target[prop];
  }
});