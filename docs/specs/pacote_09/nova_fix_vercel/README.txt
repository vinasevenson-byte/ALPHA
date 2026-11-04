NOVA / ALPHA - Correção do bloqueio Vercel
=========================================
Motivo: Next.js 15.1.7 vulnerável, bloqueado pela Vercel.
Correção: atualização para Next.js 15.5.28 (versão que inclui patches de segurança).

Copie corrigir-alpha.ps1 para a raiz do projeto ALPHA e rode no PowerShell:
  powershell -ExecutionPolicy Bypass -File .\corrigir-alpha.ps1

Se concluir com sucesso, faça commit APENAS de package.json e package-lock.json e envie ao GitHub.
Não inclui chaves, dados bancários ou alterações dos módulos financeiros.
A compilação local não garante a execução segura do banco ou das rotas. Mantenha o Preview protegido.
Fonte: https://nextjs-changelog.vercel.app/ (15.5.28, outubro 2026).
