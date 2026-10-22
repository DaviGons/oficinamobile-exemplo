# Claude no PC da oficina — como deixar pronto

Esta pasta (`C:\OficinaOS\claude`) é instalada pelo `INSTALAR.cmd` do pacote OficinaMobile, junto com a API.
Ela tem tudo de que o Claude precisa para consultar o banco e lançar OS/orçamentos com segurança.

## O que tem aqui

| Arquivo | Para quê |
|---|---|
| `CLAUDE.md` | Instruções que o Claude lê sozinho ao abrir nesta pasta (regras da oficina e do banco) |
| `docs\BANCO-DE-DADOS.md` | Como o banco do SantSystem funciona: tabelas, convenções, consultas |
| `docs\RECEITAS.md` | Como o SantSystem grava cada operação (capturado do uso real) |
| `docs\ARQUITETURA.md` | Como app, API, banco e instaladores se conectam |
| `consultar.cmd` | Roda um `.sql` com o login **só leitura** `claude_leitura` |
| `api.ps1` | Chama a API (a mesma do app) para gravar com as receitas do SantSystem |
| `consultas\` | Consultas prontas (OS abertas, detalhe, placa, cliente, peça, faturamento) |
| `.env` | Login só leitura + token da API. Criado pelo instalador; só o seu usuário e administradores leem |

## Instalar o Claude Code neste PC

1. Abra o **PowerShell** (não precisa ser administrador) e rode o instalador oficial:
   `irm https://claude.ai/install.ps1 | iex`
   (se pedir, instale também o **Git para Windows**). Guia oficial: https://docs.claude.com/en/docs/claude-code/setup
2. Entre na pasta e abra o Claude:
   ```
   cd C:\OficinaOS\claude
   claude
   ```
   Na primeira vez ele pede o login da sua conta Claude e se confia na pasta: confie em `C:\OficinaOS\claude`.
3. Para usar **de longe** (celular ou notebook), ative o controle remoto do Claude Code nessa sessão
   (Remote Control / claude.ai/code). Veja a documentação oficial do Claude Code para o passo atual.

## Teste rápido (peça ao Claude ou rode você)

```
.\consultar.cmd consultas\os-abertas.sql
powershell -ExecutionPolicy Bypass -File .\api.ps1 -Rota /saude
```

## Segurança

- O Claude aqui **não usa o `sa`**: lê com `claude_leitura` (só leitura) e grava **só pela API**, que segue as
  receitas do SantSystem e tem modo ensaio.
- Ele não deve mexer em SQL Server, firewall, serviços, SantSystem (`C:\Gerente`) nem reiniciar o PC
  (está no `CLAUDE.md`). Mesmo assim, este PC é o servidor da oficina: acompanhe o que ele faz e negue
  qualquer pedido de permissão que pareça mexer fora desta pasta.
- Para tirar o acesso do Claude: apague `C:\OficinaOS\claude\.env` (e, no SSMS, `DROP LOGIN claude_leitura`).
