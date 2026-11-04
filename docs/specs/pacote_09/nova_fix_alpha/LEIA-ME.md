# NOVA / ALPHA — correção de abertura na Vercel

## Diagnóstico baseado no GitHub
O `middleware.ts` atual retorna HTTP 503 para **todo** `VERCEL_ENV=production` por causa da condição `if (production || ...)`. Por isso um build bem-sucedido não garante que o domínio abra. O link efetivo fornecido foi `https://alpha-kilw.vercel.app/` (não `alpha-kill`).

## Como aplicar
1. Faça backup do `middleware.ts` atual e crie uma branch de correção.
2. Copie o `middleware.ts` deste pacote para a **raiz do ALPHA**, substituindo o antigo.
3. Na Vercel > Project Settings > Environment Variables, cadastre:
   - `NOVA_PREVIEW_USER`: um nome de acesso não público.
   - `NOVA_PREVIEW_PASSWORD`: senha aleatória com **20 ou mais caracteres**.
   Configure **Production e Preview** se desejar testar ambos os ambientes.
4. Faça um novo deploy a partir do commit com a correção. Se alterar variáveis depois, faça **Redeploy**: elas não mudam o deployment já criado.
5. Acesse exatamente `https://alpha-kilw.vercel.app/`. O navegador deverá solicitar usuário e senha HTTP Basic. Em navegadores que não exibirem prompt, inspecione Network para resposta 401.
6. Confirme se o GET `/api/platform` retorna dados. Caso receba 500, veja Runtime Logs: pode haver falha de Prisma, ausência de PostgreSQL ou incompatibilidade do schema.

## Segurança e limitações
- Correção **temporária para inspeção visual**. A aplicação **não está homologada para produção**.
- Requisições POST/PUT/PATCH/DELETE a `/api/` e `/v1/` continuam retornando 403; portanto login/cadastro pela API e gravações financeiras não funcionarão até a implantação segura.
- NÃO desative autenticação ou exponha credenciais. NÃO use dados bancários reais.
- PostgreSQL: o schema na raiz (`prisma/schema.prisma`) deve ser compatível com o provedor e com as migrações; nenhum banco foi migrado por este pacote.
- O arquivo `.env` não deve ser versionado. Se alguma credencial real foi publicada, revogue/rotacione.
- Este pacote não foi automaticamente aplicado ao GitHub ou Vercel.

## Instrução curta para o Gemini no VS Code
'Analise middleware.ts, preservando proteção HTTP Basic, retire apenas o bloqueio indiscriminado de VERCEL_ENV=production, mantenha operações financeiras em modo leitura e teste o build. Confira em seguida os Runtime Logs de /api/platform e a configuração DATABASE_URL; não simule dados e não libere gravações sem autenticação e RBAC homologados.'
