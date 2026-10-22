@echo off
rem Consulta o banco do SantSystem com o login SO LEITURA (claude_leitura).
rem Uso: consultar.cmd arquivo.sql [--json]
if "%~1"=="" (
    echo Uso: consultar.cmd arquivo.sql [--json]
    exit /b 1
)
node --env-file="%~dp0.env" "C:\OficinaOS\api\scripts\consultar.js" %*
