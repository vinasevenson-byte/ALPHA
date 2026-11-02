# Implantação por fases — nenhuma publicação automática

### Fase A: consolidação de design
Aplicar tokens e shells responsivos; links válidos para os três pacotes; screens vazias reais; screenshots comparativas com referência desktop/mobile.

### Fase B: dados e motor
Migration aditiva revisada, rotas de diagnósticos, avaliação de qualidade e testes; índices por workspace; rollback validado; sem integrações externas.

### Fase C: ingestão manual
CSV/OFX com preview, mapeamento de colunas, falhas por linha, hash, dedup, conciliação e confirmação do usuário antes de qualquer inclusão no ledger.

### Fase D: alertas e IA
Alertas determinísticos; inbox, silenciar, reconhecer, dedup, preferências. Assistente read-only que cita fontes internas, respostas incompletas quando faltar dados; guardrails.

### Fase E: integração externa
Selecionar provedor autorizado, revisar contrato e escopos, armazenar credenciais em vault, sandbox com consentimento revogável, auditoria, retries, sincronização incremental, incidentes e testes de resilência.

### Fase F: homologação
CI: lint, typecheck, testes, build, migrations em banco descartável, E2E desktop e mobile, isolamento entre workspaces, acessibilidade, segurança, carga, restore backup. Publicar Preview e fazer aprovação formal. Produção somente após critérios aprovados.

## Flags
`NOVA_P4_INSIGHTS`, `NOVA_P4_IMPORTS`, `NOVA_P4_ALERTS`, `NOVA_P4_AI_ASSISTANT`, `NOVA_P4_OPEN_FINANCE` (OFF por padrão). Flags protegidas no servidor.

## Rollback
Desligar flags; pausar consumidores/cron; restaurar código anterior. Migrações destrutivas proibidas; para alterações de schema usar expand/contract com monitoramento de versões.
