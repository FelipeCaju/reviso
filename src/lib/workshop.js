// Cache simples do workshop_id do usuário atual.
// O AuthContext atualiza este valor assim que o usuário é carregado.
// Todas as criações de registros passam por withWorkshop() para garantir
// que cada registro nasça já vinculado à oficina correta (tenant).

let _workshopId = null;

export function setWorkshopId(id) {
  _workshopId = id || null;
}

export function getWorkshopId() {
  return _workshopId;
}

export function withWorkshop(data = {}) {
  if (!_workshopId) throw new Error('Acesso sem oficina autorizada. Entre novamente.');
  return { ...data, workshop_id: _workshopId };
}