@echo off
setlocal
cd /d "%~dp0"
title Captura SantSystem

where sqlcmd >nul 2>nul
if errorlevel 1 (
    echo sqlcmd nao encontrado. Ele vem com o SQL Server.
    echo Procure SQLCMD.EXE em "C:\Program Files\Microsoft SQL Server\" e avise.
    pause
    exit /b 1
)

echo ============================================================
echo  CAPTURA DO SANTSYSTEM - nao altera nenhum dado
echo ============================================================
echo.
echo Digite a senha do usuario sa (esta no C:\Gerente\SANTSYSTEM.ini)
set /p SQLCMDPASSWORD=Senha:
cls

set "CON=-S localhost -U sa -b"

sqlcmd %CON% -d master -i "1-iniciar-captura.sql"
if errorlevel 1 goto erro

:menu
echo.
echo ------------------------------------------------------------
echo  Escreva o nome da etapa que voce VAI fazer agora no SantSystem
echo  (ex: abrir OS, lancar peca, lancar servico, fechar OS)
echo  Use so letras e numeros. Quando acabar tudo, escreva FIM.
echo ------------------------------------------------------------
set "ETAPA="
set /p ETAPA=Etapa:
if not defined ETAPA goto menu
if /i "%ETAPA%"=="FIM" goto fim
set "ETAPA=%ETAPA:'=%"
sqlcmd %CON% -d dadosretorno -Q "SELECT N'MARCA: %ETAPA%'" >nul
if errorlevel 1 goto erro
echo.
echo  Marcado: %ETAPA%
echo  Agora faca essa etapa no SantSystem, salve, e volte aqui.
goto menu

:fim
echo.
echo Gerando arquivos, aguarde...
sqlcmd %CON% -d master -i "2-exportar-captura.sql" -o "captura.txt" -f 65001 -y 0 -h -1
if errorlevel 1 goto erro
sqlcmd %CON% -d dadosretorno -i "3-exportar-estrutura.sql" -o "estrutura-dadosretorno.txt" -f 65001 -y 0 -h -1
if errorlevel 1 goto erro
sqlcmd %CON% -d dadospaf -i "3-exportar-estrutura.sql" -o "estrutura-dadospaf.txt" -f 65001 -y 0 -h -1
if errorlevel 1 goto erro
set "SQLCMDPASSWORD="
echo.
echo Pronto! Foram criados nesta pasta:
echo   captura.txt
echo   estrutura-dadosretorno.txt
echo   estrutura-dadospaf.txt
echo Copie os tres para o notebook.
pause
exit /b 0

:erro
set "SQLCMDPASSWORD="
echo.
echo DEU ERRO. Tire uma foto desta tela e mande.
pause
exit /b 1
