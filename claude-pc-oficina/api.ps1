# Chama a API do OficinaMobile (a mesma do app) com o token do .env desta pasta.
# Exemplos:
#   .\api.ps1 -Rota /os/15305
#   .\api.ps1 -Metodo POST -Rota /os/15305/pecas -Corpo '{"codigo":"640","quantidade":2}' -Ensaio
param(
  [ValidateSet('GET', 'POST', 'PATCH', 'DELETE')] [string] $Metodo = 'GET',
  [Parameter(Mandatory = $true)] [string] $Rota,
  [string] $Corpo,
  [switch] $Ensaio
)
$ErrorActionPreference = 'Stop'

$cfg = @{}
foreach ($linha in Get-Content (Join-Path $PSScriptRoot '.env')) {
  if ($linha -match '^\s*([A-Z_]+)=(.*)$') { $cfg[$Matches[1]] = $Matches[2].Trim() }
}
$base = if ($cfg.API_URL) { $cfg.API_URL } else { 'http://localhost:3333' }
$url = $base + $Rota
if ($Ensaio) { $url += $(if ($url.Contains('?')) { '&' } else { '?' }) + 'ensaio=1' }

$params = @{ Uri = $url; Method = $Metodo; Headers = @{ 'x-token' = $cfg.APP_TOKEN }; TimeoutSec = 30 }
if ($Corpo) {
  $params.ContentType = 'application/json; charset=utf-8'
  $params.Body = [Text.Encoding]::UTF8.GetBytes($Corpo)
}
try {
  $resposta = Invoke-RestMethod @params
  $resposta | ConvertTo-Json -Depth 10
} catch {
  $corpoErro = $null
  if ($_.Exception.Response) {
    $leitor = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
    $corpoErro = $leitor.ReadToEnd()
  }
  Write-Output "ERRO: $($_.Exception.Message) $corpoErro"
  exit 1
}
