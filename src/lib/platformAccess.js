export const PLATFORM_OWNER_EMAIL = 'felipecaju172@gmail.com';

export function isPlatformOwner(user) {
  return user?.email?.trim().toLowerCase() === PLATFORM_OWNER_EMAIL;
}

const ADMIN_PAGES = new Set([
  'orcamentos', 'materiais', 'servicos', 'fornecedores', 'compras', 'pedidos',
  'despesas', 'financeiro', 'relatorios', 'relatorios-financeiros', 'configuracoes',
  'fiscal', 'documentos-fiscais',
]);

export function canAccessPage(pathname, user, isDemo = false) {
  const page = pathname.split('/').filter(Boolean)[0] || '';
  if (page === 'admin') return !isDemo && isPlatformOwner(user);
  if (isDemo) return true;
  return !ADMIN_PAGES.has(page) || user?.role === 'admin';
}
