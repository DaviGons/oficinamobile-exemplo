# Monta o pacote do OficinaMobile para o PC da oficina (Windows) - versao PowerShell do empacotar.sh:
#   API (com dependencias) + pasta do Claude (claude-pc-oficina/ + docs/) + instalador
# Saida: %USERPROFILE%\Downloads\OficinaMobile-Windows.zip
# Uso: powershell -ExecutionPolicy Bypass -File instalador-windows\empacotar.ps1 [arquivo.zip]
param([string] $Saida = (Join-Path $HOME 'Downloads\OficinaMobile-Windows.zip'))
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$temp = Join-Path ([IO.Path]::GetTempPath()) ("oficinamobile-" + [guid]::NewGuid().ToString('N'))
$pacote = Join-Path $temp 'OficinaMobile'
try {
  # Instalador
  New-Item -ItemType Directory -Force -Path (Join-Path $pacote 'api'), (Join-Path $pacote 'claude\docs') | Out-Null
  Copy-Item -Recurse (Join-Path $raiz 'instalador-windows\scripts') $pacote
  foreach ($f in 'INSTALAR.cmd', 'DESINSTALAR.cmd', 'LEIA-ME.txt') { Copy-Item (Join-Path $raiz "instalador-windows\$f") $pacote }

  # API (so dependencias de producao, todas em JavaScript)
  foreach ($f in 'src', 'scripts', 'package.json', 'package-lock.json') {
    Copy-Item -Recurse (Join-Path $raiz "api\$f") (Join-Path $pacote 'api')
  }
  Push-Location (Join-Path $pacote 'api')
  try {
    & npm.cmd ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error
    if ($LASTEXITCODE -ne 0) { throw "npm ci falhou ($LASTEXITCODE)" }
  } finally { Pop-Location }
  if (Get-ChildItem -Recurse -Filter '*.node' (Join-Path $pacote 'api\node_modules')) {
    throw 'Ha modulo nativo em node_modules (pode nao funcionar no PC da oficina)'
  }

  # Codigo de acesso do app (o mesmo do api\.env, para o app nao precisar mudar)
  $linha = Get-Content (Join-Path $raiz 'api\.env') | Where-Object { $_ -match '^APP_TOKEN=' } | Select-Object -First 1
  if (-not $linha) { throw 'APP_TOKEN nao encontrado em api\.env' }
  [IO.File]::WriteAllText((Join-Path $pacote 'api\app-token.txt'), ($linha -replace '^APP_TOKEN=', '').Trim())

  # Pasta do Claude no PC (vira C:\OficinaOS\claude) com a documentacao do projeto
  Copy-Item -Recurse -Force (Join-Path $raiz 'claude-pc-oficina\*') (Join-Path $pacote 'claude')
  Copy-Item (Join-Path $raiz 'docs\*.md') (Join-Path $pacote 'claude\docs')

  # Quebra de linha do Windows nos scripts
  $arquivos = @(Get-ChildItem $pacote -File | Where-Object { $_.Extension -in '.cmd', '.txt' }) +
    @(Get-ChildItem (Join-Path $pacote 'scripts') -Filter '*.ps1') +
    @(Get-ChildItem (Join-Path $pacote 'claude') -File | Where-Object { $_.Extension -in '.cmd', '.ps1' })
  foreach ($a in $arquivos) {
    $bytes = [IO.File]::ReadAllBytes($a.FullName)
    $texto = [Text.Encoding]::UTF8.GetString($bytes) -replace "`r`n", "`n" -replace "`n", "`r`n"
    [IO.File]::WriteAllBytes($a.FullName, [Text.Encoding]::UTF8.GetBytes($texto))
  }

  if (Test-Path $Saida) { Remove-Item $Saida -Force }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Saida) | Out-Null
  Push-Location $temp
  try {
    & "$env:SystemRoot\System32\tar.exe" -a -cf $Saida OficinaMobile
    if ($LASTEXITCODE -ne 0) { throw "tar falhou ($LASTEXITCODE)" }
  } finally { Pop-Location }
  $mb = [math]::Round((Get-Item $Saida).Length / 1MB, 1)
  Write-Host "Pacote: $Saida ($mb MB)"
} finally {
  Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue
}
