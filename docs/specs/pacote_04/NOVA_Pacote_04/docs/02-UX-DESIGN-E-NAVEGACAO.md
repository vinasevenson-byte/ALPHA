# Padrão visual oficial — Referência escolhida pelo usuário

## Linguagem e aparência
Inspirar-se na imagem fornecida: fundo cinza-gelo, cartões brancos finamente contornados, roxo de ênfase, menu lateral compacto, topbar com alternância Pessoal/Empresa/Investimentos, gráfico de desempenho à esquerda e recomendações à direita. Não copiar marca, logotipo, textos ou valores da aplicação de referência.

### Tokens
- Primária: #6D28D9; hover #5B21B6; selecionado #F1EAFE; foco #7C3AED.
- Fundo: #F5F6FA; superfície: #FFFFFF; borda: #E4E7EF; texto: #172033; secundário: #64748B.
- Sucesso: #15803D; alerta: #B45309; erro: #B91C1C. Sem transmitir estados somente por cor.
- Raio de cards: 10px; spacing base 8px; cabeçalho desktop 64px; sidebar expandida 236px/contraída 64px.
- Tipografia: system UI/inter fallback; mínimo 14px para texto funcional; contraste AA.

## Visão Geral (desktop)
Linha 1: cartões Índice Financeiro (0–100 somente após dados suficientes), Patrimônio Líquido, Resultado Projetado.
Linha 2: gráfico Receitas x Despesas/Patrimônio (2/3), Insights e Recomendações explicáveis (1/3).
Linha 3: composição patrimonial e próximos compromissos, status das conexões.
Menu lateral: Visão Geral; Gestão Financeira; Contas e Compromissos; Fluxo de Caixa; Planejamento; Reservas e Metas; Investimentos; Simulações; Inteligência Financeira [Visão, Alertas, Assistente, Saúde dos Dados]; Integrações [Conexões, Importações, Conciliação, Consentimentos]; Relatórios; Configurações; Auditoria (autorizados).

## Experiência móvel
Bottom nav: Início, Financeiro, Investimentos, Inteligência, Mais. Cards em coluna; gráfico com período reduzido e scroll interno; recomendações após gráfico; painel de filtros fullscreen, sidebar como drawer. Respeitar safe areas.

## Interações
- Clicar em card abre rota com filtro e período preservados.
- Insights mostram causa, números utilizados e CTA que nunca executa movimentação sem nova autorização.
- Filtros de workspace, período, moeda e fonte sempre visíveis ou recuperáveis.
- Cards sem dados mostram CTA de cadastro e 'Nenhum dado disponível'; jamais exemplos como reais.

## Acessibilidade
WCAG 2.2 AA como meta; teclado, foco, labels, aria-live para feedback, reduced motion, ícones com nomes acessíveis, tabelas com cabeçalhos semânticos.
