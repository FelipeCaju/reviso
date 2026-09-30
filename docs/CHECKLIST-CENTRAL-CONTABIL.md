# Checklist — Central Contábil

- [x] Manter o Revisô como fonte principal dos dados.
- [x] Criar uma Central Contábil independente de SCI, Omie ou outro fornecedor.
- [x] Restringir consultas à oficina do administrador autenticado.
- [x] Permitir selecionar data inicial e final.
- [x] Exibir uma conferência quantitativa antes da exportação.
- [x] Exportar XMLs de documentos fiscais de entrada disponíveis.
- [x] Exportar XMLs de NF-e de saída disponíveis.
- [x] Exportar XMLs de NFS-e disponíveis.
- [x] Exportar contas a pagar em CSV.
- [x] Exportar contas a receber em CSV com total, recebido e saldo por OS.
- [x] Gerar relatório de conferência com totais e XMLs ausentes.
- [x] Gerar um único ZIP organizado por pastas.
- [x] Não interromper a exportação quando um XML estiver ausente; registrar a pendência.
- [x] Adicionar testes de período, saldo, ZIP, isolamento por oficina e XML privado.
- [x] Validar testes automatizados, lint e build.
- [ ] Validar com dados reais no Base44 publicado após sincronização pelo GitHub.
- [ ] Confirmar com o contador o layout específico da SCI antes de desenvolver o conector direto.

## Regra adotada para contas a receber

O sistema atual não possui uma entidade separada de título a receber. Por isso, a exportação usa as ordens de serviço não canceladas concluídas no período e calcula:

`saldo = total da OS - pagamentos ativos`

Pagamentos cancelados não entram no valor recebido. Essa regra preserva a fonte financeira já utilizada pelo Revisô e evita duplicidade de lançamentos.
