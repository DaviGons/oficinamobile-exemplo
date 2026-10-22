# Claude no PC da oficina (SERVIDOR-OFICINA) — OficinaMobile

Você está no **PC servidor da Oficina Exemplo** (Windows 11). Aqui rodam o SantSystem, o SQL Server 2014
(banco `dadosretorno`) e a API do app OficinaMobile. Este PC é **produção**: a oficina trabalha nele agora.

- Fale em português do Brasil, simples e direto. O dono não é programador.
- Antes de qualquer coisa com o banco, leia [`docs/BANCO-DE-DADOS.md`](docs/BANCO-DE-DADOS.md).
  Para gravar, siga [`docs/RECEITAS.md`](docs/RECEITAS.md). Como as peças se conectam: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Ferramentas desta pasta (`C:\OficinaOS\claude`)

| O quê | Como |
|---|---|
| **Consultar** o banco (só leitura, login `claude_leitura`) | `.\consultar.cmd consultas\os-abertas.sql` (ou outro `.sql`; `--json` no fim para JSON) |
| **Gravar** pela API (mesma do app, com as receitas do SantSystem) | `powershell -ExecutionPolicy Bypass -File .\api.ps1 -Metodo POST -Rota /os -Corpo '{"clienteId":2662}' -Ensaio` |
| Credenciais | `.env` desta pasta (login só leitura + token da API). **Nunca mostre o conteúdo no chat.** |
| Consultas prontas | pasta `consultas\` (copie e ajuste a placa/número/data) |
| Log da API | `C:\OficinaOS\api.log` |

No Git Bash use barras: `./consultar.cmd consultas/os-abertas.sql`.

## Regras (não negociáveis)

1. **Ler à vontade; gravar só pela API** (`api.ps1`). Teste sempre com `-Ensaio` antes (executa e desfaz).
   O ensaio de `POST /os` e `POST /clientes` pula um número de OS/cliente — evite ensaiar esses dois.
2. **Nunca** rodar `DELETE`, `UPDATE`/`INSERT` direto, `ALTER`, `DROP` ou qualquer mudança no SQL Server, no
   firewall, nos serviços, na tarefa agendada "Oficina OS - API", no SantSystem (`C:\Gerente`) ou no `dadospaf`.
3. Não usar o login `sa` nem ler `C:\Gerente\SANTSYSTEM.ini` ou `C:\OficinaOS\api\.env`.
4. Não reiniciar o PC, o SQL Server nem fechar o SantSystem: a oficina está usando.
5. `Cadastros` tem CPF, RG, telefone (LGPD): não copiar dados de clientes para fora deste PC.
6. Não editar a mesma OS que alguém está com aberta no SantSystem.

## Regras da oficina

- "Quem fez" sempre em branco (funcionário da OS e do serviço).
- Observações e custos **nunca** vão para o PDF/documento do cliente.
- Custo da peça = **preço seco − desconto %**; venda = **custo + margem %** (margem sobre o custo).
  Ex.: seco 449, desconto 20%, margem 50% → custo 359,20 → venda 538,80 → **539,00**. Na API, `custo` é o total (custo × qtd).
- Venda pela margem que der centavos: **arredonda para cima, para o real inteiro**. Preço informado pronto fica como está.
- **Orçamento** = OS normal, em aberto, no cliente **2662 `ORÇAMENTO`**. Desconto/margem só nas peças; serviços
  no valor informado. Itens genéricos: `429` amortecedor diant., `458` kit amortecedor diant., `640` bieleta;
  serviço `servicoId 2` = mão de obra (código 6), `servicoId 13` = alinhamento (R$ 130).
- Não puxar o KM anterior ao abrir OS de um carro que já veio.
- Marca e modelo só com nomes das listas do SantSystem (`/veiculos/marcas`, `/veiculos/marcas/<id>/modelos`):
  a API converte `GM` → `CHEVROLET (GM)` e recusa o resto. Modelo novo: `POST /veiculos/modelos`.
- Remover item da OS: `DELETE /os/<os>/pecas/<id>` ou `DELETE /os/<os>/servicos/<id>` (teste com `-Ensaio`).

## Exemplo: orçamento completo pela API

```powershell
$os = (.\api.ps1 -Metodo POST -Rota /os -Corpo '{"clienteId":2662,"marca":"TOYOTA","modelo":"ETIOS","ano":"2019"}' | ConvertFrom-Json).id
.\api.ps1 -Metodo POST -Rota "/os/$os/pecas" -Corpo '{"codigo":"429","quantidade":2,"valorUnitario":499.20,"custo":665.60}'
.\api.ps1 -Metodo POST -Rota "/os/$os/servicos" -Corpo '{"servicoId":2,"quantidade":1,"valorUnitario":480,"custo":0}'
.\api.ps1 -Rota "/os/$os"
```

Depois de gravar, confira com uma consulta (`consultas\os-detalhe.sql`) e mostre o resumo ao dono.
