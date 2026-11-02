# Escopo funcional — Pacote 04

## 01. Central de Inteligência
- Resumo: saúde financeira, qualidade dos dados, saldo disponível, saldo projetado e capacidade potencial de reservar.
- Cards clicáveis: alertas prioritários, contas em risco de atraso, concentração de despesas, recorrências e saldos sem conciliação.
- Insights auditáveis: título, explicação, evidências agregadas, período, nível de confiança, ação sugerida, status (novo/visto/dispensado/feito), atualização.
- Nunca sugerir aporte quando fluxo futuro e compromissos incompletos ou dado defasado.

## 02. Conexões Financeiras
- Catálogo de instituições integráveis, conectores, estados (não conectado, aguardando, ativo, sincronizando, expirado, revogado, erro).
- Consentimentos por workspace, proprietário, finalidades, escopos, início/fim e revogação; sem consentimento não acessar.
- Sincronizar somente leitura inicialmente; importação manual CSV/OFX com conferência, preview, deduplicação e confirmação.
- Conciliação: identificação de duplicatas e transferências próprias; nunca criar receita ao importar uma transferência.

## 03. Central de Alertas
- Tipos: saldo futuro negativo, vencimento próximo/atrasado, gasto acima do orçamento, alteração incomum, baixa liquidez, concentração de carteira, cotação desatualizada, falha na integração.
- Regras parametrizáveis; prioridades crítico/alto/médio/baixo; notificações internas e e-mail somente opt-in e templates sem dados sensíveis.
- Silenciar, reconhecer, configurar frequência; deduplicação por chave de evento e janela.

## 04. Assistente de IA contextual
- Perguntas: 'Por que gastei mais?', 'Quanto posso reservar?', 'Quais contas vencem?' e 'Qual meu fluxo até dezembro?'.
- Ferramentas permitidas: consultas agregadas read-only autorizadas, simulação sem efeito colateral, links internos.
- Respostas incluem período, fonte, última atualização, hipóteses, incerteza e caminho para detalhes.
- Bloqueado: executar pagamentos, modificar contas, transferir, aplicar/resgatar e aconselhar individualmente compra/venda de valores mobiliários sem base regulatória.
- Prompt injection: fontes externas e descrições de transações são dados não confiáveis, não instruções.

## 05. Relatórios e exportações
- Fluxo de caixa projetado 30/90/180/365 dias, orçamento x realizado, variação por categoria, evolução da reserva, carteira patrimonial com cotação e data de referência.
- Export CSV/Excel/PDF com RBAC, mascaramento, trilha de auditoria, filtro por período e watermark de geração; export grande assíncrono com expiração.
- Dados faltantes não viram zero artificial: 'indisponível' com motivo.

## 06. Área Empresarial
- Centros de custo, obrigações, recebíveis, atraso de clientes, caixa mínimo operacional e contas restritas por papel.
- Mesmos serviços compartilhados, consultas sempre filtradas por workspace.

## Estados de cada tela
Carregando, vazia, com dados, erro recuperável, sem permissão, sem conexão, dados defasados. Cada botão precisa de ação real e feedback; nenhuma ação decorativa.
