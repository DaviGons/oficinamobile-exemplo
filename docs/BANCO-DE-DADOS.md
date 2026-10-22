# Banco de dados do SantSystem — como funciona e como acessar

Relatório de referência para trabalhar com o banco da oficina (Oficina Exemplo) a partir deste notebook.
Levantado em 07–08/10/2026 com captura real do SantSystem (Extended Events) e consultas diretas.
As receitas de gravação detalhadas estão em [`RECEITAS.md`](RECEITAS.md); como as partes se conectam, em
[`ARQUITETURA.md`](ARQUITETURA.md).

---

## 1. Visão geral

| Item | Valor |
|---|---|
| Sistema | SantSystem (programa `MDIPAF.exe`) + `MonitorSantSystem` + `Monitor_Auxiliar` |
| Servidor | PC **SERVIDOR-OFICINA**, Windows 11, IP **192.168.0.10** pelo cabo (Wi-Fi `OFICINA-WIFI`: .11). Até 18/10/2026 era .20; a rede foi trocada em 19/10/2026 |
| SQL Server | 2014 Express 12.0.6024 (SP3), instância padrão `MSSQLSERVER`, **TCP 1433** |
| Banco principal | **`dadosretorno`** — OS, clientes, peças, caixa, estoque (504 tabelas) |
| Banco secundário | `dadospaf` — parte fiscal/PAF, usado como tabela de passagem pelo monitor. **Não mexer.** |
| Collation | `Latin1_General_CI_AS` (ignora maiúsculas, **diferencia acentos**) |
| Autenticação | Mista (Windows + SQL) |
| Terminais | `SERVIDOR-OFICINA` (servidor, `CompuExt.Id = 6`) e `DESKTOP-CAIXA` (`CompuExt.Id = 4`) |
| Triggers | **Nenhum.** Toda regra de negócio está no programa e no MonitorSantSystem |
| Backups | `.bak` compactados em `D:\Backup sistema\2025` no SERVIDOR-OFICINA |

Arquitetura (projeto `~/Projects/OFICINAMOBILE` no notebook; no PC, `C:\OficinaOS`):

```
Celular (APK Oficina OS) ──Wi-Fi──> API Node (PC SERVIDOR-OFICINA :3333) ──> SQL Server localhost:1433 / dadosretorno
```

---

## 2. Como acessar

**Pré-requisito:** o notebook precisa estar no Wi-Fi `OFICINA-WIFI` e o PC SERVIDOR-OFICINA ligado.
Teste rápido: `timeout 3 bash -c 'echo > /dev/tcp/192.168.0.10/1433' && echo ok`

### 2.1 Credenciais

| Login | Para quê | Onde está a senha |
|---|---|---|
| `sa` | Administrador total (o SantSystem usa ele) | Notebook: `~/.config/oficinamobile/senha-sa` (permissão 600). PC: `C:\Gerente\SANTSYSTEM.ini` |
| `app_oficina` | Login da API no PC: `db_datareader` + `db_datawriter` só no `dadosretorno` | PC: `C:\OficinaOS\api\.env` (só admin lê). Não existe cópia no notebook |
| `claude_leitura` | Claude no PC: só `db_datareader` no `dadosretorno` | PC: `C:\OficinaOS\claude\.env` (admin e o usuário que instalou) |
| Token da API | Cabeçalho `x-token` exigido pela API | Notebook: `api/.env` (`APP_TOKEN=`). PC: `C:\OficinaOS\api\.env` e `C:\OficinaOS\claude\.env` |

Nunca imprimir senhas ou o token no chat. Ler sempre do arquivo dentro do comando.

### 2.1b No PC da oficina (Claude em `C:\OficinaOS\claude`)

```powershell
cd C:\OficinaOS\claude
.\consultar.cmd consultas\os-abertas.sql                      # leitura, login claude_leitura
powershell -ExecutionPolicy Bypass -File .\api.ps1 -Rota /saude  # API local com o token do .env
.\api.ps1 -Metodo POST -Rota /os/15305/pecas -Corpo '{"codigo":"640","quantidade":1}' -Ensaio
```

Instruções completas para esse ambiente: `claude-pc-oficina/CLAUDE.md` (no PC, `C:\OficinaOS\claude\CLAUDE.md`).

### 2.2 Consultas (leitura) no notebook — script do projeto

Funciona inclusive dentro do worktree isolado. Escreva o SQL num arquivo e rode:

```bash
node --env-file=api/.env api/scripts/consultar.js /caminho/consulta.sql          # tabela
node --env-file=api/.env api/scripts/consultar.js /caminho/consulta.sql --json   # JSON (1 linha por conjunto)
```

Ele usa a conexão da API (`api/src/db.js`): servidor/porta/banco do `.env` e senha do `sa` lida de
`~/.config/oficinamobile/senha-sa`. **O script executa qualquer SQL** — para gravar, prefira a API (seção 2.4).

### 2.3 Consultas — sqlcmd

`sqlcmd` (go-sqlcmd v1.10) está em `~/.local/bin`. Sempre com a senha vinda do arquivo, inline:

```bash
SQLCMDPASSWORD="$(cat ~/.config/oficinamobile/senha-sa)" sqlcmd -S 192.168.0.10,1433 -U sa -C -d dadosretorno -W -s '|' -Q "SELECT TOP 5 Id, PlacaVei FROM PedVendaCab ORDER BY Id DESC"
```

- `-C` aceita o certificado do servidor; `-W -s '|'` deixa a saída limpa.
- **Não crie atalhos/scripts permanentes que leiam a senha** (o classificador de segurança bloqueou isso).
- Dentro de um worktree isolado o guard bloqueia esse formato — use o script da 2.2.
- `CONCAT` com `SERVERPROPERTY` falha no 2014 (use `CAST(... AS nvarchar)`); juntar texto do catálogo
  (`sys.*`) com texto do banco num `CONCAT` dá conflito de collation.

### 2.4 Gravações — pela API (recomendado)

A API repete exatamente o que o SantSystem grava. Produção: **`http://192.168.0.10:3333`** (tarefa
agendada "Oficina OS - API" no PC). Também roda no notebook com `cd api && npm run dev` (porta 3333).

```bash
T=$(grep '^APP_TOKEN=' api/.env | cut -d= -f2)
curl -s -H "x-token: $T" http://192.168.0.10:3333/saude
curl -s -X POST -H "x-token: $T" -H 'content-type: application/json' \
  'http://192.168.0.10:3333/os/15293/pecas?ensaio=1' -d '{"codigo":"366","quantidade":1}'
```

**`?ensaio=1`** em qualquer gravação: executa tudo numa transação, devolve a prévia das linhas e **desfaz**.
Atenção: o ensaio de `POST /os` e `POST /clientes` consome um número de IDENTITY (pula um número de OS/cliente).

| Método | Rota | O que faz |
|---|---|---|
| GET | `/saude` | servidor e banco |
| GET | `/funcionarios` | cadastros com `Descr='Funcionarios'` |
| GET | `/clientes?busca=` | nome/apelido (sem acento), CPF, celular/telefone com ou sem máscara |
| GET/POST/PATCH | `/clientes/:id` | ler / cadastrar / editar cliente (receita completa) |
| GET | `/clientes/:id/veiculos` | carros já atendidos do cliente |
| GET | `/veiculos/:placa` | carro e clientes pela placa (formato antigo ou Mercosul) |
| GET | `/os?situacao=abertas\|finalizadas&busca=` | lista (placa, cliente, nº) |
| GET | `/os/:id` | OS com peças e serviços |
| GET | `/os/:id/impressao` | dados do PDF — **sem observações e sem custos** |
| GET | `/veiculos/marcas` / `/veiculos/marcas/:id/modelos` | listas do SantSystem (`Veiculo_Marca`/`Veiculo_Modelo`) |
| POST | `/veiculos/modelos` | cadastra modelo novo na marca (`marca`, `modelo`) |
| POST | `/os` | abre OS (`clienteId` opcional, placa, marca, modelo, ano, cor, km, obs) |
| PATCH | `/os/:id` | veículo, km, obs, `clienteId` (0 = sem cliente) |
| DELETE | `/os/:id` | exclusão lógica |
| POST/PATCH | `/os/:id/pecas[/:pecaId]` | lança/altera peça (`codigo`, `quantidade`, `valorUnitario`, `custo` total, `descricao`) |
| DELETE | `/os/:id/pecas/:pecaId` | remove a peça (receita do SantSystem) |
| GET | `/pecas?busca=` / `/servicos?busca=` | catálogos (peça também pelos códigos da tabela `codigos`) |
| POST/PATCH | `/os/:id/servicos[/:servicoId]` | lança/altera serviço (`servicoId` = `Servicos.Id`) |
| DELETE | `/os/:id/servicos/:servicoId` | remove o serviço (`Sit='EX'`) |

**Marca e modelo** da OS (`POST`/`PATCH /os`) só entram com nomes das listas do SantSystem: a API converte o que
foi digitado (sem acento/pontuação e apelidos como `GM` → `CHEVROLET (GM)`, `VOLKSWAGEN` → `VW`) e recusa com
422 o que não existe (`codigo: marca_invalida` ou `modelo_novo`). Só o modelo, sem marca, vale se ele existir
numa marca só (`ONIX` → `CHEVROLET (GM)`).

**Não existe ainda** rota para finalizar/receber no caixa ou dar desconto.

---

## 3. Convenções dos dados (importante)

- **Quase tudo é `varchar`**, inclusive números e datas.
- **Valores com vírgula decimal**: `'1214,00'`, quantidades `'5,000'`, percentuais `'0,0000'`, `VlDesc = '0,00%'`.
  Para somar em SQL: `CAST(REPLACE(TotalPed, ',', '.') AS decimal(12,2))`.
- **Datas como número de dias desde 30/12/1899** (`DtPed`, `DtPrev`, `DtVal`, `Dtfim`, `DataNumero`, `DtAlt`):
  `46302` = 07/10/2026. SQL: `DATEADD(day, CAST(DtPed AS int), '18991230')`.
  Hoje: `DATEDIFF(day, '18991230', GETDATE())`.
- **Algumas datas são texto `dd/mm/aaaa`**: `Cadastros.datCad`, `Cadastros.nasc` (vazio = `01/01/1900`),
  `Produtos.DataGr`, `Recebimentos.DataGr`, `AbCai.Data`, `Registra_Movimento.Data`.
- **`HoraAlt`** = fração do dia com vírgula (`16:01:09` → `'0,667465'`).
- **Flags em texto**: `Final '0'/'1'`, `Excluido '0'/'1'` (em `Cadastros.Excluido` é `int`), `Baixado 'Não'/'Sim'`.
- **Exclusão é sempre lógica** (`Excluido = '1'`). O SantSystem não apaga linhas.
- **Chaves IDENTITY**: `PedVendaCab.Id` (= número da OS), `PedVendaProd.Id`, `Servicos_OS.Id`,
  `Cadastros.ChvCadastros`, `Recebimentos.id`, `Itens.Id`, `codigos.Id`.
- **Ligações por texto**: `PedVendaProd.ChvPed`, `Servicos_OS.Id_Venda`, `PedVendaCab.ChvCad` são varchar
  com o número. Use `TRY_CAST(c.ChvCad AS int)` no JOIN com `Cadastros`.
- **Identificador** (50 caracteres): `<ConfigSis VERSAO.cp5 = 22880><ddmmaaaa><hhmmss>12<29 hex>`.
- **Busca sem acento**: `nom COLLATE Latin1_General_CI_AI LIKE '%joao%'`.
- **Placa**: `AAA-9999` ou `AAA-9A99`; vazia = `'___-____'`. Carro antigo pode estar no formato velho
  (5º caractere 0–9 ↔ A–J no Mercosul): buscar as duas formas com `REPLACE(PlacaVei, '-', '')`.
- O SantSystem grava por **cursores ADO no servidor** (`sp_cursor`), não por `INSERT` simples.

---

## 4. Tabelas principais

Contagens de 08/10/2026.

### 4.1 Ordem de serviço

**`PedVendaCab`** — cabeçalho da OS (13.308). `Id` = número da OS.
- Cliente/funcionário: `ChvCad` (`Cadastros.ChvCadastros`, pode ser `''` = sem cliente), `ChvFunc` (deixamos `''`).
- Situação: `Final`, `Excluido`, `Origem = 'O.S'` (`'VENDA-NFE'` = venda com nota), `CKMVO = 'Venda'` ou `'Orcamento'`.
- Datas: `DtPed` (abertura), `DtPrev`, `DtVal`, `Dtfim` (finalização).
- Veículo: `PlacaVei`, `Marca`, `Modelo`, `Ano_Veiculo`, `Cor`, `KM`, `Combustivel`, `Motor`.
  `Marca`/`Modelo` precisam ser **iguais** aos das listas `Veiculo_Marca` (`Marca`, `Sit 'E'` = excluída) e
  `Veiculo_Modelo` (`Modelo`, `IdMarca` = `Veiculo_Marca.Id`): a tela de OS do SantSystem mostra em branco o
  que não está na lista (ex.: `GM` em vez de `CHEVROLET (GM)`). Combustível e motor têm listas parecidas
  (`Veiculo_Combustivel`, `Veiculo_Motor`). Modelo novo: `INSERT Veiculo_Modelo (Modelo, IdMarca, Sit='N')`,
  `Identificador`/`BKP` nulos (como o MAVERICK, Id 231, cadastrado pelo SantSystem).
- Totais: `TotItens` = `TotalPed` (soma das peças), `Vl_Br_Serv`/`Vl_LQ_Serv` (serviços), `Vl_Desc_Serv`,
  `TxtTotGer` (peças + serviços), `TotCusItens`/`TotCusServ` (soma dos custos), `TotDesc`, `DescP`.
- `OBS` (observação interna — **nunca vai para o PDF**), `DadosAdicionais` (texto fiscal Simples/IBPT),
  `guid` (GUID da venda após receber no caixa).

**`PedVendaProd`** — peças da OS (40.932). `ChvPed` = nº da OS, `Nitem` sequencial.
- `Cod`, `ICPS` (`Itens.ICPS`), `Descr`, `QtdPed`=`QtdVnd`, `VlUnitBr`, `VlLiq`, `SubTotPed`=`SubTotVnd`, `UnMed`.
- **`Custo` = custo TOTAL da linha** (unitário × quantidade).
- Fiscal: `NCM`, `Regra` (= `Itens.RDE`), `CFOP` (= `Itens.CFOP` em SP), `CSTICMS` = CSOSN do Simples:
  `'102'` para regra B (tributado), `'500'` para A/E (substituição). Cliente sem UF ou fora de SP: CFOP 6xxx e
  CSOSN vazio. Regras em `RegrasSat` (ver RECEITAS.md, "Alterar a tributação").
- `Baixado` (`'Não'` até finalizar), `Excluido`, `Identificador`.

**`Servicos_OS`** — serviços da OS (14.826). `Id_Venda` = nº da OS.
- `Codigo` (código de tela) e `Id_Servico` (= `Servicos.Id`; ex.: código 6 = Id 2 "Mão de obra").
- `Descr` (editável), `Quant` (inteiro em texto, `'2'`), `VlUnit`, `SubTot`, `Custo` (total), `Obs_Servico`
  (**nunca vai para o PDF**), `Id_Funcionario` (deixamos `''`), `Sit = 'N'` (`'EX'` = excluído), `Guid_Linha`.
- Exclusão da OS **não** marca os serviços: filtre pelo cabeçalho.

### 4.2 Cadastros e catálogo

**`Cadastros`** — clientes, funcionários, fornecedores (5.880). `Descr` diz o tipo:
`Clientes` (5.773), `Fornecedores` (72), `Funcionarios` (4: 7 Ana, 91 Bruno, 4462 Carlos, 140 Diego),
`Ref Comercial`, `Transportadora`.
- Chave `ChvCadastros` (IDENTITY) = `ICCS` = `CHVCAD1` = `NumCli`.
- `nom`, `apdoftsia` (apelido/fantasia), `TipFisJur` (`F`/`J`), `CPF` (CPF ou CNPJ, só números), `RG`.
- Contato: `Cel` e `Fone1` (formato recente `(11)-91234-5678`), `Email`.
- Endereço: `Cep` (`01001-000`), `TipEnd` (`Rua`), `Ende`, `Num`, `Compl`, `Bairro`, `Cidade`, `UF`, `CodCid` (IBGE).
- `observaçoes` (com ç), `Env_Web`, `Cadastro_Xml` (cópia XML do cadastro), `DtAlt`, `HoraAlt`.
- Clientes genéricos: **2662 `ORÇAMENTO`**, 4229 `CONSUMIDOR`.

**`Itens`** — cadastro de peças (3.598): `ICPS` (chave), `Cod`, `Descr`, `PrecVen`, `Custo`, `CustoReal`,
`Marg` (margem **sobre o custo**: 124,81 → 188,00 = 50,63%), `Estoque` (texto, pode ser negativo — a oficina não
controla), `UNMED`, `NCM`, `CFOP`, `CST`, `MRegra` (regra fiscal separada por `|`: NCM|CFOP|CST|…|CSOSN),
`RDE`/`RFE`/`RFEIE`/`RFECPF` (letra da regra dentro/fora do estado). `codigos` liga `Cod` ↔ `ChvProd` (= ICPS).

**`Servicos`** — catálogo de serviços (233): `Id`, `Codigo`, `Descr`, `Valor`, `Custo`.
Ex.: Id 2 / código 6 "Mão de obra" (valor 0); Id 13 "alinhamento" (130,00, custo 80,00).

**`Empresa`** — dados da oficina (1 linha): `NFantasia` Oficina Exemplo, `RSocial`, `CNPJ`, `Inscr`, `Rua`, `Num`,
`Bairro`, `Cidade`, `UF`, `Cep`, `Telefone`, `Email`. Não há logo no banco (`Config.Foto` vazio).

### 4.3 Estoque, caixa e financeiro

| Tabela | Linhas | Papel |
|---|---|---|
| `Produtos` | 16.010 | Movimento de saída por item (OS finalizada / venda). `TipMov='O.S'`, `IDVenda`=OS, `IDOrigem`=id da peça, `Sit` `'1'` pendente → `'4'` processado, `Guid_Venda` |
| `ProdutosAA_T` | — | **Cópia viva por trimestre** (ex.: `Produtos26_4` = 2026, 4º tri). Não são backups: o SantSystem grava nelas |
| `Produtos_Saldo` | 29.356 | Saldo de estoque por movimento (anterior, entrada, saída, atual) |
| `Produto_Saldo_Kardex` | 33.886 | Kardex: liga o saldo ao movimento de origem |
| `Recebimentos` | 5.079 | Pagamento no caixa: `IDVENDA`=OS, `TotalVenda`, `VlDin`/`VlCC`/`VlCd`/`vlChq`/…, `TipoRec='PDV'`, `ChvAbertura` (= `AbCai.NIDAbCai`), `Guid_Venda` |
| `RectParcCab` / `RectParc` | 12.517 / 14.208 | Contas a receber: título e parcelas (`TxtFRecto` forma, `BAIXADO`) |
| `AbCai` | 879 | Abertura (`AF='A'`) e fechamento (`'F'`) do caixa por PC/dia |
| `Vendas` | 350 | Vendas do PDV/NFC-e (não existe linha para OS) |
| `NF` | 4.448 | Notas fiscais (ligação por `Os`/`Osven`) |

### 4.4 Sincronização, log e configuração

- **`CompuExt`** — terminais (Id, `Compu`, `Token_PC`, `Ativo`, `Sincronismo`).
- **`CadExt`** — aviso por PC de cliente novo/alterado: `Sit='P'` (pendente) → `'F'` quando o monitor do PC atualiza.
- **`ProdExt`** — mesmo mecanismo para produtos (`Sit`, `Excluir`).
- **`Registra_Movimento`** — log de auditoria (42.073): `Data`, `Hora`, `Computador`, `Usuario`, `Nome_Usuario`,
  `Tipo` (Insert/Update), `Tela`, `Identificacao_Registro`. O app grava `Tela='AppOficina'` com usuário em branco.
- **`ConfigSis`** — `Busca='VERSAO'`, `cp5='22880'` (prefixo dos identificadores).

### 4.5 MonitorSantSystem (roda em cada PC)

Processa em segundo plano, a cada poucos segundos:
- `Produtos.sit='1'` → baixa estoque (`Produtos_Saldo`, `Itens.Estoque`, `Produto_Saldo_Kardex`) e marca `sit='4'`.
- `CadExt`/`ProdExt` pendentes → atualiza a lista local e marca `'F'`.
- Copia `Recebimentos` → `RecebimentosR` e usa `dadospaf.RectParcCab/RectParc` como passagem (faz
  `DELETE` sem filtro **no dadospaf**, que fica vazio — normal).
- Limpa aspas (`Replace(...,'''','')`) em várias colunas.

Consequência: **gravando `Produtos` como o SantSystem, o estoque se ajusta sozinho.**

---

## 5. Como o SantSystem grava (resumo)

Detalhes, colunas e valores fixos em [`RECEITAS.md`](RECEITAS.md).

| Operação | O que acontece |
|---|---|
| Abrir OS | `INSERT PedVendaCab` (totais zerados, `Origem='O.S'`, `CKMVO='Venda'`…) + `UPDATE DadosAdicionais` |
| Lançar peça | `INSERT PedVendaProd` (`Baixado='Não'`) + recalcula totais do cabeçalho |
| Lançar serviço | `INSERT Servicos_OS` (`Sit='N'`) + recalcula totais |
| Salvar OS | regrava cabeçalho e **todos** os itens com o que está na tela |
| Excluir OS | `Excluido='1'` no cabeçalho e nas peças |
| Cadastrar cliente | `INSERT Cadastros` → `ICCS/CHVCAD1/NumCli` → `CadExt` por PC → `Registra_Movimento` → `Env_Web='P'` + XML |
| Remover peça da OS | `PedVendaProd.Excluido='1'` + marca `Produtos`/`ProdutosAA_T` (se houver) + totais do cabeçalho |
| Remover serviço da OS | `Servicos_OS.Sit='EX'` (o resto da linha fica igual) + totais do cabeçalho |
| Alterar preço do produto | `Itens` (preços, margens, `DTAlt`), `ProdExt` P por PC, `Codigos`, `AtuProd`/`AtuProdDetalhado`, `ItensLog`, `item_Xml` |
| Alterar tributação do produto | igual, com `Itens.RDE/RFE/RFEIE/RFECPF/LRegra` = regra e `CFOP`/`CST` de `RegrasSat` (`MRegra` não muda); OS já lançadas ficam como estavam |
| Finalizar OS | `Final='1'`, `Dtfim`; por peça: `ProdExt` P, `Baixado='Sim'`, `INSERT Produtos` + `ProdutosAA_T` |
| Receber no caixa | `INSERT Recebimentos`, `RectParcCab`, `RectParc`; `guid_venda` em Produtos/PedVendaCab |
| Estoque | feito pelo MonitorSantSystem ~7 s depois |

---

## 6. Regras combinadas com o dono da oficina

- **"Quem fez" sempre em branco**: `PedVendaCab.ChvFunc`, `Servicos_OS.Id_Funcionario` e usuário no `Registra_Movimento`.
- **Observações nunca vão para o PDF** (OS, serviço e cliente). Custos também não.
- **Custo da peça** = preço seco − desconto %; **venda** = custo + margem % (margem sobre o custo).
  Ex.: seco 449, desconto 20%, margem 50% → custo 359,20 → venda 538,80 → **539,00**. `PedVendaProd.Custo` = custo × qtd.
- **Venda calculada pela margem que der centavos: arredonda o valor unitário para cima, para o real inteiro**
  (210,78 → 211,00). Preço informado pronto pelo dono fica como está.
- Descontos dos fornecedores: Alfa ("alfa") 20%, Beta ("beta") 15% (a nota da Beta já vem com o desconto),
  Gama ("gama") 14,5% (nº do vale = o número abaixo do código de barras).
  Na `OBS` da OS: `<códigos separados por -> <fornecedor> <nº do vale/pedido>`, vários separados por ` // `.
- Ao reaproveitar um veículo, **não puxar o KM** anterior.
- **Orçamento** = OS normal (`CKMVO='Venda'`, em aberto) no cliente **2662 `ORÇAMENTO`**. Desconto/margem só nas
  peças; mão de obra no valor informado. Itens genéricos usados: `429` amortecedor diant., `458` kit amortecedor
  diant. (descrição "PAR DE KIT AMORTECEDOR DIANT."), `640` bieleta, serviço Id 2 (mão de obra), Id 13 (alinhamento).
- O SantSystem também tem `CKMVO='Orcamento'` (295 OS, quase todas `Final='1'`), mas essa receita **não foi capturada**.

---

## 7. Consultas úteis

```sql
-- OS abertas (mais recentes)
SELECT TOP 50 c.Id, cad.nom AS cliente, c.PlacaVei, c.Modelo, c.TxtTotGer,
       DATEADD(day, CAST(c.DtPed AS int), '18991230') AS abertura
FROM PedVendaCab c LEFT JOIN Cadastros cad ON cad.ChvCadastros = TRY_CAST(c.ChvCad AS int)
WHERE c.Origem = 'O.S' AND c.Final = '0' AND c.Excluido = '0'
ORDER BY c.Id DESC;

-- OS completa
SELECT * FROM PedVendaCab WHERE Id = 15292;
SELECT Nitem, Cod, Descr, QtdPed, VlUnitBr, SubTotPed, Custo FROM PedVendaProd WHERE ChvPed = '15292' AND Excluido = '0';
SELECT Codigo, Descr, Quant, VlUnit, SubTot, Custo FROM Servicos_OS WHERE Id_Venda = '15292' AND ISNULL(Sit,'N') <> 'EX';

-- Histórico de um carro (formato antigo e Mercosul)
SELECT Id, ChvCad, PlacaVei, KM, TxtTotGer, DATEADD(day, CAST(DtPed AS int), '18991230') AS data
FROM PedVendaCab WHERE Excluido = '0' AND REPLACE(PlacaVei, '-', '') IN ('ABC1D23', 'ABC1323') ORDER BY Id DESC;

-- Cliente por nome sem acento ou celular sem máscara
SELECT ChvCadastros, nom, Cel, CPF FROM Cadastros
WHERE Descr = 'Clientes' AND (nom COLLATE Latin1_General_CI_AI LIKE '%joao%'
   OR REPLACE(REPLACE(REPLACE(Cel, '(', ''), ')', ''), '-', '') LIKE '%912345678%');

-- Faturamento de OS finalizadas por mês (ano corrente)
SELECT YEAR(d) AS ano, MONTH(d) AS mes, COUNT(*) AS os,
       SUM(CAST(REPLACE(TxtTotGer, ',', '.') AS decimal(12,2))) AS total
FROM (SELECT DATEADD(day, CAST(Dtfim AS int), '18991230') AS d, TxtTotGer FROM PedVendaCab
      WHERE Origem = 'O.S' AND Final = '1' AND Excluido = '0' AND ISNUMERIC(Dtfim) = 1) x
WHERE YEAR(d) = YEAR(GETDATE()) GROUP BY YEAR(d), MONTH(d) ORDER BY mes;

-- Peça no catálogo
SELECT ICPS, Cod, Descr, PrecVen, Custo, Estoque FROM Itens
WHERE Cod = '366' OR Descr COLLATE Latin1_General_CI_AI LIKE '%amortecedor%';

-- Recebimentos do dia
SELECT id, IDVENDA, TotalVenda, VlDin, VlCC, VlCd, HoraGr FROM Recebimentos
WHERE DataGr = CONVERT(varchar(10), GETDATE(), 103) ORDER BY id;
```

---

## 8. Cuidados

1. **Ler à vontade; gravar só pela receita** (API ou RECEITAS.md). Nunca `DELETE`, nunca `UPDATE` em massa.
2. Antes de gravar algo novo, **testar com `?ensaio=1`** ou dentro de `BEGIN TRAN … ROLLBACK`.
3. **Não editar a mesma OS no PC e no app ao mesmo tempo**: ao salvar, o SantSystem regrava a OS inteira.
4. Não mexer no `dadospaf` nem em `CompuExt`/`ConfigSis`.
5. `Cadastros` tem CPF, RG e nascimento (**LGPD**): não copiar dados de clientes para fora.
6. O `sa` é administrador total; o firewall do PC libera o SQL na rede local; SQL Server 2014 está sem suporte da Microsoft.
7. A pasta `dados/` do projeto (capturas e estrutura com dados de clientes) fica fora do git.
8. Para descobrir uma operação nova (ex.: cartão/Pix, estorno, desconto, remover item, fechar orçamento),
   repetir a captura com Extended Events: `captura/kit-windows/` (kit) e `captura/ferramentas/` (extração, resumo, diff).

## 9. Pendências conhecidas

- Receber com cartão / Pix / parcelado; estornar recebimento; reabrir OS.
- Desconto; alterar preço de produto (receita capturada, ainda sem rota na API).
- Fechar orçamento com `CKMVO='Orcamento'`.
- Origem da alíquota do texto IBPT em `DadosAdicionais`.

## 10. Mapa do projeto

Ver [`ARQUITETURA.md`](ARQUITETURA.md) (pastas, `.env`, logins, portas e como atualizar cada parte).
