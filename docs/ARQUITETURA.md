# Arquitetura do OficinaMobile — como cada parte lê cada parte

## Visão geral

```
                    Wi-Fi OFICINA-WIFI (192.168.0.x)
 ┌──────────────┐   http :3333 + x-token   ┌───────────────────────── PC SERVIDOR-OFICINA (Windows 11) ─────────┐
 │ Celular      │ ───────────────────────> │ API Node  C:\OficinaOS\api   (tarefa "Oficina OS - API")    │
 │ APK Oficina  │                          │   └─ login app_oficina ──> SQL Server localhost:1433        │
 └──────────────┘                          │                              banco dadosretorno             │
                                           │ Claude Code  C:\OficinaOS\claude                            │
                                           │   ├─ consultar.cmd ─ login claude_leitura (só leitura) ──>  │
                                           │   └─ api.ps1 ─────── http localhost:3333 + x-token ──> API  │
                                           │ SantSystem (MDIPAF) + MonitorSantSystem ── login sa ──>     │
                                           └─────────────────────────────────────────────────────────────┘
 ┌─ Notebook (desenvolvimento) ─────────────────────────────────────────────────────────┐
 │ ~/Projects/OFICINAMOBILE: código, docs, build do APK, pacote do Windows              │
 │ api/ (npm run dev, porta 3333) e scripts ── login sa (senha em ~/.config/...) ──> PC │
 └──────────────────────────────────────────────────────────────────────────────────────┘
```

## Quem lê o quê

| Peça | Lê | De onde |
|---|---|---|
| **App** (celular) | endereço da API, token, funcionário | armazenamento do app (`AsyncStorage`, chave `santsystem:config`), preenchido na tela Ajustes. Padrão: `http://192.168.0.10:3333` (`app/src/telas/Config.tsx`) |
| **API** | `APP_TOKEN`, `PORTA`, `DB_SERVIDOR`, `DB_PORTA`, `DB_USUARIO`, `DB_SENHA`, `DB_BANCO`, `LOG_ARQUIVO` | `.env` da pasta da API (`node --env-file=.env`) |
| **API — senha do banco** | `DB_SENHA`; se faltar, arquivo | `DB_SENHA_ARQUIVO` ou `~/.config/oficinamobile/senha-sa` (antigo: `~/.config/santsystem-sa`) — `api/src/db.js` |
| **API — prefixo dos identificadores** | `ConfigSis.cp5` (`VERSAO`) | banco, na primeira gravação |
| `api/scripts/consultar.js` | conexão da API | o `.env` passado em `--env-file` |
| `api/scripts/criar-login.js` | `SA_SENHA`, `APP_LOGIN`, `APP_SENHA`, `APP_SO_LEITURA` | variáveis de ambiente (o instalador preenche) |
| **Claude no PC** | `DB_USUARIO=claude_leitura`, `DB_SENHA`, `API_URL`, `APP_TOKEN` | `C:\OficinaOS\claude\.env` |
| `instalador-windows/empacotar.sh` | `APP_TOKEN` | `api/.env` do notebook → grava `api/app-token.txt` dentro do zip |
| `instalar.ps1` (no PC) | token, senha do `sa` digitada uma vez | `api\app-token.txt` do pacote; gera `C:\OficinaOS\api\.env` e `C:\OficinaOS\claude\.env` |
| `captura/ferramentas/*` | senha do `sa` | `~/.config/oficinamobile/senha-sa`; grava em `dados/` |

O **token (`APP_TOKEN`) é um só**: o mesmo no `api/.env` do notebook, no `.env` da API e do Claude no PC e no app.

## Os `.env`

**Notebook — `api/.env`** (fora do git, permissão 600)
```
APP_TOKEN=…            PORTA=3333
DB_SERVIDOR=192.168.0.10  DB_PORTA=1433  DB_USUARIO=sa  DB_BANCO=dadosretorno
# senha: ~/.config/oficinamobile/senha-sa (scripts/salvar-senha.sh)
```

**PC — `C:\OficinaOS\api\.env`** (só SYSTEM e administradores)
```
APP_TOKEN=…  PORTA=3333  DB_SERVIDOR=localhost  DB_PORTA=1433
DB_USUARIO=app_oficina  DB_SENHA=…  DB_BANCO=dadosretorno  LOG_ARQUIVO=C:\OficinaOS\api.log
```

**PC — `C:\OficinaOS\claude\.env`** (SYSTEM, administradores e o usuário que instalou)
```
DB_SERVIDOR=localhost  DB_PORTA=1433  DB_USUARIO=claude_leitura  DB_SENHA=…  DB_BANCO=dadosretorno
API_URL=http://localhost:3333  APP_TOKEN=…
```

## Logins do SQL Server

| Login | Permissão | Usado por |
|---|---|---|
| `sa` | tudo | SantSystem, MonitorSantSystem, notebook (desenvolvimento) |
| `app_oficina` | `db_datareader` + `db_datawriter` no `dadosretorno` | API no PC |
| `claude_leitura` | `db_datareader` no `dadosretorno` | Claude no PC (`consultar.cmd`) |

## Portas e firewall

| Onde | Porta | Regra |
|---|---|---|
| PC SERVIDOR-OFICINA | 1433 (SQL) | já aberta pelo SantSystem |
| PC SERVIDOR-OFICINA | 3333 (API) | "Oficina OS - API", só rede local (`LocalSubnet`) |
| Notebook | 3333 (API dev), 8081 (Expo) | firewalld, só 192.168.0.0/24 (`~/Projects/linux-setup/07-portas-santsystem.sh`) |

## Como atualizar cada parte

| Parte | Como |
|---|---|
| **API no PC** | `bash instalador-windows/empacotar.sh` (Linux) ou `instalador-windows\empacotar.ps1` (Windows) → `Downloads\OficinaMobile-Windows.zip` → no PC, extrair e rodar `INSTALAR.cmd` (mantém logins e senhas) |
| **Pasta do Claude no PC** | vai junto no mesmo pacote (`claude-pc-oficina/` + `docs/`) |
| **App** | subir `version`/`versionCode` em `app/app.json` → `npx expo prebuild --platform android` → `./gradlew assembleRelease` (ver README) |
| **Docs** | editar `docs/` (o pacote copia para o PC) |

## Pastas do projeto

```
OFICINAMOBILE/
├── CLAUDE.md                 instruções para o Claude no notebook (desenvolvimento)
├── README.md                 visão geral e como rodar
├── docs/                     BANCO-DE-DADOS.md, RECEITAS.md, ARQUITETURA.md (este)
├── api/                      API Node (express + mssql)
│   ├── src/                  servidor.js, rotas.js, clientes.js, veiculos.js, db.js, formato.js
│   └── scripts/              consultar.js, criar-login.js
├── app/                      app Expo SDK 57 (APK)
├── instalador-windows/       INSTALAR.cmd, DESINSTALAR.cmd, scripts/*.ps1, empacotar.sh
├── claude-pc-oficina/        pasta que vira C:\OficinaOS\claude (CLAUDE.md, consultar.cmd, api.ps1, consultas/)
├── captura/
│   ├── kit-windows/          captura do SQL do SantSystem rodada no PC (capturar.bat)
│   └── ferramentas/          extração, resumo e diff das capturas (notebook)
├── scripts/                  salvar-senha.sh, finalizar-organizacao.sh
└── dados/                    (fora do git) estrutura do banco e capturas brutas — tem dados de clientes
```
