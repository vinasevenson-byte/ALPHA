$ErrorActionPreference = 'Stop'
if (-not (Test-Path 'package.json')) { throw 'Execute este script na raiz do repositorio ALPHA.' }
$package = Get-Content package.json -Raw | ConvertFrom-Json
if ($package.name -ne 'nova-plataforma-financeira') { throw 'Este diretorio nao parece ser o projeto NOVA/ALPHA.' }
Write-Host 'Atualizando Next.js para versao corrigida 15.5.28...' -ForegroundColor Cyan
npm install next@15.5.28 --save-exact
if ($LASTEXITCODE -ne 0) { throw 'Falha na instalacao do Next.js.' }
Write-Host 'Gerando cliente Prisma...' -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) { throw 'Falha na geracao do Prisma Client.' }
Write-Host 'Verificando build...' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Falha no build. Revise o log antes de realizar commit.' }
Write-Host 'Verificando alteracoes...' -ForegroundColor Cyan
git diff -- package.json package-lock.json
Write-Host 'Build concluido. Para publicar, execute:' -ForegroundColor Green
Write-Host 'git add package.json package-lock.json'
Write-Host 'git commit -m "fix: atualizar Next.js por seguranca"'
Write-Host 'git push origin main'
