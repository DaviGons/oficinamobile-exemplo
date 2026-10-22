# Guarda a senha do sa do SantSystem num arquivo que so o seu usuario le
# (%USERPROFILE%\.config\oficinamobile\senha-sa, usado pela API e pelos scripts).
# Versao Windows do salvar-senha.sh. A senha nao aparece na tela.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\salvar-senha.ps1
$ErrorActionPreference = 'Stop'
$pasta = Join-Path $HOME '.config\oficinamobile'
$arq = Join-Path $pasta 'senha-sa'

$seguro = Read-Host 'Senha do sa (nao aparece enquanto digita)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
try { $senha = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
if (-not $senha) { throw 'Senha vazia, nada foi salvo.' }

New-Item -ItemType Directory -Force -Path $pasta | Out-Null
[IO.File]::WriteAllText($arq, $senha, (New-Object Text.UTF8Encoding $false))
$senha = $null

# So o seu usuario le o arquivo (tira a heranca de permissoes)
$usuario = [Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls $arq /inheritance:r /grant:r "${usuario}:F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel proteger $arq." }

Write-Host "Senha salva em $arq. Pode voltar para o Claude." -ForegroundColor Green
