# 06 — Matriz de aceite e casos de teste

## Segurança / isolamento
- [ ] Usuário A não acessa carteira nem cotação privada de B (403 e zero fuga no banco); ambiente PF não acessa PJ sem membership.
- [ ] Viewer não grava nem importa operações; funções empresariais de aprovação exigem permissão.
- [ ] Idempotency-Key igual + payload igual retorna mesma operação; chave igual + payload diferente retorna 409.
- [ ] Importar mesmo extrato duas vezes não duplica saldo; falha na linha N não realiza lote parcialmente sem aprovação explícita.

## Cálculos e lançamentos
- [ ] Aplicação de R$1000 em conta de R$5000 diminui caixa em R$1000, cria investimento de R$1000 e mantém patrimônio R$5000.
- [ ] Resgate parcial realiza ganho proporcional e mantém custo dos lotes restantes.
- [ ] Correção auditada por reversão preserva trilha de eventos.
- [ ] Sem cotação válida aparece 'não disponível' em vez de R$0,00 ou saldo antigo como atual.
- [ ] Taxas, IOF e IR aplicados somente quando elegíveis e conforme vigência; 180/181/360/361/720/721 dias testados.
- [ ] Regime PJ não herda fórmula PF; sem dados suficientes retorno líquido é indisponível.
- [ ] Preço de Tesouro Prefixado/IPCA+ antes de vencimento é precificado a mercado, não a taxa de entrada.
- [ ] Comparador deixa explícita a data da oferta e premissas; não classifica oferta vencida como disponível.

## UX e performance
- [ ] Todas as telas funcionam sem lançamentos (empty states sem dados fictícios), mobile, teclado, leitor de telas.
- [ ] Importação CSV tem prévia, erros linha a linha, confirmação e cancelamento.
- [ ] Dashboard distingue valorização e aportes; XIRR / TWR apenas quando aplicável.
- [ ] Dashboard detalha último horário de cotação; filtros por workspace não vazam dados.
- [ ] Simulador testa taxa zero, negativa, aportes, inflação e cenários editáveis.
- [ ] API e jobs possuem log de eventos, métricas e fallback seguro a falha de fornecedor.
- [ ] Migration validada em cópia e rollback de recursos sem perda de lançamentos.
