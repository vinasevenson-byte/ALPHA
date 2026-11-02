export const novaNavigation = [
  { label: "Visão Geral", href: "visao-geral", icon: "layout-dashboard" },
  { label: "Gestão Financeira", href: "movimentacoes", icon: "wallet" },
  {
    label: "Contas a Pagar e Receber",
    href: "compromissos",
    icon: "arrow-left-right",
  },
  {
    label: "Fluxo de Caixa",
    href: "fluxo-de-caixa",
    icon: "chart-no-axes-column",
  },
  { label: "Planejamento", href: "planejamento", icon: "calendar-range" },
  { label: "Reservas e Metas", href: "reservas", icon: "piggy-bank" },
  { label: "Investimentos", href: "investimentos", icon: "trending-up" },
  { label: "Simulações", href: "simulacoes", icon: "calculator" },
  {
    label: "Inteligência Financeira",
    href: "inteligencia",
    icon: "brain-circuit",
    children: [
      { label: "Visão", href: "inteligencia" },
      { label: "Alertas", href: "inteligencia/alertas" },
      { label: "Assistente", href: "inteligencia/assistente" },
      { label: "Saúde dos Dados", href: "inteligencia/saude-dados" },
    ],
  },
  {
    label: "Integrações",
    href: "integracoes",
    icon: "plug",
    children: [
      { label: "Conexões", href: "integracoes/conexoes" },
      { label: "Importações", href: "integracoes/importacoes" },
      { label: "Conciliação", href: "integracoes/conciliacao" },
      { label: "Consentimentos", href: "integracoes/consentimentos" },
    ],
  },
  { label: "Relatórios", href: "relatorios", icon: "file-chart-column" },
  { label: "Configurações", href: "configuracoes", icon: "settings" },
  {
    label: "Auditoria",
    href: "auditoria",
    icon: "shield",
    permission: "audit.read",
  },
] as const;

export const workspaceHref = (workspaceId: string, subpath: string) =>
  `/app/${encodeURIComponent(workspaceId)}/${subpath}`;
