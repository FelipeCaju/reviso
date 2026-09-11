// Contas que nunca são bloqueadas por trial expirado ou restrições de demo.
// Adicione o email (minúsculo) aqui para liberar acesso permanente.
const ALWAYS_AVAILABLE_EMAILS = [
  "felipecaju172@gmail.com",
  "felipecaju172@hotmail.com",
];

export function isAlwaysAvailable(email) {
  if (!email) return false;
  return ALWAYS_AVAILABLE_EMAILS.includes(email.trim().toLowerCase());
}