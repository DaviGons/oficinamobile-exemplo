# Remove o OficinaMobile deste PC: tarefa agendada, regra de firewall e a pasta
# C:\OficinaOS (API e pasta do Claude). Os logins app_oficina e claude_leitura do
# SQL Server ficam (nao atrapalham o SantSystem).
$ErrorActionPreference = 'Continue'
$Tarefa = 'Oficina OS - API'

if (Get-ScheduledTask -TaskName $Tarefa -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $Tarefa
  Unregister-ScheduledTask -TaskName $Tarefa -Confirm:$false
  Write-Host 'Tarefa removida.'
}
Get-NetFirewallRule -DisplayName 'Oficina OS - API' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Write-Host 'Regra de firewall removida.'
Start-Sleep -Seconds 2
if (Test-Path 'C:\OficinaOS') {
  Remove-Item 'C:\OficinaOS' -Recurse -Force
  Write-Host 'Pasta C:\OficinaOS removida.'
}
Write-Host ''
Write-Host 'Pronto. Para tirar tambem os logins do SQL Server, no SSMS:'
Write-Host '  DROP LOGIN app_oficina; DROP LOGIN claude_leitura'
