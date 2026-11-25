$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path 'backend/.env')) { Copy-Item 'backend/.env.example' 'backend/.env' }
docker compose build app
if ($LASTEXITCODE) { throw 'Docker build thất bại' }
docker compose run --rm app composer install --no-interaction --prefer-dist
if ($LASTEXITCODE) { throw 'Composer install thất bại' }
if ((Get-Content -Raw 'backend/.env') -match '(?m)^APP_KEY=\s*$') {
 docker compose run --rm app php artisan key:generate --no-interaction
 if ($LASTEXITCODE) { throw 'Không tạo được APP_KEY' }
}
docker compose run --rm app php artisan migrate --seed --force
if ($LASTEXITCODE) { throw 'Migration thất bại' }
docker compose run --rm app php artisan storage:link
docker compose up -d --build
if ($LASTEXITCODE) { throw 'Không khởi động được dịch vụ' }
Write-Host 'Zentea: http://localhost:5173 | Admin: http://localhost:5173/admin'
