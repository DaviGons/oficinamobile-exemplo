# OFICINAMOBILE — SantSystem no celular

<!-- aviso-repositorio -->
> **Versão pública de demonstração.** O projeto roda em produção numa oficina mecânica; aqui os nomes, IPs,
> CPF, telefones, placas e fornecedores foram trocados por exemplos fictícios. O código é o mesmo da versão
> real, mantida num repositório privado.
<!-- /aviso-repositorio -->

App Android + API que operam as ordens de serviço da **Oficina Exemplo** direto no banco do SantSystem
(SQL Server 2014 do PC `SERVIDOR-OFICINA`), sem passar pelo programa no PC. Inclui uma pasta pronta para o
**Claude trabalhar no próprio PC da oficina**.

```
Celular (APK)  ──Wi-Fi──>  API Node (PC SERVIDOR-OFICINA :3333)  ──>  SQL Server localhost:1433 / dadosretorno
Claude no PC   ──────────> consultar.cmd (só leitura) e api.ps1 (grava pela API)
```

As gravações repetem exatamente o que o SantSystem faz — veja [docs/RECEITAS.md](docs/RECEITAS.md)
(capturado com Extended Events em 07/10/2026).

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [docs/BANCO-DE-DADOS.md](docs/BANCO-DE-DADOS.md) | Como o banco funciona e como acessar (tabelas, convenções, consultas) |
| [docs/RECEITAS.md](docs/RECEITAS.md) | Como o SantSystem grava cada operação |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Como cada parte lê cada parte (`.env`, logins, portas, atualização) |
| [CLAUDE.md](CLAUDE.md) | Instruções para o Claude no notebook |
| [claude-pc-oficina/](claude-pc-oficina/) | Pasta que vira `C:\OficinaOS\claude` (Claude no PC da oficina) |

## O que o app faz (versão 1.0.4)

- Lista OS abertas/finalizadas; busca por placa, cliente ou número
- **Nova OS pela placa** (formato antigo ou Mercosul): carro conhecido puxa veículo e cliente, KM em branco;
  placa nova abre em branco, inclusive sem cliente (definir o cliente depois, dentro da OS)
- Lançar e alterar peças (calculadora preço seco − desconto = custo; custo + margem = venda) e serviços
- Cadastrar e editar clientes (endereço pelo CEP)
- Excluir OS (exclusão lógica)
- **Gerar PDF** da OS para o cliente (sem observações e sem custos)

Também consulta preços (peças com venda, custo e estoque; serviços), remove peça e serviço da OS e escolhe
marca/modelo das listas do SantSystem (o que não está na lista some da tela de OS do SantSystem).
Ainda **não** faz: finalizar/receber no caixa, desconto. OS finalizada é só leitura.

## Pastas

```
api/                   API Node (express + mssql) — src/ e scripts/ (consultar.js, criar-login.js)
app/                   app Expo SDK 57 (APK)
docs/                  documentação
instalador-windows/    INSTALAR.cmd / DESINSTALAR.cmd / scripts PowerShell / empacotar.sh
claude-pc-oficina/     CLAUDE.md, consultar.cmd, api.ps1 e consultas/ para o Claude no PC
captura/kit-windows/   captura do SQL do SantSystem (rodar no PC)
captura/ferramentas/   extração, resumo e diff das capturas (notebook)
scripts/               salvar-senha.sh, finalizar-organizacao.sh
dados/                 (fora do git) estrutura do banco e capturas brutas, com dados de clientes
```

## No notebook (desenvolvimento)

Pré-requisito: Wi-Fi `OFICINA-WIFI`.

1. Senha do `sa` (uma vez): `bash scripts/salvar-senha.sh` → `~/.config/oficinamobile/senha-sa`
2. Consultar o banco: `node --env-file=api/.env api/scripts/consultar.js consulta.sql`
3. API local: `cd api && npm run dev` (porta 3333)
4. App no Expo Go: `cd app && npx expo start --lan` (portas liberadas por `~/Projects/linux-setup/07-portas-santsystem.sh`)

## PC da oficina (produção)

1. `bash instalador-windows/empacotar.sh` (Linux) ou
   `powershell -ExecutionPolicy Bypass -File instalador-windows\empacotar.ps1` (Windows) → `Downloads\OficinaMobile-Windows.zip`
2. No PC: extrair e rodar `INSTALAR.cmd` (pede administrador; a senha do `sa` só se faltar criar login).
3. Instala a API em `C:\OficinaOS\api` (tarefa "Oficina OS - API", porta 3333 na rede local, login `app_oficina`)
   e a pasta do Claude em `C:\OficinaOS\claude` (login só leitura `claude_leitura`).
4. App: `http://192.168.0.10:3333` (padrão). Log: `C:\OficinaOS\api.log`.

Para atualizar, gerar o pacote de novo e rodar `INSTALAR.cmd` (mantém logins e senhas).

## Gerar o APK

Local, sem conta Expo (Android SDK em `~/Android/Sdk`, JDK 21). Antes, subir `version` e `versionCode` em `app/app.json`.

```
cd app && ANDROID_HOME=~/Android/Sdk npx expo prebuild --platform android
cd android && ANDROID_HOME=~/Android/Sdk ./gradlew assembleRelease
# -> app/android/app/build/outputs/apk/release/app-release.apk (assinado com a chave de debug)
```

No PC da oficina (Windows, JDK 21 Temurin e SDK em `%LOCALAPPDATA%\Android\Sdk`, instalados em 19/10/2026):

```powershell
$env:JAVA_HOME = (Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory | Where-Object Name -like 'jdk-21*')[0].FullName
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"; $env:CI = '1'
cd app; npx expo prebuild --platform android --no-install
cd android; .\gradlew.bat assembleRelease
```

## Cuidados

- **Não edite a mesma OS no PC e no celular ao mesmo tempo** (o SantSystem regrava a OS inteira ao salvar).
- `?ensaio=1` em qualquer gravação da API executa tudo e desfaz, devolvendo a prévia das linhas.
- `dados/` e os `.env` ficam fora do git; nunca mostrar senhas ou o token.
