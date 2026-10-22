# Instala o OficinaMobile neste PC (o servidor do SantSystem).
# - Instala o Node.js (winget) se precisar
# - Copia a API para C:\OficinaOS\api e a pasta do Claude para C:\OficinaOS\claude
# - Cria os logins no SQL Server: app_oficina (API: le/grava) e claude_leitura (Claude: so le),
#   ambos so no banco dadosretorno
# - Libera a porta 3333 no firewall so para a rede local
# - Cria a tarefa agendada que liga a API junto com o Windows
# Rodar pelo INSTALAR.cmd (pede permissao de administrador).
# Os nomes C:\OficinaOS e "Oficina OS - API" ficaram da primeira versao (ja instalada).

$ErrorActionPreference = 'Stop'
$Pacote = Split-Path -Parent $PSScriptRoot
$Destino = 'C:\OficinaOS'
$Api = Join-Path $Destino 'api'
$Claude = Join-Path $Destino 'claude'
$Porta = 3333
$Tarefa = 'Oficina OS - API'
$Login = 'app_oficina'
$LoginClaude = 'claude_leitura'

function Passo($texto) { Write-Host ''; Write-Host "==> $texto" -ForegroundColor Cyan }
function Ok($texto) { Write-Host "    OK: $texto" -ForegroundColor Green }

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw 'Rode pelo INSTALAR.cmd e aceite a permissao de administrador.' }

# 1) Node.js
Passo 'Node.js'
function Achar-Node {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $padrao = Join-Path $env:ProgramFiles 'nodejs\node.exe'
  if (Test-Path $padrao) { return $padrao }
  return $null
}
$Node = Achar-Node
if (-not $Node) {
  Write-Host '    Instalando o Node.js LTS pelo winget (alguns minutos)...'
  winget install --id OpenJS.NodeJS.LTS --exact --silent --scope machine --accept-package-agreements --accept-source-agreements
  $Node = Achar-Node
  if (-not $Node) { throw 'Nao achei o Node.js depois da instalacao. Instale pelo site nodejs.org (versao LTS) e rode de novo.' }
}
$versao = & $Node --version
$maior = [int]($versao.TrimStart('v').Split('.')[0])
if ($maior -lt 20) { throw "Node.js $versao e antigo demais (precisa 20 ou mais novo). Atualize pelo nodejs.org." }
Ok "Node.js $versao em $Node"

# 2) Arquivos da API (para a tarefa antes de copiar, se ja existir)
Passo "Copiando a API para $Api"
if (Get-ScheduledTask -TaskName $Tarefa -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $Tarefa -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}
New-Item -ItemType Directory -Force -Path $Api | Out-Null
robocopy (Join-Path $Pacote 'api') $Api /MIR /XF .env app-token.txt /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar os arquivos (robocopy $LASTEXITCODE)." }
Ok 'arquivos copiados'

# Senha do sa: pedida no maximo uma vez, e so se precisar criar algum login
$script:senhaSa = $null
function Senha-Sa {
  if (-not $script:senhaSa) {
    Write-Host '    Preciso da senha do usuario sa (esta no C:\Gerente\SANTSYSTEM.ini) so para criar os logins.'
    Write-Host '    Ela nao fica gravada em lugar nenhum.'
    $seguro = Read-Host '    Senha do sa' -AsSecureString
    $script:senhaSa = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
      [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro))
  }
  return $script:senhaSa
}
function Nova-Senha {
  $bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return 'Of' + (([Convert]::ToBase64String($bytes)) -replace '[^A-Za-z0-9]', '') + '7x'
}
function Senha-Do-Env($arquivo) {
  if (-not (Test-Path $arquivo)) { return $null }
  $linha = Select-String -Path $arquivo -Pattern '^DB_SENHA=(.+)$' | Select-Object -First 1
  if ($linha) { return $linha.Matches[0].Groups[1].Value.Trim() }
  return $null
}
# Cria o login no SQL Server (ou troca a senha) com o script da API
function Criar-Login($login, $senha, [switch]$SoLeitura) {
  $env:SA_SENHA = Senha-Sa
  $env:APP_LOGIN = $login
  $env:APP_SENHA = $senha
  if ($SoLeitura) { $env:APP_SO_LEITURA = '1' }
  Push-Location $Api
  try {
    & $Node scripts\criar-login.js
    if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel criar o login $login (senha do sa errada?)." }
  } finally {
    Pop-Location
    Remove-Item Env:SA_SENHA, Env:APP_SENHA, Env:APP_LOGIN, Env:APP_SO_LEITURA -ErrorAction SilentlyContinue
  }
}
# So o Windows (SYSTEM), administradores e quem mais for passado leem o arquivo.
# SIDs fixos: funciona com Windows em portugues ou ingles.
function Proteger($arquivo, $extras) {
  $permissoes = @('*S-1-5-18:F', '*S-1-5-32-544:F') + $extras
  icacls $arquivo /inheritance:r /grant:r @permissoes | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel proteger $arquivo." }
}

# 3) Login da API no SQL Server + .env da API
Passo "Login $Login no SQL Server (API)"
$envArquivo = Join-Path $Api '.env'
$token = (Get-Content (Join-Path $Pacote 'api\app-token.txt') -Raw).Trim()
$senhaApp = Senha-Do-Env $envArquivo
if ($senhaApp) {
  Ok 'login ja configurado numa instalacao anterior (mantido)'
} else {
  $senhaApp = Nova-Senha
  Criar-Login $Login $senhaApp
}
@(
  "APP_TOKEN=$token",
  "PORTA=$Porta",
  'DB_SERVIDOR=localhost',
  'DB_PORTA=1433',
  "DB_USUARIO=$Login",
  "DB_SENHA=$senhaApp",
  'DB_BANCO=dadosretorno',
  "LOG_ARQUIVO=$Destino\api.log"
) | Set-Content -Path $envArquivo -Encoding ASCII
Proteger $envArquivo @()
Ok 'arquivo .env da API protegido (so Windows e administradores)'

# 3b) Pasta do Claude (C:\OficinaOS\claude) + login so leitura
Passo "Pasta do Claude ($Claude) e login $LoginClaude (so leitura)"
New-Item -ItemType Directory -Force -Path $Claude | Out-Null
robocopy (Join-Path $Pacote 'claude') $Claude /MIR /XF .env /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar a pasta do Claude (robocopy $LASTEXITCODE)." }
$envClaude = Join-Path $Claude '.env'
$senhaClaude = Senha-Do-Env $envClaude
if ($senhaClaude) {
  Ok 'login so leitura ja configurado numa instalacao anterior (mantido)'
} else {
  $senhaClaude = Nova-Senha
  Criar-Login $LoginClaude $senhaClaude -SoLeitura
}
@(
  'DB_SERVIDOR=localhost',
  'DB_PORTA=1433',
  "DB_USUARIO=$LoginClaude",
  "DB_SENHA=$senhaClaude",
  'DB_BANCO=dadosretorno',
  "API_URL=http://localhost:$Porta",
  "APP_TOKEN=$token"
) | Set-Content -Path $envClaude -Encoding ASCII
# O Claude roda com o usuario do Windows que instalou: ele tambem precisa ler o .env
$usuario = [Security.Principal.WindowsIdentity]::GetCurrent().Name
Proteger $envClaude @("${usuario}:R")
Ok "pasta pronta; .env legivel por $usuario"

# 4) Firewall: porta 3333 so para a rede local (o Wi-Fi esta como rede Publica)
Passo "Firewall (porta $Porta)"
Get-NetFirewallRule -DisplayName 'Oficina OS - API' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'Oficina OS - API' -Direction Inbound -Protocol TCP -LocalPort $Porta `
  -RemoteAddress LocalSubnet -Action Allow -Profile Any | Out-Null
Ok 'porta liberada so para a rede local'

# 5) Tarefa agendada: liga com o Windows (sem precisar de login) e religa se cair
Passo 'Tarefa para ligar junto com o Windows'
$acao = New-ScheduledTaskAction -Execute $Node -Argument '--env-file=.env src\servidor.js' -WorkingDirectory $Api
$gatilho = New-ScheduledTaskTrigger -AtStartup
$usuario = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$config = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $Tarefa -Action $acao -Trigger $gatilho -Principal $usuario -Settings $config `
  -Description 'API do app Oficina OS (celular) para o banco do SantSystem' -Force | Out-Null
Start-ScheduledTask -TaskName $Tarefa
Ok 'tarefa criada e iniciada'

# 6) Teste
Passo 'Testando a API'
$resposta = $null
for ($i = 0; $i -lt 15 -and -not $resposta; $i++) {
  Start-Sleep -Seconds 2
  try {
    $resposta = Invoke-RestMethod -Uri "http://localhost:$Porta/saude" -Headers @{ 'x-token' = $token } -TimeoutSec 5
  } catch { }
}
if (-not $resposta) { throw "A API nao respondeu. Veja o log em $Destino\api.log" }
Ok "API respondendo (servidor $($resposta.servidor), banco $($resposta.banco))"

$ips = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -ExpandProperty IPAddress
Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host ' PRONTO! A API liga sozinha sempre que o PC ligar.' -ForegroundColor Green
Write-Host ' No app, em Ajustes, use o endereco:' -ForegroundColor Green
foreach ($ip in $ips) { Write-Host "     http://${ip}:$Porta" -ForegroundColor Yellow }
Write-Host " Claude neste PC: abra o Claude Code em $Claude (veja LEIA-ME.md la)." -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
