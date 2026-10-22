# OFICINAMOBILE (notebook — desenvolvimento)

Projeto da Oficina Exemplo: app Android + API Node que operam direto o banco do SantSystem
(SQL Server 2014 no PC SERVIDOR-OFICINA, 192.168.0.10:1433, banco `dadosretorno`).
Para o Claude que roda **no PC da oficina**, as instruções ficam em `claude-pc-oficina/CLAUDE.md`.

- Fale em português do Brasil, simples e direto.
- **Antes de consultar ou gravar no banco, leia [`docs/BANCO-DE-DADOS.md`](docs/BANCO-DE-DADOS.md)**; para gravar,
  [`docs/RECEITAS.md`](docs/RECEITAS.md); para entender configurações e caminhos, [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).
- Pré-requisito: notebook no Wi-Fi `OFICINA-WIFI`.
- Leitura: `node --env-file=api/.env api/scripts/consultar.js arquivo.sql [--json]` (senha do `sa` em
  `~/.config/oficinamobile/senha-sa`).
- Gravação: pela API (`http://192.168.0.10:3333`, cabeçalho `x-token` do `api/.env`), testando antes com `?ensaio=1`.
- Nunca mostrar senhas nem o token no chat; nunca `DELETE`/`UPDATE` em massa; não mexer no `dadospaf`.
- Não criar atalhos/serviços permanentes que leiam a senha ou liguem sozinhos (o classificador bloqueia).
- Regras da oficina: "quem fez" sempre em branco; observações e custos nunca no PDF; custo = preço seco − desconto %,
  venda = custo + margem % (sobre o custo), **arredondada para cima no real inteiro** se der centavos;
  orçamento = OS normal no cliente 2662 `ORÇAMENTO`.
- Ao mudar a API: gerar o pacote (`powershell -ExecutionPolicy Bypass -File instalador-windows\empacotar.ps1` no
  Windows, ou `bash instalador-windows/empacotar.sh` no Linux) e pedir para o dono rodar `INSTALAR.cmd` no PC.
- Peça na API é achada pela tabela `codigos` (há códigos repetidos em `Itens`, ex.: 559). Ao renomear a descrição,
  manter os "..." do fim da descrição do cadastro.
  Ao mudar o app: subir versão em `app/app.json` e gerar o APK (ver README).
- Dois repositórios: este (`oficinamobile`, privado, dados reais) e `oficinamobile-exemplo` (público, dados
  fictícios). Trabalhar sempre na `main` daqui; a versão pública não se edita à mão: depois de commitar, rodar
  `python3 scripts/gerar-exemplo.py` e `git push publico exemplo:main`. Dado real novo → incluir nas trocas do script.
