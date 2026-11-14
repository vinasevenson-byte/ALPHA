# Regras do Projeto NOVA / ALPHA

## Git, Commit e Deploy Automático

Sempre que concluir alterações de código, estilo ou configuração no repositório `ALPHA`:

1. Valide as alterações (`npm.cmd run lint` e `npm.cmd run build` quando aplicável) garantindo que não há erros de compilação ou tipagem.
2. Certifique-se de que arquivos sensíveis (como `.env`, `.env.*` locais e bancos `.db`) **nunca** entrem no stage do Git.
3. Execute automaticamente em sequência, sem aguardar confirmação adicional:
   - `git add .`
   - `git commit -m "<tipo>(<escopo>): <descrição concisa em português>"`
   - `git push origin main` (disparando o deploy automático na Vercel conectada ao repositório GitHub).
